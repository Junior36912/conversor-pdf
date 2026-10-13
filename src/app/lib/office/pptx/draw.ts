import {
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { UnicodeFonts } from "../../pdf/fonts";
import { embedImage } from "../../pdf/images";
import type {
  Background,
  Deck,
  Frame,
  LineModel,
  ParaModel,
  PictureItem,
  ShapeItem,
  SlideItem,
  TableItem,
  TextModel,
} from "./model";
import type { Colored } from "./theme";

const LINE_HEIGHT = 1.2;
const TAU = Math.PI / 180;

const pdfColor = ({ rgb: c }: Colored) => rgb(c.r / 255, c.g / 255, c.b / 255);

interface DrawContext {
  pdf: PDFDocument;
  fonts: UnicodeFonts;
  page: PDFPage;
  /** Altura da página, para converter y (de cima para baixo) em y do PDF (de baixo para cima). */
  height: number;
  images: Map<Uint8Array, Promise<PDFImage | undefined>>;
}

// ───────────────────────── transformações ─────────────────────────

/** Executa `draw` com a forma girada em torno do centro (a rotação do PowerPoint é horária). */
function withRotation(context: DrawContext, frame: Frame, draw: () => void) {
  if (!frame.rot) return draw();
  const cx = frame.x + frame.w / 2;
  const cy = context.height - (frame.y + frame.h / 2);
  const angle = -frame.rot * TAU; // horário na tela = negativo com o eixo y para cima
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  context.page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos),
  );
  draw();
  context.page.pushOperators(popGraphicsState());
}

/** Limita o desenho seguinte a um retângulo (até `popGraphicsState`). */
function pushClip(context: DrawContext, x: number, top: number, w: number, h: number) {
  const yPdf = context.height - top - h;
  context.page.pushOperators(
    pushGraphicsState(),
    moveTo(x, yPdf),
    lineTo(x + w, yPdf),
    lineTo(x + w, yPdf + h),
    lineTo(x, yPdf + h),
    closePath(),
    clip(),
    endPath(),
  );
}

// ───────────────────────── geometria ─────────────────────────

const ratio = (adjust: Record<string, number>, key: string, fallback: number) => (adjust[key] ?? fallback) / 100000;

/** Caminho SVG (origem no canto superior esquerdo, y para baixo) das formas predefinidas. */
function presetPath(name: string, w: number, h: number, adjust: Record<string, number>): string | undefined {
  const min = Math.min(w, h);
  switch (name) {
    case "roundRect":
    case "flowChartTerminator": {
      const r = name === "flowChartTerminator" ? h / 2 : min * ratio(adjust, "adj", 16667);
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }
    case "triangle":
      return `M ${w * ratio(adjust, "adj", 50000)} 0 L ${w} ${h} L 0 ${h} Z`;
    case "rtTriangle":
      return `M 0 0 L 0 ${h} L ${w} ${h} Z`;
    case "diamond":
    case "flowChartDecision":
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
    case "parallelogram": {
      const o = min * ratio(adjust, "adj", 25000);
      return `M ${o} 0 L ${w} 0 L ${w - o} ${h} L 0 ${h} Z`;
    }
    case "trapezoid": {
      const o = min * ratio(adjust, "adj", 25000);
      return `M ${o} 0 L ${w - o} 0 L ${w} ${h} L 0 ${h} Z`;
    }
    case "hexagon": {
      const o = min * ratio(adjust, "adj", 25000);
      return `M ${o} 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L ${o} ${h} L 0 ${h / 2} Z`;
    }
    case "homePlate": {
      const d = min * ratio(adjust, "adj", 50000);
      return `M 0 0 L ${w - d} 0 L ${w} ${h / 2} L ${w - d} ${h} L 0 ${h} Z`;
    }
    case "chevron": {
      const d = min * ratio(adjust, "adj", 50000);
      return `M 0 0 L ${w - d} 0 L ${w} ${h / 2} L ${w - d} ${h} L 0 ${h} L ${d} ${h / 2} Z`;
    }
    case "plus":
    case "mathPlus": {
      const d = min * ratio(adjust, "adj", 25000);
      return `M ${d} 0 H ${w - d} V ${d} H ${w} V ${h - d} H ${w - d} V ${h} H ${d} V ${h - d} H 0 V ${d} H ${d} Z`;
    }
    case "rightArrow":
    case "leftArrow": {
      const shaft = h * ratio(adjust, "adj1", 50000);
      const head = Math.min(min * ratio(adjust, "adj2", 50000), w);
      const top = (h - shaft) / 2;
      const bottom = (h + shaft) / 2;
      return name === "rightArrow"
        ? `M 0 ${top} L ${w - head} ${top} L ${w - head} 0 L ${w} ${h / 2} L ${w - head} ${h} L ${w - head} ${bottom} L 0 ${bottom} Z`
        : `M ${w} ${top} L ${head} ${top} L ${head} 0 L 0 ${h / 2} L ${head} ${h} L ${head} ${bottom} L ${w} ${bottom} Z`;
    }
    case "upArrow":
    case "downArrow": {
      const shaft = w * ratio(adjust, "adj1", 50000);
      const head = Math.min(min * ratio(adjust, "adj2", 50000), h);
      const left = (w - shaft) / 2;
      const right = (w + shaft) / 2;
      return name === "upArrow"
        ? `M ${left} ${h} L ${left} ${head} L 0 ${head} L ${w / 2} 0 L ${w} ${head} L ${right} ${head} L ${right} ${h} Z`
        : `M ${left} 0 L ${left} ${h - head} L 0 ${h - head} L ${w / 2} ${h} L ${w} ${h - head} L ${right} ${h - head} L ${right} 0 Z`;
    }
    default:
      return undefined;
  }
}

