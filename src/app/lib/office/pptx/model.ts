import { unzipSync } from "fflate";
import { familyOf, type FontFamily } from "../../pdf/analyze-layout";
import { attr, child, kids, num, parseXml, path, type XNode } from "../xml";
import {
  colorIn,
  parseTheme,
  type ColorContext,
  type ColorMap,
  type Colored,
  type Rgb,
  type Theme,
} from "./theme";

// Modelo de uma apresentação já "achatada": tudo em pontos, com a herança de estilos (padrão da
// apresentação, mestre, layout, slide) resolvida. O desenho em PDF (draw.ts) só consome este modelo.

const EMU_PER_PT = 12700;
/** EMU -> pontos; `fallbackEmu` é usado (também em EMU) quando o valor não existe. */
const emu = (value: number | undefined, fallbackEmu = 0) => (value ?? fallbackEmu) / EMU_PER_PT;

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Graus, sentido horário. */
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

export interface LineModel {
  width: number;
  color: Colored;
  dash: boolean;
}

export interface RunModel {
  text: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: Colored;
  family: FontFamily;
  /** Deslocamento vertical em % do corpo (sobrescrito > 0, subscrito < 0). */
  baseline: number;
  /**
   * Compensa fontes mais estreitas que a substituta (Calibri é ~8% mais estreita que a Arial):
   * o texto é desenhado um pouco menor para ocupar a largura que teria no PowerPoint.
   */
  scale: number;
}

export type BulletModel =
  | { kind: "char"; char: string; color?: Colored; sizePct?: number; family: FontFamily }
  | { kind: "auto"; scheme: string; startAt: number; color?: Colored; sizePct?: number; family: FontFamily };

export interface ParaModel {
  runs: RunModel[];
  align: "l" | "ctr" | "r" | "just";
  marL: number;
  indent: number;
  bullet?: BulletModel;
  spaceBefore: number;
  spaceAfter: number;
  /** Múltiplo do espaçamento simples (1 = simples). */
  lineSpacing: number;
  /** Espaçamento exato em pontos, quando definido. */
  lineSpacingPts?: number;
  level: number;
  /** Tamanho usado em parágrafos vazios (altura da linha em branco). */
  emptySize: number;
}

export interface TextModel {
  paragraphs: ParaModel[];
  anchor: "t" | "ctr" | "b";
  insets: { l: number; t: number; r: number; b: number };
  wrap: boolean;
  /** Redução aplicada pelo "ajustar texto" do PowerPoint (1 = nenhuma). */
  fontScale: number;
}

export type Geometry =
  | { kind: "preset"; name: string; adjust: Record<string, number> }
  | { kind: "custom"; path: string; width: number; height: number };

export interface ShapeItem {
  kind: "shape";
  frame: Frame;
  geometry: Geometry;
  fill: Colored | null;
  line: LineModel | null;
  text?: TextModel;
}

export interface PictureItem {
  kind: "picture";
  frame: Frame;
  bytes: Uint8Array;
  extension: string;
  /** Frações cortadas de cada lado (0 a 1). */
  crop: { l: number; t: number; r: number; b: number };
}

export interface TableCellModel {
  text: TextModel;
  fill: Colored | null;
  borders: Partial<Record<"l" | "r" | "t" | "b", LineModel | null>>;
  gridSpan: number;
  rowSpan: number;
  /** Coberta por uma mesclagem (horizontal ou vertical): não desenhar. */
  covered: boolean;
}

export interface TableItem {
  kind: "table";
  frame: Frame;
  columns: number[];
  rows: { height: number; cells: TableCellModel[] }[];
}

export interface UnsupportedItem {
  kind: "unsupported";
  frame: Frame;
  label: string;
}

export type SlideItem = ShapeItem | PictureItem | TableItem | UnsupportedItem;

export type Background = Colored | { kind: "picture"; bytes: Uint8Array; extension: string };

export interface SlideModel {
  number: number;
  background: Background;
  items: SlideItem[];
}

export interface Deck {
  width: number;
  height: number;
  slides: SlideModel[];
}

// ───────────────────────── pacote OPC ─────────────────────────

interface Relationship {
  type: string;
  target: string;
}
type Rels = Record<string, Relationship>;

function resolveTarget(dir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const out: string[] = [];
  for (const part of (dir + target).split("/")) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}

class Pkg {
  private readonly cache = new Map<string, XNode | undefined>();

  constructor(readonly files: Record<string, Uint8Array>) {}

  xml(partPath: string | undefined): XNode | undefined {
    if (!partPath) return undefined;
    if (!this.cache.has(partPath)) {
      const bytes = this.files[partPath];
      this.cache.set(partPath, bytes ? parseXml(new TextDecoder().decode(bytes)) : undefined);
    }
    return this.cache.get(partPath);
  }

