import { PDFDocument } from "pdf-lib";
import { PdfLoadError } from "../../pdf/core";
import { embedUnicodeFonts, type FontFamily } from "../../pdf/fonts";
import { NO_SLIDES } from "../../workers/error-codes";
import { drawDeck } from "./draw";
import { readPptx, type Deck } from "./model";

function familiesUsed(deck: Deck): Set<FontFamily> {
  const families = new Set<FontFamily>();
  const visit = (paragraphs: { runs: { family: FontFamily }[]; bullet?: { family: FontFamily } }[]) => {
    for (const paragraph of paragraphs) {
      for (const run of paragraph.runs) families.add(run.family);
      if (paragraph.bullet) families.add(paragraph.bullet.family);
    }
  };
  for (const slide of deck.slides) {
    for (const item of slide.items) {
      if (item.kind === "shape" && item.text) visit(item.text.paragraphs);
      if (item.kind === "table") for (const row of item.rows) for (const cell of row.cells) visit(cell.text.paragraphs);
    }
  }
  return families;
}

/**
 * Converte um .pptx em PDF vetorial (texto selecionável): uma página por slide visível, com
 * formas, imagens, tabelas e a herança de estilos do tema/mestre/layout. Gráficos, SmartArt,
 * animações e transições não são reproduzidos; degradês viram cor sólida.
 * Só deve rodar dentro do Web Worker.
 */
export async function pptxToPdf(
  buffer: ArrayBuffer,
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let deck: Deck;
  try {
    deck = readPptx(new Uint8Array(buffer));
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }
  if (deck.slides.length === 0) throw new Error(NO_SLIDES);

  const pdf = await PDFDocument.create();
  const fonts = await embedUnicodeFonts(pdf, familiesUsed(deck));
  await drawDeck(pdf, fonts, deck, onProgress);
  return (await pdf.save()) as Uint8Array<ArrayBuffer>;
}
