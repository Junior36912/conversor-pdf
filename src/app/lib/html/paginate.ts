interface Box {
  top: number;
  bottom: number;
}

/** Elementos que não devem ser cortados no meio por uma quebra de página. */
const ATOMIC = "img, svg, canvas, video, hr, tr";

function textLineBoxes(doc: Document): Box[] {
  const boxes: Box[] = [];
  const range = doc.createRange();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.height > 0) boxes.push({ top: rect.top, bottom: rect.bottom });
    }
  }
  return boxes;
}

function forcedBreaks(doc: Document, scrollTop: number): number[] {
  const tops: number[] = [];
  for (const element of doc.body.querySelectorAll("*")) {
    const style = doc.defaultView?.getComputedStyle(element);
    if (!style) continue;
    const before = style.getPropertyValue("break-before") || style.getPropertyValue("page-break-before");
    if (/^(page|always|left|right)$/.test(before)) tops.push(element.getBoundingClientRect().top + scrollTop);
  }
  return tops.sort((a, b) => a - b);
}

/**
 * Posições (em px do documento) onde cada página começa. Procura cortar entre linhas de texto,
 * imagens e linhas de tabela; respeita `break-before: page` / `page-break-before: always`.
 * Se um bloco for mais alto que a página, o corte acontece no limite da página.
 */
export function computeBreaks(doc: Document, contentHeight: number): number[] {
  const total = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
  const scrollTop = doc.defaultView?.scrollY ?? 0;

  const boxes = [
    ...textLineBoxes(doc),
    ...Array.from(doc.body.querySelectorAll(ATOMIC), (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
  ].map((box) => ({ top: box.top + scrollTop, bottom: box.bottom + scrollTop }));
  const forced = forcedBreaks(doc, scrollTop);

  const starts = [0];
  let start = 0;
  // Evita páginas minúsculas quando só existe um corte candidato muito perto do início.
  const minimumFill = contentHeight * 0.3;

  // Uma quebra forçada vale mesmo quando o resto do conteúdo caberia na página atual.
  for (;;) {
    const limit = start + contentHeight;

    const force = forced.find((top) => top > start + 1 && top < total - 1 && top <= limit);
    if (force !== undefined) {
      starts.push(force);
      start = force;
      continue;
    }
    if (limit >= total - 1) break; // o resto cabe nesta página

    const candidates = [...new Set(boxes.map((box) => Math.round(box.bottom)))]
      .filter((bottom) => bottom > start + minimumFill && bottom <= limit)
      .sort((a, b) => b - a);
    const cut = candidates.find(
      (bottom) => !boxes.some((box) => box.top < bottom - 0.5 && box.bottom > bottom + 0.5),
    );

    start = cut ?? limit;
    starts.push(start);
  }
  return starts;
}