  /** Relações da parte: id -> {tipo, alvo absoluto no pacote}. */
  rels(partPath: string | undefined): Rels {
    if (!partPath) return {};
    const slash = partPath.lastIndexOf("/");
    const dir = partPath.slice(0, slash + 1);
    const out: Rels = {};
    for (const rel of kids(this.xml(`${dir}_rels/${partPath.slice(slash + 1)}.rels`), "Relationship")) {
      const id = attr(rel, "Id");
      const target = attr(rel, "Target");
      if (id && target) out[id] = { type: attr(rel, "Type") ?? "", target: resolveTarget(dir, target) };
    }
    return out;
  }
}

const relOfType = (rels: Rels, suffix: string) =>
  Object.values(rels).find((rel) => rel.type.endsWith(suffix))?.target;

// ───────────────────────── propriedades de texto ─────────────────────────

type Spacing = { pct: number } | { pts: number };

interface PProps {
  algn?: ParaModel["align"];
  marL?: number;
  indent?: number;
  spcBef?: Spacing;
  spcAft?: Spacing;
  lnSpc?: Spacing;
  /** `null` = sem marcador (buNone); `undefined` = herda. */
  bullet?: BulletModel | null;
  buClr?: Colored;
  buSzPct?: number;
  buFont?: string;
}

interface RProps {
  sz?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  strike?: boolean;
  color?: Colored;
  typeface?: string;
  baseline?: number;
}

const merge = <T extends object>(base: T, over: T): T => ({
  ...base,
  ...(Object.fromEntries(Object.entries(over).filter(([, value]) => value !== undefined)) as Partial<T>),
});

const flag = (node: XNode, name: string): boolean | undefined =>
  node.attrs[name] === undefined ? undefined : node.attrs[name] === "1" || node.attrs[name] === "true";

function readSpacing(node: XNode | undefined): Spacing | undefined {
  const pct = num(child(node, "spcPct"), "val");
  if (pct !== undefined) return { pct: pct / 100000 };
  const pts = num(child(node, "spcPts"), "val");
  if (pts !== undefined) return { pts: pts / 100 };
  return undefined;
}

function readPProps(node: XNode | undefined, context: ColorContext, phColor?: Colored): PProps {
  if (!node) return {};
  const algn = attr(node, "algn");
  const props: PProps = {
    algn: algn === "l" || algn === "ctr" || algn === "r" || algn === "just" ? algn : undefined,
    marL: node.attrs.marL !== undefined ? emu(num(node, "marL")) : undefined,
    indent: node.attrs.indent !== undefined ? emu(num(node, "indent")) : undefined,
    spcBef: readSpacing(child(node, "spcBef")),
    spcAft: readSpacing(child(node, "spcAft")),
    lnSpc: readSpacing(child(node, "lnSpc")),
    buFont: attr(child(node, "buFont"), "typeface"),
  };

  if (child(node, "buNone")) props.bullet = null;
  const buChar = child(node, "buChar");
  const buAuto = child(node, "buAutoNum");
  if (buChar) {
    props.bullet = { kind: "char", char: attr(buChar, "char") ?? "•", family: "sans" };
  } else if (buAuto) {
    props.bullet = {
      kind: "auto",
      scheme: attr(buAuto, "type") ?? "arabicPeriod",
      startAt: num(buAuto, "startAt") ?? 1,
      family: "sans",
    };
  }
  const buClr = child(node, "buClr");
  if (buClr) props.buClr = colorIn(buClr, context, phColor);
  const buSz = num(child(node, "buSzPct"), "val");
  if (buSz !== undefined) props.buSzPct = buSz / 1000;
  return props;
}

function readRProps(node: XNode | undefined, context: ColorContext, phColor?: Colored): RProps {
  if (!node) return {};
  const fill = child(node, "solidFill");
  return {
    sz: node.attrs.sz !== undefined ? (num(node, "sz") ?? 0) / 100 : undefined,
    b: flag(node, "b"),
    i: flag(node, "i"),
    u: node.attrs.u !== undefined ? node.attrs.u !== "none" : undefined,
    strike: node.attrs.strike !== undefined ? node.attrs.strike !== "noStrike" : undefined,
    baseline: node.attrs.baseline !== undefined ? (num(node, "baseline") ?? 0) / 1000 : undefined,
    color: fill ? colorIn(fill, context, phColor) : undefined,
    typeface: attr(child(node, "latin"), "typeface"),
  };
}

const BLACK: Colored = { rgb: { r: 0, g: 0, b: 0 }, alpha: 1 };
const WHITE: Colored = { rgb: { r: 255, g: 255, b: 255 }, alpha: 1 };

function typefaceName(typeface: string | undefined, theme: Theme): string {
  if (typeface === "+mj-lt") return theme.majorFont;
  if (typeface === "+mn-lt" || !typeface) return theme.minorFont;
  return typeface;
}

