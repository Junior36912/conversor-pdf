import { PDFDocument, type PDFImage } from "pdf-lib";
import { PdfLoadError } from "./core";

export type PageSizeOption = "fit" | "a4" | "letter";
export type OrientationOption = "auto" | "portrait" | "landscape";
export type MarginOption = "none" | "small" | "large";

export interface ImagesToPdfOptions {
  pageSize: PageSizeOption;
  /** Só vale para A4 e Carta; "fit" usa o formato da própria imagem. */
  orientation: OrientationOption;
  margin: MarginOption;
}

export interface ImageInput {
  name: string;
  buffer: ArrayBuffer;
}

// Tamanhos em pontos (1 pt = 1/72 pol).
const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;
const MARGINS: Record<MarginOption, number> = { none: 0, small: 24, large: 48 };
// 96 px por polegada (CSS) -> 72 pt por polegada.
const PX_TO_PT = 0.75;
// Limite do formato PDF para o tamanho de página.
const MAX_PAGE_PT = 14_400;

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Uint8Array) =>
  b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Orientação EXIF do JPEG (1 a 8; 1 = normal). Câmeras e celulares gravam a foto "deitada" e
 * anotam aqui como girá-la; leitores de PDF ignoram isso, então a imagem precisa ser corrigida.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      const isExif =
        marker === 0xe1 &&
        bytes[offset + 4] === 0x45 && // "Exif\0\0"
        bytes[offset + 5] === 0x78 &&
        bytes[offset + 6] === 0x69 &&
        bytes[offset + 7] === 0x66;
      if (isExif) {
        const tiff = offset + 10;
        const little = bytes[tiff] === 0x49; // "II" = little-endian
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const entries = view.getUint16(ifd, little);
        for (let i = 0; i < entries; i++) {
          const entry = ifd + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) {
            return view.getUint16(entry + 8, little);
          }
        }
        return 1;
      }
      if (marker === 0xda) break; // início da imagem: não há mais metadados
      offset += 2 + length;
    }
  } catch {
    // EXIF malformado: trata como orientação normal.
  }
  return 1;
}

/** Decodifica com o navegador (aplicando o EXIF) e recodifica; cobre WebP, GIF, BMP, AVIF... */
async function reencode(
  buffer: ArrayBuffer,
  outputType: "image/png" | "image/jpeg",
): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([buffer]), {
    imageOrientation: "from-image",
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível.");
  if (outputType === "image/jpeg") {
    context.fillStyle = "#ffffff"; // JPEG não tem transparência
    context.fillRect(0, 0, bitmap.width, bitmap.height);
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: outputType, quality: 0.92 });
  return new Uint8Array(await blob.arrayBuffer());
}

async function embedImage(doc: PDFDocument, buffer: ArrayBuffer): Promise<PDFImage> {
  const bytes = new Uint8Array(buffer);
  if (isJpeg(bytes)) {
    // JPEG normal entra sem recompressão (sem perda); o que tem EXIF de rotação precisa ser girado.
    return jpegOrientation(bytes) > 1
      ? doc.embedJpg(await reencode(buffer, "image/jpeg"))
      : doc.embedJpg(bytes);
  }
  if (isPng(bytes)) return doc.embedPng(bytes);
  return doc.embedPng(await reencode(buffer, "image/png"));
}

function pageSizeFor(
  image: PDFImage,
  { pageSize, orientation, margin }: ImagesToPdfOptions,
): { width: number; height: number } {
  const edge = MARGINS[margin];

  if (pageSize === "fit") {
    const naturalW = image.width * PX_TO_PT + 2 * edge;
    const naturalH = image.height * PX_TO_PT + 2 * edge;
    const shrink = Math.min(1, MAX_PAGE_PT / Math.max(naturalW, naturalH));
    return { width: naturalW * shrink, height: naturalH * shrink };
  }

  const { width, height } = PAGE_SIZES[pageSize];
  const landscape =
    orientation === "auto" ? image.width > image.height : orientation === "landscape";
  return landscape ? { width: height, height: width } : { width, height };
}

/**
 * Cria um PDF com uma imagem por página, na ordem recebida. A imagem é ajustada à área útil
 * (página menos margens) sem distorcer, e centralizada.
 * Só deve rodar dentro do Web Worker (usa OffscreenCanvas e createImageBitmap).
 */
export async function imagesToPdf(
  images: ImageInput[],
  options: ImagesToPdfOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const edge = MARGINS[options.margin];

  for (const [index, { buffer }] of images.entries()) {
    let image: PDFImage;
    try {
      image = await embedImage(doc, buffer);
    } catch (cause) {
      throw new PdfLoadError(index, cause);
    }

    const { width, height } = pageSizeFor(image, options);
    const page = doc.addPage([width, height]);

    const availableW = width - 2 * edge;
    const availableH = height - 2 * edge;
    const scale = Math.min(availableW / image.width, availableH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    page.drawImage(image, {
      x: (width - drawW) / 2,
      y: (height - drawH) / 2,
      width: drawW,
      height: drawH,
    });

    onProgress?.(index + 1, images.length);
  }

  // pdf-lib sempre aloca um ArrayBuffer próprio (nunca SharedArrayBuffer).
  return (await doc.save()) as Uint8Array<ArrayBuffer>;
}
