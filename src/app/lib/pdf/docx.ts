import { convert } from "docx-to-pdf-wasm";
import { PdfLoadError } from "./core";
import { prepareDocx } from "./docx-prepare";

let compiled: Promise<WebAssembly.Module> | null = null;

/**
 * Baixa e compila o motor (2,4 MB) uma única vez por worker. Usamos `fetch` + `compile` em vez
 * de `compileStreaming` para não depender de o servidor responder com `application/wasm`.
 */
function loadConverter(): Promise<WebAssembly.Module> {
  compiled ??= fetch(new URL("docx-to-pdf-wasm/docx-to-pdf.wasm", import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Falha ao carregar o conversor (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((bytes) => WebAssembly.compile(bytes));
  return compiled;
}

/**
 * Converte um .docx em PDF. A fidelidade é aproximada: as fontes do Office são trocadas pelas
 * Liberation, notas de rodapé não são desenhadas e recursos avançados podem ser ignorados.
 * Só deve rodar dentro do Web Worker.
 */
export async function docxToPdf(buffer: ArrayBuffer): Promise<Uint8Array<ArrayBuffer>> {
  const converter = await loadConverter();
  try {
    return (await convert(converter, prepareDocx(new Uint8Array(buffer)))) as Uint8Array<ArrayBuffer>;
  } catch (cause) {
    // O motor devolve erro (em vez de um PDF corrompido) para arquivos que não consegue ler.
    throw new PdfLoadError(0, cause);
  }
}
