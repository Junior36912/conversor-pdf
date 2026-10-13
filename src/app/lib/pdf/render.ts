// pdfjs-dist toca em APIs do navegador (ex.: DOMMatrix) ao ser avaliado, então ele
// é carregado via import() dinâmico para nunca ser executado durante o SSR.
type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    // Copiado para `public/` por scripts/copy-pdf-worker.mjs (servido como .js; ver o script).
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.${pdfjs.version}.min.js`;
    return pdfjs;
  });
  return pdfjsPromise;
}

type PdfPage = Awaited<ReturnType<import("pdfjs-dist").PDFDocumentProxy["getPage"]>>;

/** Desenha a página num canvas com a largura pedida e devolve uma data URL JPEG. */
async function drawThumbnail(page: PdfPage, targetWidth: number): Promise<string> {
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function renderFirstPageToDataUrl(
  file: File,
  targetWidth: number,
): Promise<string> {
  const pdfjs = await loadPdfJs();
  // getDocument transfere o buffer para o worker do pdf.js, então lemos uma cópia nova.
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  try {
    return await drawThumbnail(await pdf.getPage(1), targetWidth);
  } finally {
    await pdf.destroy();
  }
}

// Evita renderizar a mesma miniatura duas vezes (ex.: StrictMode, remontagens).
const previewCache = new WeakMap<File, Promise<string>>();
// Renderiza uma miniatura por vez para não estourar a memória com muitos PDFs.
let queue: Promise<unknown> = Promise.resolve();

/** Renderiza a primeira página do PDF e devolve uma data URL (base64) em JPEG. */
export function renderFirstPage(file: File, targetWidth = 240): Promise<string> {
  let preview = previewCache.get(file);
  if (!preview) {
    preview = queue.then(() => renderFirstPageToDataUrl(file, targetWidth));
    queue = preview.catch(() => undefined);
    previewCache.set(file, preview);
  }
  return preview;
}

/** Conta as páginas do PDF (via pdf.js, sem carregar o pdf-lib na main thread). */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}

export type ImageFormat = "png" | "jpeg";

export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
};

export interface RenderedImage {
  /** Número da página (1-based) de onde a imagem saiu. */
  page: number;
  buffer: ArrayBuffer;
}

interface RenderPagesOptions {
  /** Páginas a renderizar (1-based), na ordem de saída. */
  pages: number[];
  /** Pixels por ponto do PDF: 1 = 72 DPI. */
  scale: number;
  format: ImageFormat;
  /** Qualidade do JPEG, de 0 a 1. */
  quality?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

// Navegadores limitam a área do canvas (Safari: ~16,7 milhões de pixels). Páginas
// muito grandes são reduzidas para caber, em vez de falhar com uma imagem em branco.
const MAX_CANVAS_PIXELS = 16_000_000;

function canvasToBuffer(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? blob.arrayBuffer().then(resolve, reject)
          : reject(new Error("Não foi possível gerar a imagem da página.")),
      type,
      quality,
    );
  });
}

/** Renderiza as páginas escolhidas e as codifica como PNG ou JPEG. */
export async function renderPagesToImages(
  file: File,
  { pages, scale, format, quality = 0.92, signal, onProgress }: RenderPagesOptions,
): Promise<RenderedImage[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const images: RenderedImage[] = [];

  try {
    for (const [index, pageNumber] of pages.entries()) {
      signal?.throwIfAborted();

      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const pixels = base.width * base.height * scale * scale;
      const fitted = pixels > MAX_CANVAS_PIXELS ? scale * Math.sqrt(MAX_CANVAS_PIXELS / pixels) : scale;
      const viewport = page.getViewport({ scale: fitted });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvas, viewport }).promise;
      const buffer = await canvasToBuffer(canvas, IMAGE_MIME_TYPES[format], quality);
      images.push({ page: pageNumber, buffer });

      // Libera a memória do bitmap antes da próxima página.
      canvas.width = canvas.height = 0;
      page.cleanup();
      onProgress?.(index + 1, pages.length);
    }
  } finally {
    await pdf.destroy();
  }

  return images;
}

export interface PdfPageRenderer {
  pageCount: number;
  /** Data URL JPEG da página (1-based). As renderizações rodam uma por vez e ficam em cache. */
  renderThumbnail(pageNumber: number, targetWidth?: number): Promise<string>;
  /** Libera o documento; chamadas seguintes de `renderThumbnail` falham. */
  destroy(): void;
}

/** Abre o PDF uma única vez para renderizar miniaturas de várias páginas. */
export async function openPdfPages(file: File): Promise<PdfPageRenderer> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  let destroyed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const cache = new Map<string, Promise<string>>();

  return {
    pageCount: pdf.numPages,
    renderThumbnail(pageNumber, targetWidth = 240) {
      const key = `${pageNumber}@${targetWidth}`;
      let thumbnail = cache.get(key);
      if (!thumbnail) {
        thumbnail = queue.then(async () => {
          if (destroyed) throw new Error("O documento foi fechado.");
          return drawThumbnail(await pdf.getPage(pageNumber), targetWidth);
        });
        queue = thumbnail.catch(() => undefined);
        cache.set(key, thumbnail);
      }
      return thumbnail;
    },
    destroy() {
      destroyed = true;
      void pdf.destroy();
    },
  };
}

/** Miniatura (data URL JPEG) de uma imagem, já com a orientação EXIF aplicada pelo navegador. */
export async function renderImageThumbnail(file: File, targetWidth = 160): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, targetWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    bitmap.close();
  }
}
