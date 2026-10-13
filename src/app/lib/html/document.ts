// Preparação de HTML de terceiros para conversão: o documento roda numa <iframe> isolada (sem
// scripts e sem acesso à rede), para que converter uma página nunca execute código nem envie nada.

export interface PageSetup {
  size: "a4" | "letter";
  orientation: "portrait" | "landscape";
  margin: "none" | "small" | "normal";
}

// Tamanhos em pixels CSS (96 por polegada).
const PAGE_PX = { a4: [794, 1123], letter: [816, 1056] } as const;
const MARGIN_PX = { none: 0, small: 24, normal: 48 } as const;

export interface PageMetrics {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
}

export function pageMetrics({ size, orientation, margin }: PageSetup): PageMetrics {
  const [short, long] = PAGE_PX[size];
  const [pageWidth, pageHeight] = orientation === "landscape" ? [long, short] : [short, long];
  const edge = MARGIN_PX[margin];
  return {
    pageWidth,
    pageHeight,
    margin: edge,
    contentWidth: pageWidth - 2 * edge,
    contentHeight: pageHeight - 2 * edge,
  };
}

// Só dados embutidos (data:/blob:) e estilos inline: nenhuma requisição de rede é permitida.
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; media-src data:";

const REMOVED = "script, iframe, frame, object, embed, base, meta[http-equiv], noscript";
const EXTERNAL_REFERENCES = "img[src], source[src], video[src], audio[src], link[href], input[src]";

const isEmbedded = (url: string) => /^\s*(data:|blob:|#)/i.test(url);

export interface PreparedDocument {
  html: string;
  /** Quantidade de imagens/estilos externos (da internet ou de arquivos) que não são carregados. */
  blocked: number;
}

/** Limpa o HTML, injeta a política de segurança e a regra @page, e conta recursos bloqueados. */
export function prepareDocument(source: string, setup: PageSetup): PreparedDocument {
  const doc = new DOMParser().parseFromString(source, "text/html");

  let blocked = 0;
  for (const element of doc.querySelectorAll(EXTERNAL_REFERENCES)) {
    const url = element.getAttribute("src") ?? element.getAttribute("href") ?? "";
    const isStylesheet = element.tagName === "LINK" && /stylesheet/i.test(element.getAttribute("rel") ?? "");
    if ((element.tagName !== "LINK" || isStylesheet) && url && !isEmbedded(url)) blocked++;
  }
  for (const element of doc.querySelectorAll("[style*='url(']")) {
    if (/url\(\s*['"]?(?!data:|blob:|#)/i.test(element.getAttribute("style") ?? "")) blocked++;
  }

  doc.querySelectorAll(REMOVED).forEach((element) => element.remove());

  const policy = doc.createElement("meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", CONTENT_SECURITY_POLICY);
  doc.head.prepend(policy);

  const margin = { none: "0", small: "6mm", normal: "12mm" }[setup.margin];
  const page = doc.createElement("style");
  page.textContent = `@page { size: ${setup.size === "a4" ? "A4" : "letter"} ${setup.orientation}; margin: ${margin}; }`;
  doc.head.append(page);

  return { html: `<!doctype html>${doc.documentElement.outerHTML}`, blocked };
}
