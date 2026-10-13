import {
  decodePDFRawStream,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFDocument,
  PDFRef,
  PDFStream,
} from "pdf-lib";
import { deflate } from "pako";
import { PdfLoadError } from "./core";

export type CompressionLevel = "light" | "recommended" | "strong";

interface ImageSettings {
  /** Qualidade do JPEG, de 0 a 1. */
  quality: number;
  /** Maior lado da imagem, em pixels; imagens maiores são reduzidas. */
  maxDimension: number;
}

/** `null` = só otimização sem perdas (sem tocar nas imagens). */
export const IMAGE_SETTINGS: Record<CompressionLevel, ImageSettings | null> = {
  light: null,
  recommended: { quality: 0.75, maxDimension: 2000 },
  strong: { quality: 0.5, maxDimension: 1400 },
};

// Imagens menores que isso não rendem economia que valha a perda de qualidade.
const MIN_IMAGE_BYTES = 30_000;
// A nova imagem só substitui a original se ficar pelo menos 10% menor.
const MIN_IMAGE_GAIN = 0.9;
// Streams pequenos não compensam o custo do deflate.
const MIN_STREAM_BYTES = 1024;

const name = PDFName.of;
const KEYS = {
  Type: name("Type"),
  Subtype: name("Subtype"),
  Filter: name("Filter"),
  Decode: name("Decode"),
  Mask: name("Mask"),
  SMask: name("SMask"),
  ImageMask: name("ImageMask"),
  BitsPerComponent: name("BitsPerComponent"),
  Width: name("Width"),
  Height: name("Height"),
  ColorSpace: name("ColorSpace"),
  N: name("N"),
};
const VALUES = {
  Image: name("Image"),
  DCTDecode: name("DCTDecode"),
  FlateDecode: name("FlateDecode"),
  DeviceRGB: name("DeviceRGB"),
  DeviceGray: name("DeviceGray"),
  ICCBased: name("ICCBased"),
};
// Estes streams têm regras próprias sobre filtros; ficam como estão.
const UNTOUCHED_TYPES = new Set(["ObjStm", "XRef", "Metadata"]);
// Chaves do dicionário da imagem original que continuam valendo na recodificada.
const INHERITED_IMAGE_KEYS = ["SMask", "Intent", "Interpolate"].map(name);

/** Lista de filtros do stream, ou `null` se o formato for incomum. */
function filterNames(dict: PDFDict): PDFName[] | null {
  const filter = dict.lookup(KEYS.Filter);
  if (filter === undefined) return [];
  if (filter instanceof PDFName) return [filter];
  if (filter instanceof PDFArray) {
    const names: PDFName[] = [];
    for (let i = 0; i < filter.size(); i++) {
      const item = filter.lookup(i);
      if (!(item instanceof PDFName)) return null;
      names.push(item);
    }
    return names;
  }
  return null;
}

/** 1 (cinza) ou 3 (RGB) componentes por pixel; `null` para espaços de cor não suportados. */
function colorComponents(dict: PDFDict): 1 | 3 | null {
  const space = dict.lookup(KEYS.ColorSpace);
  if (space instanceof PDFName) {
    if (space === VALUES.DeviceRGB) return 3;
    if (space === VALUES.DeviceGray) return 1;
    return null;
  }
  if (space instanceof PDFArray && space.size() === 2 && space.lookup(0) === VALUES.ICCBased) {
    const profile = space.lookup(1);
    if (profile instanceof PDFStream) {
      const n = profile.dict.lookupMaybe(KEYS.N, PDFNumber)?.asNumber();
      if (n === 1 || n === 3) return n;
    }
  }
  return null;
}

/** Tags das imagens usadas como máscara de transparência (devem continuar em tons de cinza). */
function collectSoftMaskTags(doc: PDFDocument): Set<string> {
  const tags = new Set<string>();
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream)) continue;
    const mask = object.dict.get(KEYS.SMask);
    if (mask instanceof PDFRef) tags.add(mask.tag);
  }
  return tags;
}

function isCandidateImage(stream: PDFRawStream): boolean {
  const { dict } = stream;
  return (
    dict.lookup(KEYS.Subtype) === VALUES.Image &&
    stream.contents.length >= MIN_IMAGE_BYTES &&
    !dict.lookupMaybe(KEYS.ImageMask, PDFBool)?.asBoolean() &&
    !dict.has(KEYS.Decode) &&
    !dict.has(KEYS.Mask) &&
    dict.lookupMaybe(KEYS.BitsPerComponent, PDFNumber)?.asNumber() === 8 &&
    colorComponents(dict) !== null
  );
}