function strokeOptions(line: LineModel | null) {
  return line
    ? {
        borderColor: pdfColor(line.color),
        borderWidth: line.width,
        borderOpacity: line.color.alpha,
        borderDashArray: line.dash ? [line.width * 3, line.width * 2] : undefined,
      }
    : {};
}

function drawGeometry(context: DrawContext, item: ShapeItem) {
  const { page, height } = context;
  const { frame, fill, line, geometry } = item;
  const { x, y, w, h } = frame;
  const fillOptions = fill ? { color: pdfColor(fill), opacity: fill.alpha } : {};
  const stroke = strokeOptions(line);

  if (geometry.kind === "preset" && (geometry.name === "line" || /^(straight|bent|curved)Connector|^line/.test(geometry.name))) {
    if (!line) return;
    const x0 = frame.flipH ? x + w : x;
    const x1 = frame.flipH ? x : x + w;
    const y0 = frame.flipV ? y + h : y;
    const y1 = frame.flipV ? y : y + h;
    page.drawLine({
      start: { x: x0, y: height - y0 },
      end: { x: x1, y: height - y1 },
      thickness: line.width,
      color: pdfColor(line.color),
      opacity: line.color.alpha,
      dashArray: line.dash ? [line.width * 3, line.width * 2] : undefined,
    });
    return;
  }
  if (!fill && !line) return;

  if (geometry.kind === "custom") {
    // O caminho está no espaço próprio (width x height); a matriz o escala até o quadro da forma.
    const sx = w / geometry.width;
    const sy = h / geometry.height;
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, x, height - y));
    page.drawSvgPath(geometry.path, {
      x: 0,
      y: 0,
      ...fillOptions,
      ...strokeOptions(line && { ...line, width: line.width / ((sx + sy) / 2) }),
    });
    page.pushOperators(popGraphicsState());
    return;
  }

  const { name, adjust } = geometry;
  if (name === "ellipse" || name === "flowChartConnector") {
    page.drawEllipse({ x: x + w / 2, y: height - (y + h / 2), xScale: w / 2, yScale: h / 2, ...fillOptions, ...stroke });
    return;
  }
  const svg = presetPath(name, w, h, adjust);
  if (svg) {
    page.drawSvgPath(svg, { x, y: height - y, ...fillOptions, ...stroke });
    return;
  }
  page.drawRectangle({ x, y: height - (y + h), width: w, height: h, ...fillOptions, ...stroke });
}

// ───────────────────────── texto ─────────────────────────

interface Token {
  text: string;
  width: number;
  space: boolean;
  font: PDFFont;
  size: number;
  run: ParaModel["runs"][number];
  lift: number;
}