const typefaceFamily = (typeface: string | undefined, theme: Theme): FontFamily =>
  familyOf(typefaceName(typeface, theme));

const NARROW_FONTS = /calibri|carlito|candara|corbel|segoe|gill sans|franklin/i;

interface TextEnvironment {
  context: ColorContext;
  /** Estilos gerais (padrão da apresentação, estilo do mestre), do menos ao mais específico. */
  globalLayers: (XNode | undefined)[];
  /**
   * Cor-base do texto da forma (ex.: `fontRef` do estilo da forma, ou o texto do estilo da tabela).
   * Vale mais que os estilos gerais e menos que os do próprio placeholder/forma.
   */
  baseColor?: Colored;
  /** Estilos do placeholder no mestre e no layout. */
  placeholderLayers: (XNode | undefined)[];
  slideNumber: number;
}

function readText(
  txBody: XNode | undefined,
  environment: TextEnvironment,
  bodyPr: XNode | undefined,
): TextModel | undefined {
  if (!txBody) return undefined;
  const { context, globalLayers, baseColor, placeholderLayers, slideNumber } = environment;
  const theme = context.theme;
  const phColor = baseColor;

  const autofit = child(bodyPr, "normAutofit");
  const fontScale = autofit ? (num(autofit, "fontScale") ?? 100000) / 100000 : 1;

  const paragraphs: ParaModel[] = [];
  const shapeStyle = child(txBody, "lstStyle");

  for (const para of kids(txBody, "p")) {
    const pPr = child(para, "pPr");
    const level = Math.min(8, Math.max(0, num(pPr, "lvl") ?? 0));

    let p: PProps = {};
    let r: RProps = {};
    const apply = (layer: XNode | undefined) => {
      const levelNode = child(layer, `lvl${level + 1}pPr`);
      if (!levelNode) return;
      p = merge(p, readPProps(levelNode, context, phColor));
      r = merge(r, readRProps(child(levelNode, "defRPr"), context, phColor));
    };
    globalLayers.forEach(apply);
    if (baseColor) r = merge(r, { color: baseColor });
    placeholderLayers.forEach(apply);
    apply(shapeStyle);
    p = merge(p, readPProps(pPr, context, phColor));
    r = merge(r, readRProps(child(pPr, "defRPr"), context, phColor));

    const runs: RunModel[] = [];
    const pushRun = (text: string, runProps: RProps) => {
      const merged = merge(r, runProps);
      runs.push({
        text,
        size: merged.sz ?? 18,
        bold: merged.b ?? false,
        italic: merged.i ?? false,
        underline: merged.u ?? false,
        strike: merged.strike ?? false,
        color: merged.color ?? BLACK,
        family: typefaceFamily(merged.typeface, theme),
        baseline: merged.baseline ?? 0,
        scale: NARROW_FONTS.test(typefaceName(merged.typeface, theme)) ? 0.92 : 1,
      });
    };

    for (const node of kids(para)) {
      if (node.name === "r") {
        const t = child(node, "t")?.text ?? "";
        if (t !== "") pushRun(t, readRProps(child(node, "rPr"), context, phColor));
      } else if (node.name === "br") {
        pushRun("\n", readRProps(child(node, "rPr"), context, phColor));
      } else if (node.name === "fld") {
        const isSlideNumber = /slidenum/i.test(attr(node, "type") ?? "");
        const cached = child(node, "t")?.text ?? "";
        pushRun(isSlideNumber ? String(slideNumber) : cached, readRProps(child(node, "rPr"), context, phColor));
      }
    }

    let bullet: BulletModel | undefined;
    if (p.bullet) {
      bullet = { ...p.bullet, color: p.buClr, sizePct: p.buSzPct, family: typefaceFamily(undefined, theme) };
      // Marcadores em Symbol/Wingdings são caracteres da área privada: usamos "•".
      if (bullet.kind === "char") {
        const code = bullet.char.codePointAt(0) ?? 0;
        if (/symbol|wingdings/i.test(p.buFont ?? "") || (code >= 0xf000 && code <= 0xf8ff)) bullet.char = "•";
      }
    }

    const lead = runs[0]?.size ?? r.sz ?? 18;
    const spacing = (s: Spacing | undefined) => (s ? ("pts" in s ? s.pts : s.pct * lead) : 0);
    paragraphs.push({
      runs,
      align: p.algn ?? "l",
      marL: p.marL ?? 0,
      indent: p.indent ?? 0,
      bullet,
      spaceBefore: spacing(p.spcBef),
      spaceAfter: spacing(p.spcAft),
      lineSpacing: p.lnSpc && "pct" in p.lnSpc ? p.lnSpc.pct : 1,
      lineSpacingPts: p.lnSpc && "pts" in p.lnSpc ? p.lnSpc.pts : undefined,
      level,
      emptySize: readRProps(child(para, "endParaRPr"), context, phColor).sz ?? r.sz ?? 18,
    });
  }

  return {
    paragraphs,
    anchor: bodyPr?.attrs.anchor === "ctr" ? "ctr" : bodyPr?.attrs.anchor === "b" ? "b" : "t",
    insets: {
      l: emu(num(bodyPr, "lIns"), 91440),
      t: emu(num(bodyPr, "tIns"), 45720),
      r: emu(num(bodyPr, "rIns"), 91440),
      b: emu(num(bodyPr, "bIns"), 45720),
    },
    wrap: bodyPr?.attrs.wrap !== "none",
    fontScale,
  };
}

