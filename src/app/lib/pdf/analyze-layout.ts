// Analisador de layout: transforma os itens de texto soltos do pdf.js (cada um com posição e fonte)
// em estrutura de documento: linhas, parágrafos, títulos, listas e tabelas. É puro (sem DOM nem
// pdf.js) e alimenta as conversões de PDF para Word, Excel e PowerPoint.
//
// Limitações assumidas: texto horizontal em uma coluna por vez (jornais em várias colunas
// intercalam), tabelas detectadas pelo alinhamento do texto (não pelas linhas desenhadas) e
// células com várias linhas viram várias linhas da tabela.

/** Item de texto bruto do pdf.js, já em coordenadas de tela (origem no canto superior esquerdo). */
export interface RawItem {
  text: string;
  /** Início horizontal do texto. */
  x: number;
  /** Posição vertical da linha de base, contada do topo da página. */
  y: number;
  width: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  /** Nome da fonte (ex.: "ABCDEF+Arial-BoldMT"); vazio se desconhecido. */
  font: string;
}

export interface RawPage {
  number: number;
  width: number;
  height: number;
  items: RawItem[];
}

export type FontFamily = "sans" | "serif" | "mono";

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  family: FontFamily;
}

export interface Segment {
  text: string;
  x0: number;
  x1: number;
  runs: Run[];
}

export interface Line {
  /** Linha de base, do topo da página. */
  y: number;
  x0: number;
  x1: number;
  fontSize: number;
  bold: boolean;
  text: string;
  segments: Segment[];
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ParagraphBlock extends Box {
  kind: "paragraph";
  text: string;
  runs: Run[];
  fontSize: number;
  bold: boolean;
  align: "left" | "center" | "right";
  /** 1 a 3 quando o parágrafo é um título. */
  heading?: 1 | 2 | 3;
  /** Marcador de lista (ex.: "•", "1.") quando o parágrafo é um item de lista. */
  listMarker?: string;
  lines: Line[];
}

export interface TableCell {
  text: string;
  runs: Run[];
  bold: boolean;
}

export interface TableBlock extends Box {
  kind: "table";
  rows: TableCell[][];
  /** Bordas verticais das colunas, de x0 a x1 (colunas + 1 valores). */
  columnEdges: number[];
  /** Linha de base de cada linha da tabela. */
  rowYs: number[];
  fontSize: number;
}

export type Block = ParagraphBlock | TableBlock;

export interface AnalyzedPage {
  number: number;
  width: number;
  height: number;
  blocks: Block[];
}

export interface AnalyzeOptions {
  /** Remove cabeçalhos e rodapés que se repetem nas páginas (padrão: sim). */
  removeRepeated?: boolean;
}

// ───────────────────────── constantes de heurística ─────────────────────────
const SAME_LINE = 0.45; // fração do corpo da fonte para considerar a mesma linha
const SPACE_GAP = 0.15; // fração do corpo que justifica inserir um espaço
const SEGMENT_GAP = 1.0; // fração do corpo que separa colunas de uma mesma linha
const MIN_SEGMENT_GAP_PT = 7;
const PARAGRAPH_GAP = 1.7; // espaçamento vertical (× corpo) acima do qual começa novo parágrafo
const LIST_MARKER = /^(?:[•·▪◦●○■□‣⁃-]|[–—*]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+/;
const BULLET_ONLY = /^[•·▪◦●○■□‣⁃]$/;
// Segmento que é só um marcador (o texto do item vem em outro segmento, depois do recuo).
const MARKER_SEGMENT = /^(?:[•·▪◦●○■□‣⁃–—*-]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])$/;

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);

// ───────────────────────── linhas ─────────────────────────

/** Classifica a fonte do PDF em uma das três famílias que o Office tem em qualquer computador. */
export function familyOf(font: string): FontFamily {
  if (/courier|mono|consol|typewriter|code/i.test(font)) return "mono";
  if (/times|serif|georgia|garamond|palatino|cambria|bookman|minion/i.test(font) && !/sans/i.test(font)) {
    return "serif";
  }
  return "sans";
}

