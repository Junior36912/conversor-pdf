import { computeBreaks } from "./paginate";
import { pageMetrics, type PageSetup } from "./document";

/** Escala da captura: 2x deixa o texto nítido ao ampliar o PDF. */
export const CAPTURE_SCALE = 2;

interface RenderOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

function backgroundOf(doc: Document): string {
  const view = doc.defaultView;
  for (const element of [doc.body, doc.documentElement]) {
    const color = view?.getComputedStyle(element).backgroundColor;
    if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
  }
  return "#ffffff";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível desenhar a página."));
    image.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error("Falha ao gerar a imagem."))),
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Captura cada página do documento da <iframe> como imagem JPEG, usando o próprio motor do
 * navegador (SVG com foreignObject) para desenhar o HTML. O texto fica como imagem no PDF.
 * A iframe precisa estar com a largura do conteúdo da página (ver `pageMetrics`).
 */
export async function captureHtmlPages(
  frame: HTMLIFrameElement,
  setup: PageSetup,
  { signal, onProgress }: RenderOptions = {},
): Promise<ArrayBuffer[]> {
  const doc = frame.contentDocument;
  if (!doc?.body) throw new Error("Documento ainda não carregado.");
  await doc.fonts?.ready;

  const metrics = pageMetrics(setup);
  const starts = computeBreaks(doc, metrics.contentHeight);
  const total = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
  const background = backgroundOf(doc);

  const serializer = new XMLSerializer(); // só existe no navegador (não pode ficar no topo do módulo)
  const styles = Array.from(doc.head.querySelectorAll("style"), (style) => serializer.serializeToString(style)).join("");
  const body = serializer.serializeToString(doc.body);

  const pages: ArrayBuffer[] = [];
  for (const [index, start] of starts.entries()) {
    signal?.throwIfAborted();

    const end = Math.min(starts[index + 1] ?? total, start + metrics.contentHeight);
    const sliceHeight = Math.max(1, Math.ceil(end - start));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${metrics.contentWidth}" height="${sliceHeight}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${metrics.contentWidth}px;transform:translateY(-${start}px);background:${background}">` +
      `${styles}${body}</div></foreignObject></svg>`;

    // Precisa ser data URL: SVG com foreignObject vindo de `blob:` "contamina" o canvas e o navegador
    // passa a recusar toBlob/toDataURL.
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    {
      const image = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = metrics.pageWidth * CAPTURE_SCALE;
      canvas.height = metrics.pageHeight * CAPTURE_SCALE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível.");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        metrics.margin * CAPTURE_SCALE,
        metrics.margin * CAPTURE_SCALE,
        metrics.contentWidth * CAPTURE_SCALE,
        sliceHeight * CAPTURE_SCALE,
      );
      pages.push(await toJpeg(canvas));
    }
    onProgress?.(index + 1, starts.length);
  }
  return pages;
}