/** Atributos do bodyPr: o do slide vale mais que o do layout, que vale mais que o do mestre. */
function mergeBodyPr(own?: XNode, layout?: XNode, master?: XNode): XNode {
  return {
    name: "bodyPr",
    attrs: { ...master?.attrs, ...layout?.attrs, ...own?.attrs },
    children: own?.children.length ? own.children : layout?.children.length ? layout.children : (master?.children ?? []),
    text: "",
  };
}

// ───────────────────────── geometria, preenchimento e linha ─────────────────────────

interface Transform {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}
const IDENTITY: Transform = { sx: 1, sy: 1, tx: 0, ty: 0 };

function readFrame(xfrm: XNode | undefined, transform: Transform): Frame | undefined {
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  if (!xfrm || !off || !ext) return undefined;
  return {
    x: emu(transform.tx + (num(off, "x") ?? 0) * transform.sx),
    y: emu(transform.ty + (num(off, "y") ?? 0) * transform.sy),
    w: emu((num(ext, "cx") ?? 0) * transform.sx),
    h: emu((num(ext, "cy") ?? 0) * transform.sy),
    rot: (num(xfrm, "rot") ?? 0) / 60000,
    flipH: flag(xfrm, "flipH") ?? false,
    flipV: flag(xfrm, "flipV") ?? false,
  };
}

/** Cor de preenchimento de um `spPr`: `undefined` = não especifica; `null` = sem preenchimento. */
function readFillSpec(spPr: XNode | undefined, context: ColorContext, phColor?: Colored): Colored | null | undefined {
  if (!spPr) return undefined;
  if (child(spPr, "noFill")) return null;
  const solid = child(spPr, "solidFill");
  if (solid) return colorIn(solid, context, phColor) ?? null;
  const gradient = child(spPr, "gradFill");
  if (gradient) {
    // Degradês viram a cor da primeira parada (aproximação).
    return colorIn(child(child(gradient, "gsLst"), "gs"), context, phColor) ?? null;
  }
  const pattern = child(spPr, "pattFill");
  if (pattern) return colorIn(child(pattern, "fgClr"), context, phColor) ?? null;
  return undefined;
}

function readLine(ln: XNode | undefined, context: ColorContext, phColor: Colored | undefined, fallback: LineModel | null): LineModel | null {
  if (!ln) return fallback;
  if (child(ln, "noFill")) return null;
  const color = colorIn(child(ln, "solidFill"), context, phColor) ?? fallback?.color;
  if (!color) return fallback;
  const dash = attr(child(ln, "prstDash"), "val");
  return {
    width: ln.attrs.w !== undefined ? Math.max(0.25, emu(num(ln, "w"))) : (fallback?.width ?? 0.75),
    color,
    dash: Boolean(dash && dash !== "solid"),
  };
}

function readGeometry(spPr: XNode | undefined): Geometry {
  const preset = child(spPr, "prstGeom");
  if (preset) {
    const adjust: Record<string, number> = {};
    for (const gd of kids(child(preset, "avLst"), "gd")) {
      const value = /val\s+(-?\d+)/.exec(gd.attrs.fmla ?? "")?.[1];
      if (gd.attrs.name && value !== undefined) adjust[gd.attrs.name] = Number(value);
    }
    return { kind: "preset", name: preset.attrs.prst ?? "rect", adjust };
  }
  const custom = child(spPr, "custGeom");
  const pathNode = child(child(custom, "pathLst"), "path");
  if (custom && pathNode) {
    return { kind: "custom", path: customPathToSvg(pathNode), width: num(pathNode, "w") ?? 1, height: num(pathNode, "h") ?? 1 };
  }
  return { kind: "preset", name: "rect", adjust: {} };
}