interface TextLine {
  tokens: Token[];
  /** Largura do conteúdo (sem o espaço final). */
  width: number;
  /** Altura da linha, em pontos. */
  height: number;
  para: ParaModel;
  paraIndex: number;
  first: boolean;
  last: boolean;
  /** Margem esquerda desta linha, relativa ao início da área de texto. */
  left: number;
  available: number;
}

const ROMAN: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];

function numberLabel(scheme: string, n: number): string {
  const roman = (value: number) => ROMAN.reduce((out, [v, s]) => { while (value >= v) { out += s; value -= v; } return out; }, "");
  const alpha = (value: number) => String.fromCharCode(96 + (((value - 1) % 26) + 1));
  const base = /^roman/.test(scheme) ? roman(n) : /^alpha/.test(scheme) ? alpha(n) : String(n);
  const text = /Uc/.test(scheme) ? base.toUpperCase() : base;
  if (/ParenBoth/.test(scheme)) return `(${text})`;
  if (/ParenR/.test(scheme)) return `${text})`;
  if (/Period/.test(scheme) || !/Plain/.test(scheme)) return `${text}.`;
  return text;
}

/** Quebra os parágrafos em linhas para a largura dada. */
function layoutText(context: DrawContext, text: TextModel, width: number): { lines: TextLine[]; height: number } {
  const { fonts } = context;
  const lines: TextLine[] = [];
  const counters: number[] = [];
  const scale = text.fontScale;

  text.paragraphs.forEach((para, paraIndex) => {
    const hasBullet = Boolean(para.bullet);
    const firstLeft = hasBullet ? para.marL : para.marL + para.indent;

    // Numeração automática: continua enquanto os parágrafos seguintes forem do mesmo nível.
    if (para.bullet?.kind === "auto") {
      counters[para.level] = counters[para.level] === undefined ? para.bullet.startAt : counters[para.level] + 1;
      counters.length = para.level + 1;
    } else {
      counters.length = Math.min(counters.length, para.level);
    }

    const tokens: Token[] = [];
    for (const run of para.runs) {
      const size = run.size * scale * run.scale * (run.baseline ? 0.65 : 1);
      const font = fonts.pick(run.bold, run.italic, run.family);
      for (const part of run.text.split(/(\n)/)) {
        if (part === "") continue;
        if (part === "\n") {
          tokens.push({ text: "\n", width: 0, space: true, font, size, run, lift: 0 });
          continue;
        }
        for (const piece of fonts.sanitize(part).split(/( +)/)) {
          if (piece === "") continue;
          tokens.push({
            text: piece,
            width: font.widthOfTextAtSize(piece, size),
            space: piece[0] === " ",
            font,
            size,
            run,
            lift: (run.baseline / 100) * run.size * scale * run.scale,
          });
        }
      }
    }

    const emptyHeight = (para.emptySize * scale) * LINE_HEIGHT;
    const makeLine = (lineTokens: Token[], first: boolean, last: boolean): TextLine => {
      const sized = lineTokens.length > 0 ? Math.max(...lineTokens.map((t) => t.size)) : para.emptySize * scale;
      const base = sized * LINE_HEIGHT;
      const height = para.lineSpacingPts !== undefined ? para.lineSpacingPts : base * para.lineSpacing;
      const left = first ? firstLeft : para.marL;
      let used = lineTokens.reduce((sum, t) => sum + t.width, 0);
      while (lineTokens.length > 0 && lineTokens[lineTokens.length - 1].space) {
        used -= lineTokens[lineTokens.length - 1].width;
        lineTokens = lineTokens.slice(0, -1);
      }
      return { tokens: lineTokens, width: used, height: lineTokens.length === 0 ? emptyHeight : height, para, paraIndex, first, last, left, available: width - left };
    };

    if (tokens.length === 0) {
      lines.push(makeLine([], true, true));
      return;
    }

    let current: Token[] = [];
    let currentWidth = 0;
    let first = true;
    const flush = (last: boolean) => {
      lines.push(makeLine(current, first, last));
      current = [];
      currentWidth = 0;
      first = false;
    };
    for (const token of tokens) {
      if (token.text === "\n") {
        flush(true);
        continue;
      }
      const left = first ? firstLeft : para.marL;
      const available = width - left;
      if (text.wrap && !token.space && current.length > 0 && currentWidth + token.width > available + 0.01) {
        flush(false);
      }
      if (current.length === 0 && token.space) continue; // espaços no começo da linha são descartados
      current.push(token);
      currentWidth += token.width;
    }
    if (current.length > 0 || lines[lines.length - 1]?.paraIndex !== paraIndex) flush(true);
    else lines[lines.length - 1].last = true;
  });

  // Altura total: linhas + espaçamento entre parágrafos (antes do primeiro parágrafo não conta).
  let height = 0;
  let lastPara = -1;
  for (const line of lines) {
    if (line.paraIndex !== lastPara) {
      if (lastPara >= 0) height += text.paragraphs[lastPara].spaceAfter;
      if (lastPara >= 0) height += line.para.spaceBefore;
      lastPara = line.paraIndex;
    }
    height += line.height;
  }
  return { lines, height };
}

