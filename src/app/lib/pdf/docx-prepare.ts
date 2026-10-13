import { unzipSync, zipSync } from "fflate";

// O motor de conversão (docx-to-pdf-wasm) ignora duas coisas muito comuns em arquivos do Word:
//  1. marcadores gravados como caracteres da área privada das fontes Symbol/Wingdings (U+F0xx);
//  2. bordas de tabela definidas no *estilo* da tabela (ex.: "Table Grid") em vez de na própria tabela.
// Reescrevemos esses dois pontos no XML antes de converter. Qualquer falha aqui só faz o arquivo
// seguir sem correção (ver `convertDocx`), nunca impede a conversão.

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const BULLET = "•";

/** Troca marcadores da área privada (Symbol/Wingdings) por "•" e remove a fonte especial do nível. */
function fixBullets(numbering: string): string {
  return numbering.replace(/<w:lvl\b[\s\S]*?<\/w:lvl>/g, (level) => {
    if (!/<w:numFmt w:val="bullet"\s*\/>/.test(level)) return level;
    const text = /<w:lvlText w:val="([^"]*)"\s*\/>/.exec(level)?.[1] ?? "";
    const isPrivateUse = [...text].some((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0xf000 && code <= 0xf8ff;
    });
    if (!isPrivateUse) return level;
    return level
      .replace(/<w:lvlText w:val="[^"]*"\s*\/>/, `<w:lvlText w:val="${BULLET}"/>`)
      .replace(/<w:rFonts\b[^>]*\/>/, "");
  });
}

/** `<w:tblBorders>` do estilo (seguindo `basedOn`, até 5 níveis), ou `undefined`. */
function styleTableBorders(styles: string, styleId: string): string | undefined {
  let id: string | undefined = styleId;
  for (let depth = 0; id && depth < 5; depth++) {
    const style: string | undefined = new RegExp(
      `<w:style\\b[^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`,
    ).exec(styles)?.[0];
    if (!style) return undefined;
    const borders = /<w:tblBorders>[\s\S]*?<\/w:tblBorders>/.exec(style)?.[0];
    if (borders) return borders;
    id = /<w:basedOn w:val="([^"]+)"/.exec(style)?.[1];
  }
  return undefined;
}

/** Copia para cada tabela as bordas do seu estilo, quando ela não tem bordas próprias. */
function inlineTableBorders(document: string, styles: string): string {
  return document.replace(/<w:tblPr>[\s\S]*?<\/w:tblPr>/g, (tblPr) => {
    if (tblPr.includes("<w:tblBorders>")) return tblPr;
    const styleId = /<w:tblStyle w:val="([^"]+)"/.exec(tblPr)?.[1];
    const borders = styleId && styleTableBorders(styles, styleId);
    if (!borders) return tblPr;

    // Ordem do esquema: ... tblInd, tblBorders, shd, tblLayout, tblCellMar, tblLook.
    const anchor = /<w:(shd|tblLayout|tblCellMar|tblLook)\b/.exec(tblPr);
    return anchor
      ? tblPr.slice(0, anchor.index) + borders + tblPr.slice(anchor.index)
      : tblPr.replace("</w:tblPr>", `${borders}</w:tblPr>`);
  });
}

/** Devolve o .docx com os ajustes aplicados (ou o original, se algo falhar). */
export function prepareDocx(docx: Uint8Array): Uint8Array {
  try {
    const files = unzipSync(docx);
    const read = (path: string) => (files[path] ? decoder.decode(files[path]) : undefined);

    const numbering = read("word/numbering.xml");
    if (numbering) files["word/numbering.xml"] = encoder.encode(fixBullets(numbering));

    const document = read("word/document.xml");
    const styles = read("word/styles.xml");
    if (document && styles) {
      files["word/document.xml"] = encoder.encode(inlineTableBorders(document, styles));
    }

    return zipSync(files);
  } catch {
    return docx;
  }
}