function toRun(item: RawItem, text: string): Run {
  return {
    text,
    bold: item.bold,
    italic: item.italic,
    fontSize: item.fontSize,
    family: familyOf(item.font),
  };
}

/** Junta runs vizinhos com o mesmo estilo. */
function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.family === run.family &&
      Math.abs(last.fontSize - run.fontSize) < 0.6
    ) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/** Agrupa os itens em linhas (mesma linha de base) e, em cada linha, em segmentos (colunas). */
export function buildLines(items: RawItem[]): Line[] {
  const words = items
    .filter((item) => item.text.trim() !== "" && item.fontSize > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const rows: RawItem[][] = [];
  for (const item of words) {
    const row = rows[rows.length - 1];
    const reference = row?.[0];
    if (row && reference && Math.abs(item.y - reference.y) <= SAME_LINE * Math.min(item.fontSize, reference.fontSize)) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const segments: Segment[] = [];
    let current: Segment | null = null;
    let previous: RawItem | null = null;

    for (const item of row) {
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      const segmentGap = Math.max(item.fontSize * SEGMENT_GAP, MIN_SEGMENT_GAP_PT);

      if (!current || gap > segmentGap) {
        current = { text: "", x0: item.x, x1: item.x + item.width, runs: [] };
        segments.push(current);
        current.runs.push(toRun(item, item.text));
        current.text = item.text;
      } else {
        const needsSpace =
          gap > item.fontSize * SPACE_GAP &&
          !isSpace(current.text[current.text.length - 1]) &&
          !isSpace(item.text[0]);
        const piece = (needsSpace ? " " : "") + item.text;
        current.text += piece;
        current.runs.push(toRun(item, piece));
        current.x1 = item.x + item.width;
      }
      previous = item;
    }

    for (const segment of segments) {
      segment.runs = mergeRuns(segment.runs);
      segment.text = segment.text.replace(/\s+/g, " ").trim();
    }

    // "•    Texto": o marcador e o texto ficam em segmentos separados por causa do recuo.
    // Funde-os para o item de lista não parecer uma tabela de duas colunas.
    if (segments.length >= 2 && MARKER_SEGMENT.test(segments[0].text)) {
      const [marker, text, ...rest] = segments;
      segments.splice(0, segments.length, {
        text: `${marker.text} ${text.text}`,
        x0: marker.x0,
        x1: text.x1,
        runs: mergeRuns([...marker.runs, { ...text.runs[0], text: ` ${text.runs[0].text}` }, ...text.runs.slice(1)]),
      }, ...rest);
    }

    const reference = row.reduce((best, item) => (item.text.length > best.text.length ? item : best), row[0]);
    return {
      y: row.reduce((sum, item) => sum + item.y, 0) / row.length,
      x0: row[0].x,
      x1: Math.max(...row.map((item) => item.x + item.width)),
      fontSize: reference.fontSize,
      bold: row.every((item) => item.bold),
      text: segments.map((segment) => segment.text).join(" "),
      segments,
    };
  });
}

// ───────────────────────── tabelas ─────────────────────────

interface Interval {
  from: number;
  to: number;
}

/** Une intervalos que se sobrepõem (perfil de projeção horizontal). */
function mergeIntervals(intervals: Interval[], tolerance: number): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.from <= last.to + tolerance) last.to = Math.max(last.to, interval.to);
    else merged.push({ ...interval });
  }
  return merged;
}

const centerOf = (segment: Segment) => (segment.x0 + segment.x1) / 2;
const insideColumn = (segment: Segment, column: Interval) =>
  centerOf(segment) >= column.from - 1 && centerOf(segment) <= column.to + 1;