function drawLayout(
  context: DrawContext,
  text: TextModel,
  layout: { lines: TextLine[]; height: number },
  box: { x: number; y: number; w: number; h: number },
) {
  const { page, height: pageHeight, fonts } = context;
  const free = box.h - layout.height;
  let top = text.anchor === "ctr" ? box.y + free / 2 : text.anchor === "b" ? box.y + free : box.y;

  const counters: number[] = [];
  let lastPara = -1;
  for (const line of layout.lines) {
    if (line.paraIndex !== lastPara) {
      if (lastPara >= 0) top += text.paragraphs[lastPara].spaceAfter + line.para.spaceBefore;
      lastPara = line.paraIndex;
    }
    const maxSize = line.tokens.length > 0 ? Math.max(...line.tokens.map((t) => t.size)) : line.para.emptySize * text.fontScale;
    const baseline = top + line.height - maxSize * 0.25;

    // Marcador (ou número) na primeira linha do parágrafo.
    const bullet = line.para.bullet;
    if (bullet && line.first) {
      let label = "•";
      if (bullet.kind === "char") {
        label = bullet.char;
      } else {
        counters[line.para.level] = counters[line.para.level] === undefined ? bullet.startAt : counters[line.para.level] + 1;
        label = numberLabel(bullet.scheme, counters[line.para.level]);
      }
      const lead = line.para.runs[0];
      const size = (lead?.size ?? 18) * text.fontScale * (lead?.scale ?? 1) * ((bullet.sizePct ?? 100) / 100);
      const font = fonts.pick(false, false, bullet.family);
      const color = bullet.color ?? lead?.color;
      const safe = fonts.sanitize(label);
      page.drawText(safe, {
        x: box.x + line.para.marL + line.para.indent,
        y: pageHeight - baseline,
        size,
        font,
        color: color ? pdfColor(color) : rgb(0, 0, 0),
        opacity: color?.alpha,
      });
    } else if (!bullet) {
      counters.length = Math.min(counters.length, line.para.level);
    }

    // Alinhamento e justificação.
    const align = line.para.align;
    const spaces = line.tokens.filter((t) => t.space).length;
    const justify = align === "just" && !line.last && spaces > 0 && line.width < line.available;
    const extra = justify ? (line.available - line.width) / spaces : 0;
    let x =
      box.x + line.left + (align === "ctr" ? (line.available - line.width) / 2 : align === "r" ? line.available - line.width : 0);

    // Trechos consecutivos com o mesmo estilo saem como uma única linha de texto no PDF (melhora a
    // seleção e a cópia). Só o texto justificado é desenhado palavra a palavra, por causa dos espaços.
    const sameStyle = (a: Token, b: Token) =>
      a.font === b.font && a.size === b.size && a.run.color === b.run.color && a.run.underline === b.run.underline &&
      a.run.strike === b.run.strike && a.lift === b.lift;
    let segment: { text: string; x: number; width: number; token: Token } | undefined;
    const paint = () => {
      if (!segment) return;
      const { token } = segment;
      const text = segment.text.trimEnd();
      const width = segment.width - (segment.text.length - text.length > 0 ? token.font.widthOfTextAtSize(segment.text.slice(text.length), token.size) : 0);
      const y = pageHeight - baseline + token.lift;
      const color = pdfColor(token.run.color);
      if (text !== "") {
        page.drawText(text, { x: segment.x, y, size: token.size, font: token.font, color, opacity: token.run.color.alpha });
        if (token.run.underline) {
          page.drawLine({ start: { x: segment.x, y: y - token.size * 0.12 }, end: { x: segment.x + width, y: y - token.size * 0.12 }, thickness: Math.max(0.5, token.size / 18), color, opacity: token.run.color.alpha });
        }
        if (token.run.strike) {
          page.drawLine({ start: { x: segment.x, y: y + token.size * 0.3 }, end: { x: segment.x + width, y: y + token.size * 0.3 }, thickness: Math.max(0.5, token.size / 18), color, opacity: token.run.color.alpha });
        }
      }
      segment = undefined;
    };

    for (const token of line.tokens) {
      const advance = token.width + (token.space ? extra : 0);
      if (justify) {
        // Palavra a palavra: o espaço extra empurra cada palavra.
        if (!token.space) {
          segment = { text: token.text, x, width: token.width, token };
          paint();
        }
        x += advance;
        continue;
      }
      if (segment && !sameStyle(segment.token, token)) paint();
      if (!segment) segment = { text: "", x, width: 0, token };
      segment.text += token.text;
      segment.width += token.width;
      x += advance;
    }
    paint();
    top += line.height;
  }
}

