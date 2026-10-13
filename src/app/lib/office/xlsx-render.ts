import ExcelJS from "exceljs";
import ssf from "ssf";
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import { PdfLoadError } from "../pdf/core";
import { embedUnicodeFonts, type UnicodeFonts } from "../pdf/fonts";
import { EMPTY_WORKBOOK, WORKBOOK_TOO_LARGE } from "../workers/error-codes";

export interface XlsxToPdfOptions {
  pageSize: "a4" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  /** Reduz a planilha (até 50%) para caber na largura da página. */
  fitWidth: boolean;
  /** Desenha as linhas de grade da planilha. */
  gridlines: boolean;
  /** Separadores dos números: "1.234,56" (comma) ou "1,234.56" (dot). */
  decimal: "comma" | "dot";
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN = 28;
const MIN_SCALE = 0.5;
const MAX_ROWS = 10_000;
const DEFAULT_COLUMN_CHARS = 8.43;
const DEFAULT_ROW_HEIGHT = 15;
const DEFAULT_FONT_SIZE = 11;
const PADDING = 2;
const LINE_HEIGHT = 1.25;

// ───────────────────────── cores ─────────────────────────

// Paleta padrão de temas do Office (índices de tema usados pelo Excel).
const THEME_COLORS = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

function tint(channel: number, amount: number): number {
  return Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
}

function toColor(color: Partial<ExcelJS.Color> | undefined): Color | undefined {
  if (!color) return undefined;
  let hex: string | undefined;
  if (color.argb) hex = color.argb.slice(-6);
  else if (color.theme !== undefined) hex = THEME_COLORS[color.theme];
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return undefined;

  const amount = (color as { tint?: number }).tint ?? 0;
  const value = parseInt(hex, 16);
  const channel = (shift: number) => tint((value >> shift) & 0xff, amount) / 255;
  return rgb(channel(16), channel(8), channel(0));
}

// ───────────────────────── valores e formatos ─────────────────────────

interface Resolved {
  text: string;
  /** Números e datas alinham à direita por padrão; texto à esquerda; booleanos/erros ao centro. */
  kind: "empty" | "text" | "number" | "boolean" | "error";
}

const EXCEL_EPOCH_OFFSET = 25569; // dias entre 1899-12-30 e 1970-01-01

function swapSeparators(text: string): string {
  return text.replace(/[.,]/g, (char) => (char === "." ? "," : "."));
}

function formatNumber(value: number, format: string | undefined, decimal: "comma" | "dot"): string {
  const pattern = format && format !== "General" ? format : "General";
  let text: string;
  try {
    text = ssf.format(pattern, value);
  } catch {
    text = String(value);
  }
  // O arquivo guarda formatos neutros (#,##0.00); o separador exibido depende do idioma de quem abre.
  const isDate = pattern !== "General" && ssf.is_date(pattern);
  const numericOnly = /^[\s\d.,+\-()%$€£R]+$/.test(text);
  return decimal === "comma" && !isDate && numericOnly ? swapSeparators(text) : text;
}

function resolveValue(cell: ExcelJS.Cell, decimal: "comma" | "dot"): Resolved {
  let value: ExcelJS.CellValue | undefined = cell.value;
  if (value === null || value === undefined) return { text: "", kind: "empty" };

  if (typeof value === "object" && !(value instanceof Date)) {
    if ("richText" in value) {
      return { text: value.richText.map((part) => part.text).join(""), kind: "text" };
    }
    if ("error" in value) return { text: String(value.error), kind: "error" };
    if ("hyperlink" in value) return { text: String(value.text ?? value.hyperlink), kind: "text" };
    if ("formula" in value || "sharedFormula" in value) {
      value = (value as { result?: ExcelJS.CellValue }).result ?? null;
      if (value === null || value === undefined) return { text: "", kind: "empty" };
      if (typeof value === "object" && !(value instanceof Date)) {
        return "error" in value ? { text: String(value.error), kind: "error" } : { text: "", kind: "empty" };
      }
    }
  }

  if (value instanceof Date) {
    const serial = value.getTime() / 86_400_000 + EXCEL_EPOCH_OFFSET;
    const format = cell.numFmt && ssf.is_date(cell.numFmt) ? cell.numFmt : "dd/mm/yyyy";
    return { text: ssf.format(format, serial), kind: "number" };
  }
  if (typeof value === "number") return { text: formatNumber(value, cell.numFmt, decimal), kind: "number" };
  if (typeof value === "boolean") return { text: value ? "VERDADEIRO" : "FALSO", kind: "boolean" };
  return { text: String(value), kind: "text" };
}

// ───────────────────────── estrutura da planilha ─────────────────────────

interface CellInfo {
  cell: ExcelJS.Cell;
  resolved: Resolved;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: Color;
  fill?: Color;
  wrap: boolean;
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
  borders: { side: "top" | "bottom" | "left" | "right"; width: number; color: Color }[];
  /** Para células mescladas: quantas linhas/colunas cobre (a partir desta). */
  rowSpan: number;
  colSpan: number;
  lines?: string[];
}

interface Grid {
  colWidths: number[]; // índice 1..C (0 não usado)
  rowHeights: number[]; // índice 1..R
  cells: Map<number, CellInfo>; // chave: row * 1_000_000 + col
  /** Posições (row/col) cobertas por uma mesclagem cujo "mestre" é outra célula. */
  covered: Set<number>;
  rows: number;
  cols: number;
}

const key = (row: number, col: number) => row * 1_000_000 + col;

function columnNumber(letters: string): number {
  return [...letters.toUpperCase()].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0);
}