/**
 * Cabeçalho alinhado à esquerda sobre números alinhados à direita não se sobrepõem na horizontal e
 * parecem duas colunas. Juntamos colunas vizinhas e próximas que nunca têm texto na mesma linha.
 */
function mergeStaggeredColumns(columns: Interval[], lines: Line[], fontSize: number): Interval[] {
  const result = columns.map((column) => ({ ...column }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < result.length - 1; i++) {
      const [left, right] = [result[i], result[i + 1]];
      if (right.from - left.to > fontSize * 3) continue;
      const bothInOneLine = lines.some(
        (line) =>
          line.segments.some((segment) => insideColumn(segment, left)) &&
          line.segments.some((segment) => insideColumn(segment, right)),
      );
      if (bothInOneLine) continue;
      result.splice(i, 2, { from: left.from, to: right.to });
      changed = true;
      break;
    }
  }
  return result;
}

function lineToRuns(segments: Segment[]): Run[] {
  const runs = segments.flatMap((segment, index) =>
    segment.runs.map((run, i) => (index > 0 && i === 0 ? { ...run, text: ` ${run.text}` } : run)),
  );
  return mergeRuns(runs);
}

/**
 * Tenta montar uma tabela com linhas consecutivas que têm 2+ segmentos. As colunas saem dos
 * "vãos" verticais que nenhuma linha atravessa, o que funciona para texto alinhado à esquerda,
 * à direita ou centralizado.
 */
function buildTable(lines: Line[]): TableBlock | null {
  if (lines.length < 2) return null;
  const fontSize = lines.reduce((sum, line) => sum + line.fontSize, 0) / lines.length;

  const intervals = lines.flatMap((line) => line.segments.map((s) => ({ from: s.x0, to: s.x1 })));
  const columns = mergeStaggeredColumns(
    mergeIntervals(intervals, Math.max(fontSize * 0.6, 4)),
    lines,
    fontSize,
  );
  if (columns.length < 2) return null;

  const columnOf = (segment: Segment): number => {
    const index = columns.findIndex((column) => insideColumn(segment, column));
    return index >= 0 ? index : 0;
  };

  const rows: TableCell[][] = lines.map((line) => {
    const cells: TableCell[] = columns.map(() => ({ text: "", runs: [], bold: false }));
    const buckets: Segment[][] = columns.map(() => []);
    for (const segment of line.segments) buckets[columnOf(segment)].push(segment);
    buckets.forEach((bucket, index) => {
      if (bucket.length === 0) return;
      const runs = lineToRuns(bucket);
      cells[index] = {
        text: runs.map((run) => run.text).join("").trim(),
        runs,
        bold: runs.length > 0 && runs.every((run) => run.bold),
      };
    });
    return cells;
  });

  // Uma "tabela" em que quase todas as linhas só preenchem 1 coluna é, na verdade, texto corrido.
  const filledRows = rows.filter((row) => row.filter((cell) => cell.text !== "").length >= 2).length;
  if (filledRows < Math.ceil(rows.length * 0.6)) return null;

  const x0 = columns[0].from;
  const x1 = columns[columns.length - 1].to;
  const edges = [x0];
  for (let i = 0; i < columns.length - 1; i++) edges.push((columns[i].to + columns[i + 1].from) / 2);
  edges.push(x1);

  return {
    kind: "table",
    rows,
    columnEdges: edges,
    rowYs: lines.map((line) => line.y),
    fontSize,
    x0,
    x1,
    y0: lines[0].y - lines[0].fontSize,
    y1: lines[lines.length - 1].y,
  };
}

// ───────────────────────── parágrafos ─────────────────────────

function lineRuns(line: Line): Run[] {
  return lineToRuns(line.segments);
}

