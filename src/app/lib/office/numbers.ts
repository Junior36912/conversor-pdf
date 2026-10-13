export type DecimalSeparator = "comma" | "dot";

export interface ParsedNumber {
  value: number;
  /** Formato de célula do Excel que reproduz a aparência do texto original. */
  numFmt: string;
}

const CURRENCY = /^(?:R\$|US\$|\$|€|£)\s*/;

/**
 * Reconhece números escritos em texto ("1.234,56", "R$ 98,50", "+5%", "1,234.56") e devolve o valor.
 * Textos que só parecem números (CEP "01310-100", códigos com zero à esquerda, datas) não são
 * convertidos. `decimal` define qual separador é o decimal quando o texto é ambíguo ("1.234").
 */
export function parseNumber(text: string, decimal: DecimalSeparator): ParsedNumber | null {
  let t = text.trim();
  if (t === "") return null;

  const percent = t.endsWith("%");
  if (percent) t = t.slice(0, -1).trim();
  t = t.replace(CURRENCY, "").trim();

  const sign = /^[+-]/.test(t) ? (t[0] === "-" ? -1 : 1) : 1;
  const unsigned = t.replace(/^[+-]\s*/, "");
  // Parênteses contábeis: (1.234,00) é negativo.
  const accounting = /^\(.*\)$/.test(unsigned);
  const body = accounting ? unsigned.slice(1, -1) : unsigned;

  const thousand = decimal === "comma" ? "." : ",";
  const dec = decimal === "comma" ? "," : ".";
  const escapedThousand = thousand === "." ? "\\." : ",";
  const escapedDec = dec === "." ? "\\." : ",";

  const grouped = new RegExp(`^\\d{1,3}(?:${escapedThousand}\\d{3})+(?:${escapedDec}\\d+)?$`);
  const plain = new RegExp(`^\\d+(?:${escapedDec}\\d+)?$`);

  let normalized: string;
  let usedGrouping = false;
  if (grouped.test(body)) {
    normalized = body.split(thousand).join("").replace(dec, ".");
    usedGrouping = true;
  } else if (plain.test(body)) {
    // Zero à esquerda ("007", "0123") e números enormes são códigos, não quantidades.
    if (/^0\d/.test(body) || body.replace(/\D/g, "").length > 15) return null;
    normalized = body.replace(dec, ".");
  } else {
    return null;
  }

  let value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  value *= sign * (accounting ? -1 : 1);

  const decimals = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  if (percent) {
    value /= 100;
    return { value, numFmt: decimals > 0 ? `0.${"0".repeat(decimals)}%` : "0%" };
  }
  const integerPart = usedGrouping ? "#,##0" : "0";
  return { value, numFmt: decimals > 0 ? `${integerPart}.${"0".repeat(decimals)}` : integerPart };
}