/** Converte o caminho de uma forma livre (`custGeom`) em um caminho SVG no espaço w x h do caminho. */
function customPathToSvg(pathNode: XNode): string {
  const point = (node: XNode | undefined) => `${num(node, "x") ?? 0} ${num(node, "y") ?? 0}`;
  const out: string[] = [];
  let current = { x: 0, y: 0 };
  const moveTo = (node: XNode | undefined) => {
    current = { x: num(node, "x") ?? 0, y: num(node, "y") ?? 0 };
  };

  for (const command of kids(pathNode)) {
    const pts = kids(command, "pt");
    switch (command.name) {
      case "moveTo":
        out.push(`M ${point(pts[0])}`);
        moveTo(pts[0]);
        break;
      case "lnTo":
        out.push(`L ${point(pts[0])}`);
        moveTo(pts[0]);
        break;
      case "cubicBezTo":
        out.push(`C ${pts.map(point).join(" ")}`);
        moveTo(pts[2]);
        break;
      case "quadBezTo":
        out.push(`Q ${pts.map(point).join(" ")}`);
        moveTo(pts[1]);
        break;
      case "arcTo": {
        const wR = num(command, "wR") ?? 0;
        const hR = num(command, "hR") ?? 0;
        const start = ((num(command, "stAng") ?? 0) / 60000) * (Math.PI / 180);
        const sweep = ((num(command, "swAng") ?? 0) / 60000) * (Math.PI / 180);
        const cx = current.x - wR * Math.cos(start);
        const cy = current.y - hR * Math.sin(start);
        const end = { x: cx + wR * Math.cos(start + sweep), y: cy + hR * Math.sin(start + sweep) };
        out.push(`A ${wR} ${hR} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 1 : 0} ${end.x} ${end.y}`);
        current = end;
        break;
      }
      case "close":
        out.push("Z");
        break;
    }
  }
  return out.join(" ");
}

// ───────────────────────── formas ─────────────────────────

interface Layer {
  root: XNode | undefined;
  tree: XNode | undefined;
  rels: Rels;
}

interface SlideEnvironment {
  pkg: Pkg;
  context: ColorContext;
  defaultTextStyle: XNode | undefined;
  txStyles: XNode | undefined;
  master: Layer;
  layout: Layer;
  slide: Layer;
  slideNumber: number;
  /** Relações usadas para resolver imagens da parte que está sendo lida. */
  rels: Rels;
}

interface PlaceholderRef {
  type?: string;
  idx?: string;
}

function readPlaceholder(node: XNode): PlaceholderRef | undefined {
  const ph =
    path(node, "nvSpPr", "nvPr", "ph") ??
    path(node, "nvPicPr", "nvPr", "ph") ??
    path(node, "nvGraphicFramePr", "nvPr", "ph");
  return ph ? { type: ph.attrs.type, idx: ph.attrs.idx } : undefined;
}

/** Tipos de placeholder equivalentes para casar slide -> layout -> mestre. */
const normalizeType = (type: string | undefined) =>
  type === "ctrTitle" ? "title" : !type || type === "subTitle" || type === "obj" ? "body" : type;

interface PlaceholderShape {
  ref: PlaceholderRef;
  node: XNode;
}

function placeholdersOf(tree: XNode | undefined): PlaceholderShape[] {
  const out: PlaceholderShape[] = [];
  for (const node of kids(tree)) {
    const ref = readPlaceholder(node);
    if (ref) out.push({ ref, node });
  }
  return out;
}

function findPlaceholder(list: PlaceholderShape[], ref: PlaceholderRef): PlaceholderShape | undefined {
  const sameType = (entry: PlaceholderShape) => normalizeType(entry.ref.type) === normalizeType(ref.type);
  return (ref.idx !== undefined ? list.find((entry) => entry.ref.idx === ref.idx && sameType(entry)) : undefined) ?? list.find(sameType);
}

/** `mc:AlternateContent`: usa o conteúdo de reserva (Fallback), mais simples e sempre suportado. */
function expandAlternates(nodes: XNode[]): XNode[] {
  return nodes.flatMap((node) => {
    if (node.name !== "AlternateContent") return [node];
    const chosen = child(node, "Fallback") ?? child(node, "Choice");
    return chosen ? expandAlternates(kids(chosen)) : [];
  });
}

