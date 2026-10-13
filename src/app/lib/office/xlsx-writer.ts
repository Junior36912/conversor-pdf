import ExcelJS from "exceljs";
import type { AnalyzedPage, Block, Run } from "../pdf/analyze-layout";
import { NO_TABLES } from "../workers/error-codes";
import { parseNumber, type DecimalSeparator } from "./numbers";

export interface XlsxOptions {
  /** Uma planilha por página do PDF; senão, tudo em uma só. */
  perPage: boolean;
  /** Inclui o texto que não faz parte de tabelas. */
  includeText: boolean;
  /** Converte textos como "1.234,56" em números. */
  convertNumbers: boolean;
  decimal: DecimalSeparator;
}


const MIN_COLUMN = 8;
const MAX_COLUMN = 60;

const isBold = (runs: Run[]) => runs.length > 0 && runs.every((run) => run.bold);

class Sheet {
  private row = 1;
  private readonly widths: number[] = [];

  constructor(readonly sheet: ExcelJS.Worksheet) {}

  private gap() {
    if (this.row > 1) this.row++;
  }

  text(text: string, bold: boolean, size: number) {
    this.gap();
    const cell = this.sheet.getCell(this.row, 1);
    cell.value = text;
    cell.font = { bold, size: Math.max(8, Math.round(size)), name: "Arial" };
    this.row++;
  }

  table(rows: { text: string; bold: boolean }[][], options: XlsxOptions) {
    this.gap();
    for (const cells of rows) {
      cells.forEach((cell, index) => {
        if (cell.text === "") return;
        const target = this.sheet.getCell(this.row, index + 1);
        const parsed = options.convertNumbers ? parseNumber(cell.text, options.decimal) : null;
        if (parsed) {
          target.value = parsed.value;
          target.numFmt = parsed.numFmt;
          target.alignment = { horizontal: "right" };
        } else {
          target.value = cell.text;
        }
        if (cell.bold) target.font = { bold: true, name: "Arial" };
        this.widths[index] = Math.max(this.widths[index] ?? 0, cell.text.length);
      });
      this.row++;
    }
  }

  finish() {
    if (this.widths.length === 0) {
      this.sheet.getColumn(1).width = 100;
      return;
    }
    this.widths.forEach((chars, index) => {
      this.sheet.getColumn(index + 1).width = Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, chars + 2));
    });
  }
}

function addBlock(target: Sheet, block: Block, options: XlsxOptions): boolean {
  if (block.kind === "table") {
    target.table(
      block.rows.map((row) => row.map((cell) => ({ text: cell.text, bold: cell.bold }))),
      options,
    );
    return true;
  }
  if (options.includeText && block.text) {
    target.text(
      block.listMarker ? `${block.listMarker} ${block.text}` : block.text,
      block.heading !== undefined || isBold(block.runs),
      block.fontSize,
    );
  }
  return false;
}

/** Monta o .xlsx: tabelas viram células; o texto restante vai para a coluna A. */
export async function writeXlsx(
  pages: AnalyzedPage[],
  options: XlsxOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PDFLocal";

  const sheets: Sheet[] = [];
  let tables = 0;
  let shared: Sheet | null = null;

  for (const page of pages) {
    let target: Sheet;
    if (options.perPage) {
      target = new Sheet(workbook.addWorksheet(`Página ${page.number}`));
      sheets.push(target);
    } else {
      if (!shared) {
        shared = new Sheet(workbook.addWorksheet("Dados"));
        sheets.push(shared);
      }
      target = shared;
    }
    for (const block of page.blocks) if (addBlock(target, block, options)) tables++;
  }

  if (tables === 0 && !options.includeText) throw new Error(NO_TABLES);
  for (const sheet of sheets) sheet.finish();

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer) as Uint8Array<ArrayBuffer>;
}
