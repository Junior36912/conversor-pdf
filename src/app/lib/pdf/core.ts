import {
  degrees,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setGraphicsState,
  StandardFonts,
} from "pdf-lib";
import type { PageRange } from "./ranges";
import { computePlacements, type WatermarkOptions } from "./watermark";

/** Erro ao abrir um dos PDFs de entrada; `index` aponta para o arquivo problemático. */
export class PdfLoadError extends Error {
  constructor(
    readonly index: number,
    cause: unknown,
  ) {
    super(
      cause instanceof Error ? cause.message : "Não foi possível ler o PDF.",
      { cause },
    );
    this.name = "PdfLoadError";
  }
}

/**
 * Mescla os PDFs, na ordem recebida, em um único documento.
 * Só deve rodar dentro do Web Worker (ver `lib/workers/pdf-worker.ts`).
 */
export async function mergePdfDocuments(
  buffers: ArrayBuffer[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const merged = await PDFDocument.create();

  for (const [index, buffer] of buffers.entries()) {
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(buffer);
    } catch (cause) {
      throw new PdfLoadError(index, cause);
    }

    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);

    onProgress?.(index + 1, buffers.length);
  }

  // pdf-lib sempre aloca um ArrayBuffer próprio (nunca SharedArrayBuffer),
  // então o estreitamento do tipo é seguro e permite transferir o buffer.
  return (await merged.save()) as Uint8Array<ArrayBuffer>;
}

/**
 * Gera um PDF para cada intervalo de páginas do documento de origem.
 * Só deve rodar dentro do Web Worker (ver `lib/workers/pdf-worker.ts`).
 */
export async function splitPdfDocument(
  buffer: ArrayBuffer,
  ranges: PageRange[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>[]> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(buffer);
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }

  const pageCount = source.getPageCount();
  const parts: Uint8Array<ArrayBuffer>[] = [];

  for (const [index, { from, to }] of ranges.entries()) {
    if (from < 1 || from > to || to > pageCount) {
      throw new RangeError(
        `Intervalo ${from}-${to} fora do documento (${pageCount} páginas).`,
      );
    }

    const part = await PDFDocument.create();
    const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
    for (const page of await part.copyPages(source, indices)) part.addPage(page);

    parts.push((await part.save()) as Uint8Array<ArrayBuffer>);
    onProgress?.(index + 1, ranges.length);
  }

  return parts;
}

/** Uma página de saída: qual página de origem usar e quanto girá-la (múltiplo de 90). */
export interface PageEdit {
  /** Página de origem, 1-based. */
  page: number;
  /** Rotação extra, em graus, no sentido horário. */
  rotation: number;
}

/**
 * Monta um novo PDF com as páginas na ordem informada, aplicando a rotação de cada uma.
 * Páginas ausentes da lista são excluídas.
 * Só deve rodar dentro do Web Worker (ver `lib/workers/pdf-worker.ts`).
 */
export async function organizePdfDocument(
  buffer: ArrayBuffer,
  edits: PageEdit[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(buffer);
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }

  const pageCount = source.getPageCount();
  if (edits.length === 0) throw new RangeError("Nenhuma página selecionada.");
  for (const { page } of edits) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new RangeError(`Página ${page} fora do documento (${pageCount} páginas).`);
    }
  }

  const output = await PDFDocument.create();
  const copied = await output.copyPages(
    source,
    edits.map(({ page }) => page - 1),
  );

  for (const [index, page] of copied.entries()) {
    const extra = ((edits[index].rotation % 360) + 360) % 360;
    if (extra !== 0) {
      page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    }
    output.addPage(page);
    onProgress?.(index + 1, copied.length);
  }

  return (await output.save()) as Uint8Array<ArrayBuffer>;
}

/**
 * Desenha um texto como marca d'água nas páginas escolhidas (centralizado ou em mosaico).
 * Só deve rodar dentro do Web Worker (ver `lib/workers/pdf-worker.ts`).
 */
export async function addTextWatermark(
  buffer: ArrayBuffer,
  { text, fontSize, color, opacity, rotation, layout, pages }: WatermarkOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffer);
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }

  const targets = new Set(pages.filter((page) => page >= 1 && page <= doc.getPageCount()));
  if (targets.size === 0) throw new RangeError("Nenhuma página válida para a marca d'água.");

  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textColor = rgb(color.r, color.g, color.b);

  // Um único ExtGState compartilhado: pdf-lib criaria um novo a cada drawText com `opacity`.
  const opacityState = doc.context.register(
    doc.context.obj({ Type: "ExtGState", ca: opacity, CA: opacity }),
  );

  let done = 0;
  for (const [index, page] of doc.getPages().entries()) {
    if (!targets.has(index + 1)) continue;

    // Em páginas com /Rotate, o conteúdo é girado na exibição; compensamos para que o
    // texto apareça com a rotação pedida, como o usuário vê a página.
    const angle = rotation + page.getRotation().angle;
    const placements = computePlacements(page.getCropBox(), textWidth, fontSize, angle, layout);

    page.pushOperators(
      pushGraphicsState(),
      setGraphicsState(page.node.newExtGState("GSWatermark", opacityState)),
    );
    for (const { x, y } of placements) {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: textColor,
        rotate: degrees(angle),
      });
    }
    page.pushOperators(popGraphicsState());

    onProgress?.(++done, targets.size);
  }

  return (await doc.save()) as Uint8Array<ArrayBuffer>;
}
