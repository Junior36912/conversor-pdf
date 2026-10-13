import type { RawItem, RawPage } from "./analyze-layout";
import { loadPdfJs } from "./render";

interface ExtractOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

interface FontInfo {
  name: string;
  bold: boolean;
  italic: boolean;
}

const BOLD = /bold|black|heavy|semibold|demi/i;
const ITALIC = /italic|oblique/i;

/**
 * Lê o texto de cada página do PDF com o pdf.js: posição, tamanho, fonte e estilo (negrito/itálico,
 * pelo nome real da fonte). As coordenadas saem em pontos, com origem no canto superior esquerdo e
 * já considerando a rotação da página. Texto vertical/girado é ignorado.
 * Roda na main thread (o pdf.js já faz o parse em um worker próprio); a análise de layout e a
 * escrita do arquivo acontecem depois, no Web Worker.
 */
export async function extractRawPages(
  file: File,
  { signal, onProgress }: ExtractOptions = {},
): Promise<RawPage[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: RawPage[] = [];

  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      signal?.throwIfAborted();

      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      // Carregar a lista de operações faz o pdf.js resolver as fontes (nome, negrito, itálico).
      await page.getOperatorList();

      const fonts = new Map<string, FontInfo>();
      const fontOf = (id: string): FontInfo => {
        let info = fonts.get(id);
        if (!info) {
          let name = "";
          let bold = false;
          let italic = false;
          try {
            const font = page.commonObjs.get(id) as { name?: string; bold?: boolean; italic?: boolean };
            name = font.name ?? "";
            bold = Boolean(font.bold) || BOLD.test(name);
            italic = Boolean(font.italic) || ITALIC.test(name);
          } catch {
            // Fonte não resolvida: segue sem estilo.
          }
          info = { name, bold, italic };
          fonts.set(id, info);
        }
        return info;
      };

      const items: RawItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str === "") continue;
        const [a, b, c, d, e, f] = pdfjs.Util.transform(viewport.transform, item.transform);
        // Texto na vertical ou girado (b grande) não entra na análise de linhas.
        if (Math.abs(b) > Math.abs(a) * 0.3) continue;

        const font = fontOf(item.fontName);
        items.push({
          text: item.str,
          x: e,
          y: f,
          width: item.width,
          fontSize: Math.hypot(c, d),
          bold: font.bold,
          italic: font.italic,
          font: font.name,
        });
      }

      pages.push({ number, width: viewport.width, height: viewport.height, items });
      page.cleanup();
      onProgress?.(number, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}