function drawTextBox(context: DrawContext, text: TextModel, frame: Frame) {
  const w = frame.w - text.insets.l - text.insets.r;
  const layout = layoutText(context, text, text.wrap ? Math.max(1, w) : 1e9);
  drawLayout(context, text, layout, {
    x: frame.x + text.insets.l,
    y: frame.y + text.insets.t,
    w,
    h: frame.h - text.insets.t - text.insets.b,
  });
}

// ───────────────────────── imagens, tabelas e demais itens ─────────────────────────

function loadImage(context: DrawContext, bytes: Uint8Array, extension: string): Promise<PDFImage | undefined> {
  let promise = context.images.get(bytes);
  if (!promise) {
    promise = /^(emf|wmf|svg|tiff?|wdp|jxr)$/.test(extension)
      ? Promise.resolve(undefined) // formatos que o navegador não decodifica
      : embedImage(context.pdf, bytes.slice().buffer).catch(() => undefined);
    context.images.set(bytes, promise);
  }
  return promise;
}

async function drawPicture(context: DrawContext, item: PictureItem) {
  const image = await loadImage(context, item.bytes, item.extension);
  if (!image) return;
  const { frame, crop } = item;
  const { x, y, w, h } = frame;
  const cropped = crop.l || crop.t || crop.r || crop.b;
  if (!cropped) {
    context.page.drawImage(image, { x, y: context.height - (y + h), width: w, height: h });
    return;
  }
  const fullW = w / (1 - crop.l - crop.r);
  const fullH = h / (1 - crop.t - crop.b);
  const left = x - crop.l * fullW;
  const top = y - crop.t * fullH;
  pushClip(context, x, y, w, h);
  context.page.drawImage(image, { x: left, y: context.height - (top + fullH), width: fullW, height: fullH });
  context.page.pushOperators(popGraphicsState());
}

function drawBorder(context: DrawContext, line: LineModel | null | undefined, from: [number, number], to: [number, number]) {
  if (!line) return;
  context.page.drawLine({
    start: { x: from[0], y: context.height - from[1] },
    end: { x: to[0], y: context.height - to[1] },
    thickness: line.width,
    color: pdfColor(line.color),
    opacity: line.color.alpha,
    dashArray: line.dash ? [line.width * 3, line.width * 2] : undefined,
  });
}

