import PptxGenJS from "pptxgenjs";
import type {
  AnalyzedPage,
  FontFamily,
  ParagraphBlock,
  Run,
  TableBlock,
} from "../pdf/analyze-layout";

const FONTS: Record<FontFamily, string> = {
  sans: "Arial",
  serif: "Times New Roman",
  mono: "Courier New",
};
const PT_PER_INCH = 72;

/** Página renderizada como imagem JPEG (modo "fiel"). */
export interface PageImage {
  width: number;
  height: number;
  jpeg: ArrayBuffer;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function save(pptx: PptxGenJS): Promise<Uint8Array<ArrayBuffer>> {
  const output = await pptx.write({ outputType: "uint8array" });
  return output as Uint8Array<ArrayBuffer>;
}

function newPresentation(widthPt: number, heightPt: number): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.author = "PDFLocal";
  pptx.title = "Apresentação convertida de PDF";
  pptx.defineLayout({ name: "PDF", width: widthPt / PT_PER_INCH, height: heightPt / PT_PER_INCH });
  pptx.layout = "PDF";
  return pptx;
}

/** Modo fiel: cada página do PDF vira um slide com a imagem da página (não editável). */
export async function writePptxFromImages(pages: PageImage[]): Promise<Uint8Array<ArrayBuffer>> {
  const first = pages[0];
  const pptx = newPresentation(first?.width ?? 960, first?.height ?? 540);
  const layoutW = (first?.width ?? 960) / PT_PER_INCH;
  const layoutH = (first?.height ?? 540) / PT_PER_INCH;

  for (const page of pages) {
    const slide = pptx.addSlide();
    // Páginas de tamanho diferente da primeira são ajustadas sem distorcer.
    const scale = Math.min(layoutW / (page.width / PT_PER_INCH), layoutH / (page.height / PT_PER_INCH));
    const w = (page.width / PT_PER_INCH) * scale;
    const h = (page.height / PT_PER_INCH) * scale;
    slide.addImage({
      data: `image/jpeg;base64,${toBase64(page.jpeg)}`,
      x: (layoutW - w) / 2,
      y: (layoutH - h) / 2,
      w,
      h,
    });
  }
  return save(pptx);
}

const textOptions = (run: Run) => ({
  bold: run.bold,
  italic: run.italic,
  fontSize: Math.max(6, Math.round(run.fontSize * 10) / 10),
  fontFace: FONTS[run.family],
  color: "000000",
});

function addParagraph(slide: PptxGenJS.Slide, block: ParagraphBlock, scale: number) {
  const isBullet = block.listMarker !== undefined && /^[•·▪◦●○■□‣⁃–—*-]/.test(block.listMarker);
  const runs = block.runs.map((run, index) => ({
    text: run.text,
    options: {
      ...textOptions(run),
      bold: run.bold || block.heading !== undefined,
      ...(index === 0 && isBullet ? { bullet: true } : {}),
    },
  }));
  if (runs.length === 0) return;

  slide.addText(runs, {
    x: (block.x0 * scale) / PT_PER_INCH,
    y: (block.y0 * scale) / PT_PER_INCH,
    // Folga de 6%: a fonte do PowerPoint é diferente da do PDF e uma quebra a mais empurra o texto.
    w: (((block.x1 - block.x0) * 1.06 + 4) * scale) / PT_PER_INCH,
    h: ((block.y1 - block.y0 + block.fontSize * 0.45) * scale) / PT_PER_INCH,
    margin: 0,
    valign: "top",
    align: block.align === "center" ? "center" : "left",
    fit: "none",
    wrap: true,
  });
}

function addTable(slide: PptxGenJS.Slide, block: TableBlock, scale: number) {
  const colW = block.columnEdges
    .slice(1)
    .map((edge, i) => ((edge - block.columnEdges[i]) * scale) / PT_PER_INCH);
  const fontSize = Math.max(6, Math.round(block.fontSize * 10) / 10);

  slide.addTable(
    block.rows.map((row) =>
      row.map((cell) => ({
        text: cell.text,
        options: { bold: cell.bold, fontSize, fontFace: FONTS.sans, color: "000000", valign: "middle" as const },
      })),
    ),
    {
      x: (block.x0 * scale) / PT_PER_INCH,
      y: (block.y0 * scale) / PT_PER_INCH,
      colW,
      border: { type: "solid", color: "BFBFBF", pt: 0.5 },
      margin: 0.04,
    },
  );
}

/** Modo editável: texto e tabelas viram caixas de texto e tabelas nas posições originais. */
export async function writePptxFromText(pages: AnalyzedPage[]): Promise<Uint8Array<ArrayBuffer>> {
  const first = pages[0];
  const layoutW = first?.width ?? 960;
  const layoutH = first?.height ?? 540;
  const pptx = newPresentation(layoutW, layoutH);

  for (const page of pages) {
    const slide = pptx.addSlide();
    const scale = Math.min(layoutW / page.width, layoutH / page.height);
    for (const block of page.blocks) {
      if (block.kind === "paragraph") addParagraph(slide, block, scale);
      else addTable(slide, block, scale);
    }
  }
  return save(pptx);
}