function readShape(
  node: XNode,
  environment: SlideEnvironment,
  transform: Transform,
  ref: PlaceholderRef | undefined,
): ShapeItem | undefined {
  const spPr = child(node, "spPr");
  const spStyle = child(node, "style");
  const { context } = environment;

  const layoutPh = ref ? findPlaceholder(placeholdersOf(environment.layout.tree), ref) : undefined;
  const masterPh = ref ? findPlaceholder(placeholdersOf(environment.master.tree), ref) : undefined;
  const inheritedSpPr = [path(layoutPh?.node, "spPr"), path(masterPh?.node, "spPr")];

  const frame =
    readFrame(child(spPr, "xfrm"), transform) ??
    inheritedSpPr.map((inherited) => readFrame(child(inherited, "xfrm"), IDENTITY)).find(Boolean);
  if (!frame) return undefined;

  // Estilo da forma (`p:style`): cor do texto, e preenchimento/linha por referência ao tema.
  const fontRef = child(spStyle, "fontRef");
  const baseColor = ref ? undefined : colorIn(fontRef, context);
  const fillRef = child(spStyle, "fillRef");
  const lnRef = child(spStyle, "lnRef");
  const refFill = (num(fillRef, "idx") ?? 0) > 0 ? (colorIn(fillRef, context) ?? null) : null;
  const lnIndex = num(lnRef, "idx") ?? 0;
  const refLineColor = lnIndex > 0 ? colorIn(lnRef, context) : undefined;
  const refLine: LineModel | null = refLineColor
    ? { width: lnIndex >= 3 ? 2.25 : lnIndex === 2 ? 1.5 : 0.75, color: refLineColor, dash: false }
    : null;

  const hasGeometry = child(spPr, "prstGeom") || child(spPr, "custGeom");
  const geometrySource = hasGeometry
    ? spPr
    : inheritedSpPr.find((inherited) => child(inherited, "prstGeom") || child(inherited, "custGeom"));
  const geometry: Geometry =
    node.name === "cxnSp" && !hasGeometry
      ? { kind: "preset", name: "line", adjust: {} }
      : readGeometry(geometrySource);

  let fill = readFillSpec(spPr, context, baseColor);
  if (fill === undefined && ref) {
    for (const inherited of inheritedSpPr) {
      fill = readFillSpec(inherited, context, baseColor);
      if (fill !== undefined) break;
    }
  }
  if (fill === undefined) fill = ref ? null : refFill;

  const line = readLine(child(spPr, "ln"), context, baseColor, refLine);

  let text: TextModel | undefined;
  const txBody = child(node, "txBody");
  if (txBody) {
    const styleName = ref
      ? normalizeType(ref.type) === "title"
        ? "titleStyle"
        : ["dt", "ftr", "sldNum"].includes(ref.type ?? "")
          ? "otherStyle"
          : "bodyStyle"
      : "otherStyle";
    text = readText(
      txBody,
      {
        context,
        globalLayers: [environment.defaultTextStyle, child(environment.txStyles, styleName)],
        baseColor,
        placeholderLayers: [
          child(path(masterPh?.node, "txBody"), "lstStyle"),
          child(path(layoutPh?.node, "txBody"), "lstStyle"),
        ],
        slideNumber: environment.slideNumber,
      },
      mergeBodyPr(child(txBody, "bodyPr"), path(layoutPh?.node, "txBody", "bodyPr"), path(masterPh?.node, "txBody", "bodyPr")),
    );
  }

  return { kind: "shape", frame, geometry, fill: fill ?? null, line, text };
}

function mediaOf(rels: Rels, pkg: Pkg, id: string | undefined) {
  const target = id ? rels[id]?.target : undefined;
  const bytes = target ? pkg.files[target] : undefined;
  return bytes && target ? { bytes, extension: (target.split(".").pop() ?? "").toLowerCase() } : undefined;
}

function readPicture(node: XNode, environment: SlideEnvironment, transform: Transform): PictureItem | undefined {
  const frame = readFrame(path(node, "spPr", "xfrm"), transform);
  const media = mediaOf(environment.rels, environment.pkg, attr(path(node, "blipFill", "blip"), "r:embed"));
  if (!frame || !media) return undefined;
  const src = path(node, "blipFill", "srcRect");
  const fraction = (name: string) => Math.max(0, Math.min(0.95, (num(src, name) ?? 0) / 100000));
  return { kind: "picture", frame, ...media, crop: { l: fraction("l"), t: fraction("t"), r: fraction("r"), b: fraction("b") } };
}

// ───────────────────────── tabelas ─────────────────────────

// Estilos de tabela embutidos do PowerPoint ("Medium Style 2 - Accent N"); não ficam no arquivo.
const ACCENT_BY_STYLE: Record<string, string> = {
  "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}": "accent1",
  "{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}": "accent2",
  "{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}": "accent3",
  "{00A15C55-8517-42AA-B614-E9B94910E393}": "accent4",
  "{7DF18680-E054-41AD-8BC1-D1AEF772440D}": "accent5",
  "{93296810-A885-4BE3-A3E7-6D5BEEA58F35}": "accent6",
  "{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}": "dk1",
};

const tintOf = (rgb: Rgb, value: number): Rgb => ({
  r: Math.round(255 - (255 - rgb.r) * value),
  g: Math.round(255 - (255 - rgb.g) * value),
  b: Math.round(255 - (255 - rgb.b) * value),
});