function drawTable(context: DrawContext, item: TableItem) {
  const { frame, columns, rows } = item;

  // Altura das linhas: a do arquivo, ou a que o texto precisar (o PowerPoint também cresce).
  const xs = [frame.x];
  for (const width of columns) xs.push(xs[xs.length - 1] + width);
  const heights = rows.map((row) => {
    let needed = row.height;
    let column = 0;
    for (const cell of row.cells) {
      if (!cell.covered && cell.rowSpan === 1) {
        const width = xs[Math.min(column + cell.gridSpan, columns.length)] - xs[column] - cell.text.insets.l - cell.text.insets.r;
        const { height } = layoutText(context, cell.text, Math.max(1, width));
        needed = Math.max(needed, height + cell.text.insets.t + cell.text.insets.b);
      }
      column++;
    }
    return needed;
  });
  const ys = [frame.y];
  for (const height of heights) ys.push(ys[ys.length - 1] + height);

  rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, column) => {
      if (cell.covered) return;
      const x = xs[column];
      const y = ys[rowIndex];
      const w = xs[Math.min(column + cell.gridSpan, columns.length)] - x;
      const h = ys[Math.min(rowIndex + cell.rowSpan, rows.length)] - y;
      if (cell.fill) {
        context.page.drawRectangle({ x, y: context.height - (y + h), width: w, height: h, color: pdfColor(cell.fill), opacity: cell.fill.alpha });
      }
      drawTextBox(context, cell.text, { x, y, w, h, rot: 0, flipH: false, flipV: false });
      drawBorder(context, cell.borders.t, [x, y], [x + w, y]);
      drawBorder(context, cell.borders.b, [x, y + h], [x + w, y + h]);
      drawBorder(context, cell.borders.l, [x, y], [x, y + h]);
      drawBorder(context, cell.borders.r, [x + w, y], [x + w, y + h]);
    });
  });
}

function drawUnsupported(context: DrawContext, item: Extract<SlideItem, { kind: "unsupported" }>) {
  const { frame } = item;
  context.page.drawRectangle({
    x: frame.x,
    y: context.height - (frame.y + frame.h),
    width: frame.w,
    height: frame.h,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    borderDashArray: [4, 3],
  });
  const label = context.fonts.sanitize(`${item.label} (não suportado)`);
  const font = context.fonts.pick(false, true);
  const size = Math.min(14, Math.max(8, frame.h / 6));
  context.page.drawText(label, {
    x: frame.x + Math.max(4, (frame.w - font.widthOfTextAtSize(label, size)) / 2),
    y: context.height - (frame.y + frame.h / 2) - size / 3,
    size,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

async function drawBackground(context: DrawContext, background: Background, width: number) {
  if ("rgb" in background) {
    context.page.drawRectangle({ x: 0, y: 0, width, height: context.height, color: pdfColor(background) });
    return;
  }
  const image = await loadImage(context, background.bytes, background.extension);
  if (image) context.page.drawImage(image, { x: 0, y: 0, width, height: context.height });
}

/** Desenha a apresentação inteira, uma página de PDF por slide. */
export async function drawDeck(
  pdf: PDFDocument,
  fonts: UnicodeFonts,
  deck: Deck,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const images = new Map<Uint8Array, Promise<PDFImage | undefined>>();

  for (const [index, slide] of deck.slides.entries()) {
    const page = pdf.addPage([deck.width, deck.height]);
    const context: DrawContext = { pdf, fonts, page, height: deck.height, images };

    await drawBackground(context, slide.background, deck.width);
    for (const item of slide.items) {
      try {
        if (item.kind === "shape") {
          withRotation(context, item.frame, () => {
            drawGeometry(context, item);
            if (item.text && item.text.paragraphs.length > 0) drawTextBox(context, item.text, item.frame);
          });
        } else if (item.kind === "picture") {
          pushPicture(context, item);
          await drawPicture(context, item);
          popPicture(context, item);
        } else if (item.kind === "table") {
          drawTable(context, item);
        } else {
          drawUnsupported(context, item);
        }
      } catch {
        // Um item que não pôde ser desenhado não deve derrubar o slide inteiro.
      }
    }
    onProgress?.(index + 1, deck.slides.length);
  }
}

// A rotação de imagens precisa envolver o desenho assíncrono, por isso o par push/pop.
function pushPicture(context: DrawContext, item: PictureItem) {
  const { frame } = item;
  if (!frame.rot) return;
  const cx = frame.x + frame.w / 2;
  const cy = context.height - (frame.y + frame.h / 2);
  const angle = -frame.rot * TAU;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  context.page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos),
  );
}

function popPicture(context: DrawContext, item: PictureItem) {
  if (item.frame.rot) context.page.pushOperators(popGraphicsState());
}