function parseRange(range: string): { top: number; left: number; bottom: number; right: number } | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range);
  if (!match) return null;
  return {
    left: columnNumber(match[1]),
    top: Number(match[2]),
    right: columnNumber(match[3]),
    bottom: Number(match[4]),
  };
}

const BORDER_WIDTH: Record<string, number> = { hair: 0.25, thin: 0.5, dotted: 0.5, dashed: 0.5, medium: 1.2, thick: 2, double: 1.5 };

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (line !== "" && font.widthOfTextAtSize(candidate.trimEnd(), size) > width) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function buildGrid(ws: ExcelJS.Worksheet, fonts: UnicodeFonts, decimal: "comma" | "dot"): Grid | null {
  let maxRow = 0;
  let maxCol = 0;
  const infos = new Map<number, CellInfo>();

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const resolved = resolveValue(cell, decimal);
      const fill =
        cell.fill?.type === "pattern" && cell.fill.pattern === "solid" ? toColor(cell.fill.fgColor) : undefined;
      const borders: CellInfo["borders"] = [];
      for (const side of ["top", "bottom", "left", "right"] as const) {
        const border = cell.border?.[side];
        if (border?.style) {
          borders.push({
            side,
            width: BORDER_WIDTH[border.style] ?? 0.5,
            color: toColor(border.color) ?? rgb(0, 0, 0),
          });
        }
      }
      if (resolved.kind === "empty" && !fill && borders.length === 0) return;

      const alignment = cell.alignment ?? {};
      const horizontal =
        alignment.horizontal === "center" || alignment.horizontal === "centerContinuous"
          ? "center"
          : alignment.horizontal === "right"
            ? "right"
            : alignment.horizontal === "left"
              ? "left"
              : resolved.kind === "number"
                ? "right"
                : resolved.kind === "boolean" || resolved.kind === "error"
                  ? "center"
                  : "left";

      infos.set(key(rowNumber, colNumber), {
        cell,
        resolved: { ...resolved, text: fonts.sanitize(resolved.text) },
        fontSize: cell.font?.size ?? DEFAULT_FONT_SIZE,
        bold: Boolean(cell.font?.bold),
        italic: Boolean(cell.font?.italic),
        color: toColor(cell.font?.color) ?? rgb(0, 0, 0),
        fill,
        wrap: Boolean(alignment.wrapText),
        horizontal,
        vertical: alignment.vertical === "top" ? "top" : alignment.vertical === "middle" ? "middle" : "bottom",
        borders,
        rowSpan: 1,
        colSpan: 1,
      });
      maxRow = Math.max(maxRow, rowNumber);
      maxCol = Math.max(maxCol, colNumber);
    });
  });

  if (infos.size === 0) return null;
  if (maxRow > MAX_ROWS) throw new Error(WORKBOOK_TOO_LARGE);

  // Mesclagens: a célula-mestre cobre o retângulo; as demais posições ficam "cobertas".
  const covered = new Set<number>();
  for (const merge of ws.model.merges ?? []) {
    const range = parseRange(merge);
    if (!range) continue;
    const master = infos.get(key(range.top, range.left));
    if (master) {
      master.rowSpan = range.bottom - range.top + 1;
      master.colSpan = range.right - range.left + 1;
    }
    for (let r = range.top; r <= range.bottom; r++) {
      for (let c = range.left; c <= range.right; c++) {
        if (r !== range.top || c !== range.left) covered.add(key(r, c));
      }
    }
    maxRow = Math.max(maxRow, range.bottom <= MAX_ROWS ? range.bottom : maxRow);
    maxCol = Math.max(maxCol, range.right);
  }

  const defaultColWidth = ws.properties.defaultColWidth ?? DEFAULT_COLUMN_CHARS;
  const colWidths = [0];
  for (let c = 1; c <= maxCol; c++) {
    const column = ws.getColumn(c);
    const chars = column.width ?? defaultColWidth;
    colWidths.push(column.hidden ? 0 : Math.round(chars * 7 + 5) * 0.75);
  }

  const defaultRowHeight = ws.properties.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;
  const rowHeights = [0];
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    if (row.hidden) {
      rowHeights.push(0);
      continue;
    }
    let height = row.height ?? defaultRowHeight;
    if (row.height === undefined) {
      // Linhas sem altura fixa crescem para caber o texto com quebra automática.
      for (let c = 1; c <= maxCol; c++) {
        const info = infos.get(key(r, c));
        if (!info?.wrap || info.resolved.text === "") continue;
        let width = 0;
        for (let k = 0; k < info.colSpan; k++) width += colWidths[c + k] ?? 0;
        info.lines = wrapText(info.resolved.text, fonts.pick(info.bold, info.italic), info.fontSize, width - 2 * PADDING);
        if (info.rowSpan === 1) {
          height = Math.max(height, info.lines.length * info.fontSize * LINE_HEIGHT + 2 * PADDING);
        }
      }
    }
    rowHeights.push(height);
  }

  return { colWidths, rowHeights, cells: infos, covered, rows: maxRow, cols: maxCol };
}

