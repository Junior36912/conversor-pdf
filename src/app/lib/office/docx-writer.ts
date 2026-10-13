import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type {
  AnalyzedPage,
  FontFamily,
  ParagraphBlock,
  Run,
  TableBlock,
} from "../pdf/analyze-layout";

export interface DocxOptions {
  /** Começa cada página do PDF em uma página nova do Word. */
  pageBreaks: boolean;
}

const FONTS: Record<FontFamily, string> = {
  sans: "Arial",
  serif: "Times New Roman",
  mono: "Courier New",
};
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;

const TWIPS_PER_POINT = 20;
const MARGIN_TWIPS = 1200; // ~0,83 pol
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" } as const;
const CELL_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
};

function textRuns(runs: Run[], forceBold = false): ParagraphChild[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold || forceBold,
        italics: run.italic,
        size: Math.max(2, Math.round(run.fontSize * 2)), // meio-pontos
        font: FONTS[run.family],
      }),
  );
}

function paragraph(block: ParagraphBlock, pageBreakBefore: boolean): Paragraph {
  const isHeading = block.heading !== undefined;
  return new Paragraph({
    children: textRuns(block.runs, isHeading),
    heading: block.heading ? HEADINGS[block.heading - 1] : undefined,
    bullet: block.listMarker && /^[•·▪◦●○■□‣⁃–—*-]/.test(block.listMarker) ? { level: 0 } : undefined,
    alignment: block.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: isHeading ? 200 : 0, after: 120 },
    pageBreakBefore,
  });
}

function table(block: TableBlock, usableTwips: number): Table {
  const columns = block.columnEdges.length - 1;
  const raw = Array.from({ length: columns }, (_, i) => Math.max(1, block.columnEdges[i + 1] - block.columnEdges[i]));
  const total = raw.reduce((sum, width) => sum + width, 0);
  // Escala para caber na largura útil da página.
  const widths = raw.map((width) => Math.max(400, Math.round((width / total) * usableTwips)));

  return new Table({
    width: { size: widths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: block.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell, index) =>
              new TableCell({
                width: { size: widths[index], type: WidthType.DXA },
                borders: CELL_BORDERS,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    children: cell.runs.length > 0 ? textRuns(cell.runs) : [],
                    spacing: { after: 0 },
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

/** Monta o .docx a partir das páginas analisadas. */
export async function writeDocx(
  pages: AnalyzedPage[],
  { pageBreaks }: DocxOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const first = pages[0];
  const widthPt = first?.width ?? 595;
  const heightPt = first?.height ?? 842;
  const landscape = widthPt > heightPt;
  const pageWidth = Math.round(Math.min(widthPt, heightPt) * TWIPS_PER_POINT);
  const pageHeight = Math.round(Math.max(widthPt, heightPt) * TWIPS_PER_POINT);
  const usable = (landscape ? pageHeight : pageWidth) - 2 * MARGIN_TWIPS;

  const children: (Paragraph | Table)[] = [];
  for (const [pageIndex, page] of pages.entries()) {
    let needsBreak = pageBreaks && pageIndex > 0;
    for (const block of page.blocks) {
      if (block.kind === "paragraph") {
        children.push(paragraph(block, needsBreak));
      } else {
        // Tabela não aceita quebra de página própria: uma linha vazia antes carrega a quebra.
        if (needsBreak) children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0 } }));
        children.push(table(block, usable));
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
      needsBreak = false;
    }
  }
  if (children.length === 0) children.push(new Paragraph({}));

  const doc = new Document({
    creator: "PDFLocal",
    title: "Documento convertido de PDF",
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidth,
              height: pageHeight,
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children,
      },
    ],
  });

  return new Uint8Array(await Packer.toArrayBuffer(doc)) as Uint8Array<ArrayBuffer>;
}