/** Decodifica a imagem do PDF em um bitmap (JPEG direto, ou Flate/bruto via pixels). */
async function decodeImage(stream: PDFRawStream): Promise<ImageBitmap | null> {
  const { dict } = stream;
  const filters = filterNames(dict);
  if (!filters || filters.length > 1) return null;

  if (filters[0] === VALUES.DCTDecode) {
    return createImageBitmap(new Blob([stream.contents as BlobPart], { type: "image/jpeg" }), {
      colorSpaceConversion: "none",
    });
  }
  if (filters.length > 0 && filters[0] !== VALUES.FlateDecode) return null;

  const width = dict.lookupMaybe(KEYS.Width, PDFNumber)?.asNumber();
  const height = dict.lookupMaybe(KEYS.Height, PDFNumber)?.asNumber();
  const components = colorComponents(dict);
  if (!width || !height || !components) return null;

  const raw = decodePDFRawStream(stream).decode();
  if (raw.length !== width * height * components) return null;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const target = pixel * 4;
    if (components === 3) {
      rgba[target] = raw[pixel * 3];
      rgba[target + 1] = raw[pixel * 3 + 1];
      rgba[target + 2] = raw[pixel * 3 + 2];
    } else {
      rgba[target] = rgba[target + 1] = rgba[target + 2] = raw[pixel];
    }
    rgba[target + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, width, height));
}

/** Reduz e recodifica a imagem em JPEG; `null` se não valer a pena trocar a original. */
async function recompressImage(
  stream: PDFRawStream,
  { quality, maxDimension }: ImageSettings,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const bitmap = await decodeImage(stream);
  if (!bitmap) return null;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return bytes.length < stream.contents.length * MIN_IMAGE_GAIN
    ? { bytes, width, height }
    : null;
}

async function recompressImages(
  doc: PDFDocument,
  settings: ImageSettings,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return;

  const softMasks = collectSoftMaskTags(doc);
  const candidates = doc.context
    .enumerateIndirectObjects()
    .filter(
      (entry): entry is [PDFRef, PDFRawStream] =>
        entry[1] instanceof PDFRawStream &&
        !softMasks.has(entry[0].tag) &&
        isCandidateImage(entry[1]),
    );

  for (const [index, [ref, stream]] of candidates.entries()) {
    try {
      const result = await recompressImage(stream, settings);
      if (result) {
        const dict = doc.context.obj({
          Type: "XObject",
          Subtype: "Image",
          Width: result.width,
          Height: result.height,
          ColorSpace: "DeviceRGB",
          BitsPerComponent: 8,
          Filter: "DCTDecode",
        });
        for (const key of INHERITED_IMAGE_KEYS) {
          const value = stream.dict.get(key);
          if (value) dict.set(key, value);
        }
        doc.context.assign(ref, PDFRawStream.of(dict, result.bytes));
      }
    } catch {
      // Imagem que não pôde ser decodificada: mantém a original intacta.
    }
    onProgress?.(index + 1, candidates.length);
  }
}

/** Aplica deflate (sem perdas) em streams que o gerador do PDF deixou sem compressão. */
function deflateRawStreams(doc: PDFDocument): void {
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;

    const { dict, contents } = object;
    if (dict.has(KEYS.Filter) || contents.length < MIN_STREAM_BYTES) continue;
    const type = dict.lookupMaybe(KEYS.Type, PDFName)?.decodeText();
    if (type && UNTOUCHED_TYPES.has(type)) continue;

    const packed = deflate(contents, { level: 9 });
    if (packed.length >= contents.length * 0.95) continue;

    const next = dict.clone(doc.context);
    next.set(KEYS.Filter, VALUES.FlateDecode);
    doc.context.assign(ref, PDFRawStream.of(next, packed));
  }
}

/**
 * Reduz o tamanho do PDF. Todos os níveis comprimem, sem perdas, streams que
 * estavam sem compressão; "recommended" e "strong" também recodificam imagens
 * em JPEG (com menos qualidade e resolução). Texto e vetores nunca são tocados.
 * Só deve rodar dentro do Web Worker (usa OffscreenCanvas).
 */
export async function compressPdfDocument(
  buffer: ArrayBuffer,
  level: CompressionLevel,
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }

  const settings = IMAGE_SETTINGS[level];
  if (settings) await recompressImages(doc, settings, onProgress);
  deflateRawStreams(doc);

  onProgress?.(1, 1);
  return (await doc.save({ useObjectStreams: true })) as Uint8Array<ArrayBuffer>;
}
