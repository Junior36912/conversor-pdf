/** Intervalo de páginas, 1-based e inclusivo nas duas pontas. */
export interface PageRange {
  from: number;
  to: number;
}

export type ParseRangesResult =
  | { ok: true; ranges: PageRange[] }
  | { ok: false; error: string };

export const formatRange = ({ from, to }: PageRange): string =>
  from === to ? `${from}` : `${from}-${to}`;

/**
 * Interpreta entradas como "1-3, 5, 8-" (vírgula ou ponto e vírgula separam os
 * intervalos; "8-" vai até a última página). Cada intervalo vira um arquivo.
 */
export function parsePageRanges(
  input: string,
  pageCount: number,
): ParseRangesResult {
  const tokens = input
    .split(/[,;]/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: "Informe ao menos um intervalo, como 1-3, 5." };
  }

  const ranges: PageRange[] = [];
  for (const token of tokens) {
    const match = /^(\d+)(?:\s*-\s*(\d*))?$/.exec(token);
    if (!match) {
      return {
        ok: false,
        error: `"${token}" não é um intervalo válido. Use o formato 1-3, 5, 8-.`,
      };
    }

    const from = Number(match[1]);
    const to =
      match[2] === undefined ? from : match[2] === "" ? pageCount : Number(match[2]);

    if (from < 1 || to > pageCount) {
      return {
        ok: false,
        error: `"${token}" está fora do documento (páginas 1 a ${pageCount}).`,
      };
    }
    if (from > to) {
      return {
        ok: false,
        error: `Em "${token}", a primeira página é maior que a última.`,
      };
    }
    ranges.push({ from, to });
  }

  return { ok: true, ranges };
}

/** Divide `pageCount` páginas em blocos consecutivos de `size` páginas. */
export function chunkRanges(pageCount: number, size: number): PageRange[] {
  const ranges: PageRange[] = [];
  for (let from = 1; from <= pageCount; from += size) {
    ranges.push({ from, to: Math.min(from + size - 1, pageCount) });
  }
  return ranges;
}

/** Expande os intervalos em páginas individuais, sem repetições e na ordem informada. */
export function expandRanges(ranges: PageRange[]): number[] {
  const pages = new Set<number>();
  for (const { from, to } of ranges) {
    for (let page = from; page <= to; page++) pages.add(page);
  }
  return [...pages];
}

export type PagesMode = "all" | "custom";

export type PagesPlan =
  | { ok: true; pages: number[] }
  | { ok: false; error: string };

/** Resolve "todas as páginas" ou um texto de intervalos na lista final de páginas. */
export function selectPages(
  mode: PagesMode,
  input: string,
  pageCount: number,
): PagesPlan {
  if (mode === "all") {
    return { ok: true, pages: Array.from({ length: pageCount }, (_, i) => i + 1) };
  }
  const parsed = parsePageRanges(input, pageCount);
  return parsed.ok ? { ok: true, pages: expandRanges(parsed.ranges) } : parsed;
}