function readTable(table: XNode, frame: Frame, environment: SlideEnvironment): TableItem {
  const { context } = environment;
  const props = child(table, "tblPr");
  const accentKey = ACCENT_BY_STYLE[child(props, "tableStyleId")?.text.trim() ?? ""];
  const accent = accentKey ? context.theme.colors[accentKey] : undefined;
  const light = context.theme.colors.lt1 ?? WHITE.rgb;
  const dark = context.theme.colors.dk1 ?? BLACK.rgb;
  const firstRow = props?.attrs.firstRow === "1";
  const firstCol = props?.attrs.firstCol === "1";
  const bandRow = props?.attrs.bandRow === "1";

  const columns = kids(child(table, "tblGrid"), "gridCol").map((col) => emu(num(col, "w")));
  const rows: TableItem["rows"] = [];
  const coveredBelow = new Set<string>(); // "linha:coluna" cobertas por mesclagem vertical

  kids(table, "tr").forEach((trNode, rowIndex) => {
    const cells: TableCellModel[] = [];
    let column = 0;
    for (const tc of kids(trNode, "tc")) {
      const tcPr = child(tc, "tcPr");
      const gridSpan = num(tc, "gridSpan") ?? 1;
      const rowSpan = num(tc, "rowSpan") ?? 1;
      const covered = tc.attrs.hMerge === "1" || tc.attrs.vMerge === "1" || coveredBelow.has(`${rowIndex}:${column}`);
      for (let r = 1; r < rowSpan; r++) for (let c = 0; c < gridSpan; c++) coveredBelow.add(`${rowIndex + r}:${column + c}`);

      const isHeader = firstRow && rowIndex === 0;
      const emphasized = isHeader || (firstCol && column === 0);
      const dataIndex = rowIndex - (firstRow ? 1 : 0);
      const styleFill: Colored | null = accent
        ? { rgb: emphasized ? accent : tintOf(accent, bandRow && dataIndex % 2 === 0 ? 0.4 : 0.2), alpha: 1 }
        : null;
      const styleText: Colored | undefined = accent ? { rgb: emphasized ? light : dark, alpha: 1 } : undefined;

      const fill = readFillSpec(tcPr, context) ?? styleFill;
      const styleBorder: LineModel | null = accent ? { width: 1, color: { rgb: light, alpha: 1 }, dash: false } : null;
      const borders: TableCellModel["borders"] = {};
      for (const [side, name] of [["l", "lnL"], ["r", "lnR"], ["t", "lnT"], ["b", "lnB"]] as const) {
        const own = child(tcPr, name);
        borders[side] = own ? readLine(own, context, undefined, null) : styleBorder;
      }

      const txBody = child(tc, "txBody");
      const text = readText(
        txBody,
        {
          context,
          globalLayers: [environment.defaultTextStyle, child(environment.txStyles, "otherStyle")],
          baseColor: styleText,
          placeholderLayers: [],
          slideNumber: environment.slideNumber,
        },
        mergeBodyPr(child(txBody, "bodyPr")),
      ) ?? { paragraphs: [], anchor: "t" as const, insets: { l: 7.2, t: 3.6, r: 7.2, b: 3.6 }, wrap: true, fontScale: 1 };

      text.insets = {
        l: emu(num(tcPr, "marL"), 91440),
        t: emu(num(tcPr, "marT"), 45720),
        r: emu(num(tcPr, "marR"), 91440),
        b: emu(num(tcPr, "marB"), 45720),
      };
      text.anchor = tcPr?.attrs.anchor === "ctr" ? "ctr" : tcPr?.attrs.anchor === "b" ? "b" : "t";
      if (isHeader && accent) for (const para of text.paragraphs) for (const run of para.runs) run.bold = true;

      cells.push({ text, fill: fill ?? null, borders, gridSpan, rowSpan, covered });
      column += 1;
    }
    rows.push({ height: emu(num(trNode, "h")), cells });
  });

  return { kind: "table", frame, columns, rows };
}

function readGraphicFrame(node: XNode, environment: SlideEnvironment, transform: Transform): SlideItem | undefined {
  const frame = readFrame(child(node, "xfrm"), transform);
  if (!frame) return undefined;

  const data = path(node, "graphic", "graphicData");
  const table = child(data, "tbl");
  if (table) return readTable(table, frame, environment);

  const uri = attr(data, "uri") ?? "";
  return { kind: "unsupported", frame, label: /chart/i.test(uri) ? "Gráfico" : /diagram/i.test(uri) ? "Diagrama SmartArt" : "Objeto" };
}

// ───────────────────────── árvore de formas ─────────────────────────