// ───────────────────────── paginação e desenho ─────────────────────────

function groupsBy(sizes: number[], limit: number): [number, number][] {
  // Agrupa índices 1..n em faixas cuja soma de tamanhos cabe em `limit` (ao menos 1 por faixa).
  const groups: [number, number][] = [];
  let start = 1;
  let sum = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (sum + sizes[i] > limit && i > start) {
      groups.push([start, i - 1]);
      start = i;
      sum = 0;
    }
    sum += sizes[i];
  }
  groups.push([start, sizes.length - 1]);
  return groups;
}

const total = (sizes: number[], from: number, to: number) => {
  let sum = 0;
  for (let i = from; i <= to; i++) sum += sizes[i];
  return sum;
};

function fitText(text: string, font: PDFFont, size: number, width: number, numeric: boolean): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  if (numeric) {
    // Como o Excel, números que não cabem viram "####".
    const hash = font.widthOfTextAtSize("#", size);
    return "#".repeat(Math.max(1, Math.floor(width / hash)));
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid), size) <= width) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low);
}

interface Chunk {
  colFrom: number;
  colTo: number;
  rowFrom: number;
  rowTo: number;
}

function drawChunk(
  page: PDFPage,
  grid: Grid,
  fonts: UnicodeFonts,
  chunk: Chunk,
  scale: number,
  pageHeight: number,
  gridlines: boolean,
) {
  const colX = (c: number) => MARGIN + total(grid.colWidths, chunk.colFrom, c - 1) * scale;
  const rowY = (r: number) => pageHeight - MARGIN - total(grid.rowHeights, chunk.rowFrom, r - 1) * scale;
  const spanWidth = (c: number, span: number) =>
    total(grid.colWidths, c, Math.min(c + span - 1, chunk.colTo)) * scale;
  const spanHeight = (r: number, span: number) =>
    total(grid.rowHeights, r, Math.min(r + span - 1, chunk.rowTo)) * scale;

  const visible = (r: number, c: number) => grid.rowHeights[r] > 0 && grid.colWidths[c] > 0;

  // 1) fundo e linhas de grade
  for (let r = chunk.rowFrom; r <= chunk.rowTo; r++) {
    for (let c = chunk.colFrom; c <= chunk.colTo; c++) {
      if (!visible(r, c) || grid.covered.has(key(r, c))) continue;
      const info = grid.cells.get(key(r, c));
      const x = colX(c);
      const w = spanWidth(c, info?.colSpan ?? 1);
      const h = spanHeight(r, info?.rowSpan ?? 1);
      const y = rowY(r) - h;
      if (info?.fill) page.drawRectangle({ x, y, width: w, height: h, color: info.fill });
      if (gridlines) {
        page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.25 });
      }
    }
  }

  // 2) bordas e texto
  for (let r = chunk.rowFrom; r <= chunk.rowTo; r++) {
    for (let c = chunk.colFrom; c <= chunk.colTo; c++) {
      if (!visible(r, c) || grid.covered.has(key(r, c))) continue;
      const info = grid.cells.get(key(r, c));
      if (!info) continue;

      const x = colX(c);
      const w = spanWidth(c, info.colSpan);
      const h = spanHeight(r, info.rowSpan);
      const top = rowY(r);
      const bottom = top - h;

      for (const border of info.borders) {
        const [from, to] = {
          top: [{ x, y: top }, { x: x + w, y: top }],
          bottom: [{ x, y: bottom }, { x: x + w, y: bottom }],
          left: [{ x, y: bottom }, { x, y: top }],
          right: [{ x: x + w, y: bottom }, { x: x + w, y: top }],
        }[border.side];
        page.drawLine({ start: from, end: to, thickness: Math.max(0.2, border.width * scale), color: border.color });
      }

      const text = info.resolved.text;
      if (text === "") continue;
      const font = fonts.pick(info.bold, info.italic);
      const size = info.fontSize * scale;
      const pad = PADDING * scale;
      const lineHeight = size * LINE_HEIGHT;

      const lines = info.wrap ? (info.lines ?? wrapText(text, font, info.fontSize, w / scale - 2 * PADDING)) : [text];
      const blockHeight = lines.length * lineHeight;
      const firstBaseline =
        info.vertical === "top"
          ? top - pad - size
          : info.vertical === "middle"
            ? top - (h - blockHeight) / 2 - size
            : bottom + pad + (lines.length - 1) * lineHeight + size * 0.22;

      lines.forEach((line, index) => {
        // Texto sem quebra pode "vazar" para células vizinhas vazias, como no Excel.
        let available = w - 2 * pad;
        if (!info.wrap && info.colSpan === 1 && info.horizontal === "left") {
          for (let next = c + 1; next <= chunk.colTo; next++) {
            if (grid.cells.get(key(r, next))?.resolved.text) break;
            available += grid.colWidths[next] * scale;
          }
        }
        const shown = fitText(line, font, size, available, info.resolved.kind === "number");
        const width = font.widthOfTextAtSize(shown, size);
        const textX =
          info.horizontal === "right"
            ? x + w - pad - width
            : info.horizontal === "center"
              ? x + (w - width) / 2
              : x + pad;
        page.drawText(shown, { x: textX, y: firstBaseline - index * lineHeight, size, font, color: info.color });
      });
    }
  }
}