function makeParagraph(lines: Line[], pageWidth: number, bodySize: number): ParagraphBlock {
  const fontSize = lines.reduce((sum, line) => sum + line.fontSize, 0) / lines.length;
  const runs = mergeRuns(
    lines.flatMap((line, index) =>
      lineRuns(line).map((run, i) => (index > 0 && i === 0 ? { ...run, text: ` ${run.text}` } : run)),
    ),
  );
  let text = runs.map((run) => run.text).join("").replace(/\s+/g, " ").trim();
  const bold = lines.every((line) => line.bold);
  const isShort = text.length < 120 && lines.length <= 3;
  const looksLikeTitle = fontSize >= bodySize * 1.12 || (bold && lines.length === 1 && text.length < 80);

  // Marcadores "•", "-", "–" são sempre lista. Numeração ("1.", "a)") só em texto comum:
  // em linhas grandes ou em negrito curto é numeração de seção ("1. Introdução"), isto é, título.
  let listMarker: string | undefined;
  const marker = LIST_MARKER.exec(text);
  if (marker) {
    const isBullet = /^[•·▪◦●○■□‣⁃–—*-]/.test(marker[0]);
    if (isBullet || !looksLikeTitle) {
      listMarker = marker[0].trim();
      text = text.slice(marker[0].length).trim();
      if (runs[0]) runs[0] = { ...runs[0], text: runs[0].text.replace(LIST_MARKER, "") };
    }
  }

  const x0 = Math.min(...lines.map((line) => line.x0));
  const x1 = Math.max(...lines.map((line) => line.x1));
  const align: ParagraphBlock["align"] =
    lines.length <= 3 && Math.abs(x0 - (pageWidth - x1)) < pageWidth * 0.04 && x0 > pageWidth * 0.12
      ? "center"
      : "left";

  let heading: ParagraphBlock["heading"];
  if (!listMarker && isShort) {
    if (fontSize >= bodySize * 1.75) heading = 1;
    else if (fontSize >= bodySize * 1.35) heading = 2;
    else if (fontSize >= bodySize * 1.12 || (bold && lines.length === 1 && text.length < 80 && fontSize >= bodySize * 0.99)) {
      heading = 3;
    }
  }

  return {
    kind: "paragraph",
    text,
    runs: runs.filter((run) => run.text !== ""),
    fontSize,
    bold,
    align,
    heading,
    listMarker,
    lines,
    x0,
    x1,
    y0: lines[0].y - lines[0].fontSize,
    y1: lines[lines.length - 1].y,
  };
}

/**
 * Divide as linhas restantes em parágrafos. Uma linha continua o parágrafo anterior se estiver
 * perto (espaçamento normal), no mesmo tamanho de fonte, alinhada à mesma margem e se a linha de
 * cima chegou perto da largura do texto em volta (linhas curtas fecham o parágrafo).
 */
function buildParagraphs(lines: Line[], pageWidth: number, bodySize: number): ParagraphBlock[] {
  // Largura de referência de cada linha: a maior linha que começa na mesma margem.
  const referenceWidth = (line: Line) =>
    Math.max(
      ...lines
        .filter((other) => Math.abs(other.x0 - line.x0) < line.fontSize * 2.2)
        .map((other) => other.x1 - other.x0),
    );

  const paragraphs: ParagraphBlock[] = [];
  let group: Line[] = [];
  const flush = () => {
    if (group.length > 0) paragraphs.push(makeParagraph(group, pageWidth, bodySize));
    group = [];
  };

  for (const line of lines) {
    const previous = group[group.length - 1];
    if (!previous) {
      group.push(line);
      continue;
    }

    const closeEnough = line.y - previous.y <= line.fontSize * PARAGRAPH_GAP;
    const sameSize = Math.abs(line.fontSize - previous.fontSize) < 0.8;
    const sameMargin = Math.abs(line.x0 - group[0].x0) < line.fontSize * 2.2;
    const previousEndedEarly = previous.x1 - previous.x0 < referenceWidth(previous) * 0.6;
    const startsListItem = LIST_MARKER.test(line.text) || BULLET_ONLY.test(line.text);

    if (closeEnough && sameSize && sameMargin && !previousEndedEarly && !startsListItem) {
      group.push(line);
    } else {
      flush();
      group.push(line);
    }
  }
  flush();
  return paragraphs;
}

