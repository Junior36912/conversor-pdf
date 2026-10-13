import { attr, child, kids, num, path, type XNode } from "../xml";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Colored {
  rgb: Rgb;
  /** 0 a 1. */
  alpha: number;
}

export interface Theme {
  colors: Record<string, Rgb>;
  /** Fontes "major" (títulos) e "minor" (corpo) do tema. */
  majorFont: string;
  minorFont: string;
}

/** Mapeamento de cores do mestre: bg1 -> lt1, tx1 -> dk1, etc. */
export type ColorMap = Record<string, string>;

export interface ColorContext {
  theme: Theme;
  colorMap: ColorMap;
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export const PRESET_COLORS: Record<string, Rgb> = {
  black: BLACK,
  white: WHITE,
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  yellow: { r: 255, g: 255, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
  orange: { r: 255, g: 165, b: 0 },
};

function hex(value: string | undefined): Rgb | undefined {
  if (!value || !/^[0-9a-f]{6}$/i.test(value)) return undefined;
  const n = parseInt(value, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function parseTheme(root: XNode | undefined): Theme {
  const colors: Record<string, Rgb> = {};
  const scheme = path(root, "themeElements", "clrScheme");
  for (const entry of kids(scheme)) {
    const value = child(entry, "srgbClr") ?? child(entry, "sysClr");
    const rgb = hex(attr(value, "val")) ?? hex(attr(value, "lastClr"));
    if (rgb) colors[entry.name] = rgb;
  }
  const fonts = path(root, "themeElements", "fontScheme");
  return {
    colors,
    majorFont: attr(path(fonts, "majorFont", "latin"), "typeface") ?? "Arial",
    minorFont: attr(path(fonts, "minorFont", "latin"), "typeface") ?? "Arial",
  };
}

// ───────────────────────── HSL ─────────────────────────

function toHsl({ r, g, b }: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    return Math.round(v * 255);
  };
  return { r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3) };
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/**
 * Resolve um elemento de cor do DrawingML (`srgbClr`, `schemeClr`, `sysClr`, `prstClr`) com seus
 * modificadores (lumMod, lumOff, tint, shade, satMod, alpha).
 * `placeholder` é a cor usada por `phClr` (cor herdada do estilo da forma).
 */
export function resolveColor(
  node: XNode | undefined,
  context: ColorContext,
  placeholder?: Colored,
): Colored | undefined {
  if (!node) return undefined;
  let rgb: Rgb | undefined;
  let alpha = 1;

  switch (node.name) {
    case "srgbClr":
      rgb = hex(attr(node, "val"));
      break;
    case "sysClr":
      rgb = hex(attr(node, "lastClr")) ?? (attr(node, "val") === "window" ? WHITE : BLACK);
      break;
    case "prstClr":
      rgb = PRESET_COLORS[attr(node, "val") ?? ""] ?? BLACK;
      break;
    case "schemeClr": {
      const name = attr(node, "val") ?? "tx1";
      if (name === "phClr") {
        if (!placeholder) return undefined;
        rgb = placeholder.rgb;
        alpha = placeholder.alpha;
      } else {
        const mapped = context.colorMap[name] ?? name;
        rgb = context.theme.colors[mapped] ?? context.theme.colors[name];
      }
      break;
    }
    default:
      return undefined;
  }
  if (!rgb) return undefined;

  for (const mod of kids(node)) {
    const value = (num(mod, "val") ?? 100000) / 100000;
    switch (mod.name) {
      case "alpha":
        alpha = clamp(alpha * value);
        break;
      case "lumMod": {
        const [h, s, l] = toHsl(rgb);
        rgb = fromHsl(h, s, clamp(l * value));
        break;
      }
      case "lumOff": {
        const [h, s, l] = toHsl(rgb);
        rgb = fromHsl(h, s, clamp(l + value));
        break;
      }
      case "satMod": {
        const [h, s, l] = toHsl(rgb);
        rgb = fromHsl(h, clamp(s * value), l);
        break;
      }
      case "tint": // `value` da cor original, o resto vira branco
        rgb = {
          r: Math.round(255 - (255 - rgb.r) * value),
          g: Math.round(255 - (255 - rgb.g) * value),
          b: Math.round(255 - (255 - rgb.b) * value),
        };
        break;
      case "shade": // `value` da cor original, o resto vira preto
        rgb = { r: Math.round(rgb.r * value), g: Math.round(rgb.g * value), b: Math.round(rgb.b * value) };
        break;
    }
  }
  return { rgb, alpha };
}

/**
 * Lê uma cor "sólida" de um nó que contém um elemento de cor como filho direto
 * (ex.: `solidFill`, `lnRef`, `fontRef`).
 */
export function colorIn(
  holder: XNode | undefined,
  context: ColorContext,
  placeholder?: Colored,
): Colored | undefined {
  for (const candidate of kids(holder)) {
    const color = resolveColor(candidate, context, placeholder);
    if (color) return color;
  }
  return undefined;
}