function renderSheet(pdf: PDFDocument, fonts: UnicodeFonts, grid: Grid, options: XlsxToPdfOptions) {
  const [base, long] = PAGE_SIZES[options.pageSize];
  const sheetWidth = total(grid.colWidths, 1, grid.cols);

  const scaleFor = (pageWidth: number) =>
    options.fitWidth ? Math.max(MIN_SCALE, Math.min(1, (pageWidth - 2 * MARGIN) / sheetWidth)) : 1;
  const landscape =
    options.orientation === "landscape" ||
    (options.orientation === "auto" && scaleFor(long) > scaleFor(base) + 0.05);
  const [pageWidth, pageHeight] = landscape ? [long, base] : [base, long];
  const scale = scaleFor(pageWidth);

  const colGroups = groupsBy(grid.colWidths, (pageWidth - 2 * MARGIN) / scale);
  const rowGroups = groupsBy(grid.rowHeights, (pageHeight - 2 * MARGIN) / scale);

  // Ordem do Excel: desce pela faixa de colunas e só então avança para a próxima.
  for (const [colFrom, colTo] of colGroups) {
    for (const [rowFrom, rowTo] of rowGroups) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      drawChunk(page, grid, fonts, { colFrom, colTo, rowFrom, rowTo }, scale, pageHeight, options.gridlines);
    }
  }
}

/**
 * Converte um .xlsx em PDF: uma ou mais páginas por planilha visível, com preenchimentos, bordas,
 * negrito, cores, mesclagens, formatos de número e datas. Gráficos e imagens não são desenhados.
 * Só deve rodar dentro do Web Worker.
 */
export async function xlsxToPdf(
  buffer: ArrayBuffer,
  options: XlsxToPdfOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (cause) {
    throw new PdfLoadError(0, cause);
  }

  const pdf = await PDFDocument.create();
  const fonts = await embedUnicodeFonts(pdf);
  const sheets = workbook.worksheets.filter((sheet) => sheet.state === "visible");

  let drawn = 0;
  for (const [index, sheet] of sheets.entries()) {
    const grid = buildGrid(sheet, fonts, options.decimal);
    if (grid) {
      renderSheet(pdf, fonts, grid, options);
      drawn++;
    }
    onProgress?.(index + 1, sheets.length);
  }
  if (drawn === 0) throw new Error(EMPTY_WORKBOOK);

  return (await pdf.save()) as Uint8Array<ArrayBuffer>;
}
