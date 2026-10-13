import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

// Fontes livres (OFL/Apache) métrica-compatíveis com as do Office: Arimo = Arial/Helvetica,
// Tinos = Times New Roman, Cousine = Courier New. Têm as letras latinas com acento, pontuação e
// símbolos comuns (€, •, –, —). Cada arquivo tem ~15 KB e só os glifos usados entram no PDF.
const FONT_URLS = {
  sans: {
    regular: new URL("@fontsource/arimo/files/arimo-latin-400-normal.woff", import.meta.url),
    bold: new URL("@fontsource/arimo/files/arimo-latin-700-normal.woff", import.meta.url),
    italic: new URL("@fontsource/arimo/files/arimo-latin-400-italic.woff", import.meta.url),
    boldItalic: new URL("@fontsource/arimo/files/arimo-latin-700-italic.woff", import.meta.url),
  },
  serif: {
    regular: new URL("@fontsource/tinos/files/tinos-latin-400-normal.woff", import.meta.url),
    bold: new URL("@fontsource/tinos/files/tinos-latin-700-normal.woff", import.meta.url),
    italic: new URL("@fontsource/tinos/files/tinos-latin-400-italic.woff", import.meta.url),
    boldItalic: new URL("@fontsource/tinos/files/tinos-latin-700-italic.woff", import.meta.url),
  },
  mono: {
    regular: new URL("@fontsource/cousine/files/cousine-latin-400-normal.woff", import.meta.url),
    bold: new URL("@fontsource/cousine/files/cousine-latin-700-normal.woff", import.meta.url),
    italic: new URL("@fontsource/cousine/files/cousine-latin-400-italic.woff", import.meta.url),
    boldItalic: new URL("@fontsource/cousine/files/cousine-latin-700-italic.woff", import.meta.url),
  },
} as const;

export type FontFamily = keyof typeof FONT_URLS;
type Face = keyof (typeof FONT_URLS)["sans"];

const downloads = new Map<string, Promise<ArrayBuffer>>();
function download(family: FontFamily, face: Face): Promise<ArrayBuffer> {
  const key = `${family}/${face}`;
  let promise = downloads.get(key);
  if (!promise) {
    promise = fetch(FONT_URLS[family][face]).then((response) => {
      if (!response.ok) throw new Error(`Falha ao carregar a fonte (${response.status}).`);
      return response.arrayBuffer();
    });
    downloads.set(key, promise);
  }
  return promise;
}

export interface UnicodeFonts {
  /** Fonte da família pedida (cai na sem serifa se a família não foi carregada). */
  pick(bold: boolean, italic: boolean, family?: FontFamily): PDFFont;
  /** Troca por "?" o que a fonte não tem (outros alfabetos) e normaliza espaços/quebras. */
  sanitize(text: string): string;
}

const faceOf = (bold: boolean, italic: boolean): Face =>
  bold ? (italic ? "boldItalic" : "bold") : italic ? "italic" : "regular";

/**
 * Embute no PDF as quatro variações de cada família pedida (a sem serifa sempre vem junto).
 * Só as famílias realmente usadas devem ser listadas: cada uma baixa ~60 KB.
 */
export async function embedUnicodeFonts(
  doc: PDFDocument,
  families: Iterable<FontFamily> = ["sans"],
): Promise<UnicodeFonts> {
  doc.registerFontkit(fontkit);
  const wanted = [...new Set<FontFamily>(["sans", ...families])];
  const faces = Object.keys(FONT_URLS.sans) as Face[];

  const embedded = new Map<string, PDFFont>();
  await Promise.all(
    wanted.flatMap((family) =>
      faces.map(async (face) => {
        embedded.set(`${family}/${face}`, await doc.embedFont(await download(family, face), { subset: true }));
      }),
    ),
  );

  const supported = new Set(embedded.get("sans/regular")!.getCharacterSet());

  return {
    pick: (bold, italic, family = "sans") =>
      embedded.get(`${family}/${faceOf(bold, italic)}`) ?? embedded.get(`sans/${faceOf(bold, italic)}`)!,
    sanitize: (text) =>
      Array.from(text.replace(/[\t\r\n\u000b\u000c]+/g, " "), (char) =>
        supported.has(char.codePointAt(0) ?? 0) ? char : "?",
      ).join(""),
  };
}