function collectItems(
  tree: XNode | undefined,
  environment: SlideEnvironment,
  transform: Transform,
  includePlaceholders: boolean,
  out: SlideItem[],
): void {
  for (const node of expandAlternates(kids(tree))) {
    switch (node.name) {
      case "sp":
      case "cxnSp": {
        const ref = readPlaceholder(node);
        if (ref && !includePlaceholders) break; // placeholders do layout/mestre só servem de modelo
        const item = readShape(node, environment, transform, ref);
        if (item) out.push(item);
        break;
      }
      case "pic": {
        const item = readPicture(node, environment, transform);
        if (item) out.push(item);
        break;
      }
      case "graphicFrame": {
        const item = readGraphicFrame(node, environment, transform);
        if (item) out.push(item);
        break;
      }
      case "grpSp": {
        const xfrm = path(node, "grpSpPr", "xfrm");
        const [off, ext, chOff, chExt] = ["off", "ext", "chOff", "chExt"].map((name) => child(xfrm, name));
        let inner = transform;
        if (off && ext && chOff && chExt && (num(chExt, "cx") ?? 0) > 0 && (num(chExt, "cy") ?? 0) > 0) {
          const sx = ((num(ext, "cx") ?? 0) / (num(chExt, "cx") ?? 1)) * transform.sx;
          const sy = ((num(ext, "cy") ?? 0) / (num(chExt, "cy") ?? 1)) * transform.sy;
          inner = {
            sx,
            sy,
            tx: transform.tx + (num(off, "x") ?? 0) * transform.sx - (num(chOff, "x") ?? 0) * sx,
            ty: transform.ty + (num(off, "y") ?? 0) * transform.sy - (num(chOff, "y") ?? 0) * sy,
          };
        }
        collectItems(node, environment, inner, includePlaceholders, out);
        break;
      }
    }
  }
}

function readBackground(layers: Layer[], environment: SlideEnvironment): Background {
  for (const layer of layers) {
    const bg = path(layer.root, "cSld", "bg");
    if (!bg) continue;
    const { context, pkg } = environment;

    const properties = child(bg, "bgPr");
    if (properties) {
      const fill = readFillSpec(properties, context);
      if (fill) return fill;
      const media = mediaOf(layer.rels, pkg, attr(path(properties, "blipFill", "blip"), "r:embed"));
      if (media) return { kind: "picture", ...media };
      continue;
    }
    const color = colorIn(child(bg, "bgRef"), context);
    if (color) return color;
  }
  return WHITE;
}

/** Lê o .pptx e devolve o modelo achatado da apresentação (slides ocultos são ignorados). */
export function readPptx(bytes: Uint8Array): Deck {
  const pkg = new Pkg(unzipSync(bytes));
  const presentation = pkg.xml("ppt/presentation.xml");
  if (!presentation || presentation.name !== "presentation") {
    throw new Error("Não é uma apresentação do PowerPoint (.pptx).");
  }

  const size = child(presentation, "sldSz");
  const presentationRels = pkg.rels("ppt/presentation.xml");
  const defaultTextStyle = child(presentation, "defaultTextStyle");

  const slides: SlideModel[] = [];
  let number = 0;
  for (const slideId of kids(child(presentation, "sldIdLst"), "sldId")) {
    const slideFile = presentationRels[attr(slideId, "r:id") ?? ""]?.target;
    const slideRoot = pkg.xml(slideFile);
    if (!slideFile || !slideRoot) continue;
    number++;
    if (slideRoot.attrs.show === "0") continue; // slide oculto

    const slideRels = pkg.rels(slideFile);
    const layoutPath = relOfType(slideRels, "/slideLayout");
    const layoutRoot = pkg.xml(layoutPath);
    const layoutRels = pkg.rels(layoutPath);
    const masterPath = relOfType(layoutRels, "/slideMaster");
    const masterRoot = pkg.xml(masterPath);
    const masterRels = pkg.rels(masterPath);

    const colorMap: ColorMap = { ...child(masterRoot, "clrMap")?.attrs };
    Object.assign(colorMap, path(slideRoot, "clrMapOvr", "overrideClrMapping")?.attrs);
    const context: ColorContext = { theme: parseTheme(pkg.xml(relOfType(masterRels, "/theme"))), colorMap };

    const layer = (root: XNode | undefined, rels: Rels): Layer => ({ root, tree: path(root, "cSld", "spTree"), rels });
    const master = layer(masterRoot, masterRels);
    const layout = layer(layoutRoot, layoutRels);
    const slide = layer(slideRoot, slideRels);
    const environment: SlideEnvironment = {
      pkg,
      context,
      defaultTextStyle,
      txStyles: child(masterRoot, "txStyles"),
      master,
      layout,
      slide,
      slideNumber: number,
      rels: slideRels,
    };

    const items: SlideItem[] = [];
    const hideInherited = slideRoot.attrs.showMasterSp === "0";
    const hideMaster = hideInherited || layoutRoot?.attrs.showMasterSp === "0";
    // Formas decorativas do mestre e do layout ficam atrás das do slide (sem placeholders).
    if (!hideMaster) collectItems(master.tree, { ...environment, rels: masterRels }, IDENTITY, false, items);
    if (!hideInherited) collectItems(layout.tree, { ...environment, rels: layoutRels }, IDENTITY, false, items);
    collectItems(slide.tree, environment, IDENTITY, true, items);

    slides.push({ number, background: readBackground([slide, layout, master], environment), items });
  }

  return { width: emu(num(size, "cx"), 9144000), height: emu(num(size, "cy"), 6858000), slides };
}