// ───────────────────────── página e documento ─────────────────────────

function analyzePage(page: RawPage, bodySize: number): AnalyzedPage {
  const lines = buildLines(page.items);
  const blocks: Block[] = [];

  let index = 0;
  let loose: Line[] = [];
  const flushLoose = () => {
    if (loose.length > 0) blocks.push(...buildParagraphs(loose, page.width, bodySize));
    loose = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line.segments.length >= 2) {
      // Reúne linhas tabulares consecutivas (espaçadas como linhas de uma tabela).
      let end = index + 1;
      while (
        end < lines.length &&
        lines[end].segments.length >= 2 &&
        lines[end].y - lines[end - 1].y <= Math.max(lines[end].fontSize, lines[end - 1].fontSize) * 2.6
      ) {
        end++;
      }
      const table = buildTable(lines.slice(index, end));
      if (table) {
        flushLoose();
        blocks.push(table);
        index = end;
        continue;
      }
    }
    loose.push(line);
    index++;
  }
  flushLoose();

  blocks.sort((a, b) => a.y0 - b.y0);
  return { number: page.number, width: page.width, height: page.height, blocks };
}

/** Tamanho de fonte mais usado (por quantidade de caracteres): o "corpo" do texto. */
export function bodyFontSize(pages: RawPage[]): number {
  const weight = new Map<number, number>();
  for (const page of pages) {
    for (const item of page.items) {
      const size = Math.round(item.fontSize * 2) / 2;
      weight.set(size, (weight.get(size) ?? 0) + item.text.trim().length);
    }
  }
  let best = 11;
  let bestWeight = 0;
  for (const [size, count] of weight) {
    if (count > bestWeight) {
      best = size;
      bestWeight = count;
    }
  }
  return best;
}

const signature = (text: string) => text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/** Remove linhas de cabeçalho/rodapé que se repetem (ex.: "Página 3 de 10") em metade das páginas. */
function removeRepeatedMargins(pages: RawPage[]): RawPage[] {
  if (pages.length < 3) return pages;
  const counts = new Map<string, number>();
  const marginLines = pages.map((page) => {
    const top = page.height * 0.08;
    const bottom = page.height * 0.92;
    return buildLines(page.items).filter((line) => line.y <= top || line.y >= bottom);
  });
  for (const lines of marginLines) {
    for (const key of new Set(lines.map((line) => signature(line.text)))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const repeated = new Set([...counts].filter(([, count]) => count >= Math.max(3, pages.length * 0.5)).map(([key]) => key));
  if (repeated.size === 0) return pages;

  return pages.map((page, i) => {
    const drop = new Set(
      marginLines[i].filter((line) => repeated.has(signature(line.text))).map((line) => line.y),
    );
    if (drop.size === 0) return page;
    const dropLines = marginLines[i].filter((line) => drop.has(line.y));
    return {
      ...page,
      items: page.items.filter(
        (item) => !dropLines.some((line) => Math.abs(item.y - line.y) <= SAME_LINE * item.fontSize),
      ),
    };
  });
}

/** Analisa todas as páginas; devolve também o tamanho de fonte do corpo do texto. */
export function analyzeDocument(
  rawPages: RawPage[],
  { removeRepeated = true }: AnalyzeOptions = {},
): { pages: AnalyzedPage[]; bodySize: number } {
  const cleaned = removeRepeated ? removeRepeatedMargins(rawPages) : rawPages;
  const bodySize = bodyFontSize(cleaned);
  return { pages: cleaned.map((page) => analyzePage(page, bodySize)), bodySize };
}

/** Há texto suficiente para converter? (PDFs escaneados não têm.) */
export function hasText(pages: RawPage[]): boolean {
  return pages.some((page) => page.items.some((item) => item.text.trim() !== ""));
}
