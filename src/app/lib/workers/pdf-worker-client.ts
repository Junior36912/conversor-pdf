import type {
  PdfOutputFormat,
  PdfWorkerRequest,
  PdfWorkerResponse,
} from "./pdf-worker";
import type { CompressionLevel } from "@/app/lib/pdf/compress";
import type { RawPage } from "@/app/lib/pdf/analyze-layout";
import type { DocxOptions } from "@/app/lib/office/docx-writer";
import type { PageImage } from "@/app/lib/office/pptx-writer";
import type { XlsxOptions } from "@/app/lib/office/xlsx-writer";
import type { PageEdit } from "@/app/lib/pdf/core";
import type { ImageInput, ImagesToPdfOptions } from "@/app/lib/pdf/images";
import type { PageRange } from "@/app/lib/pdf/ranges";
import type { WatermarkOptions } from "@/app/lib/pdf/watermark";

export class PdfWorkerError extends Error {
  constructor(
    message: string,
    /** Índice (na lista enviada) do PDF que causou a falha, quando conhecido. */
    readonly failedIndex?: number,
  ) {
    super(message);
    this.name = "PdfWorkerError";
  }
}

interface WorkerOptions {
  /** Recebe um valor de 0 a 100. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface WorkerOutput {
  bytes: Uint8Array<ArrayBuffer>;
  format: PdfOutputFormat;
}

/**
 * Executa uma tarefa em um Web Worker dedicado. Cada chamada cria (e encerra) um
 * worker, o que libera toda a memória do pdf-lib ao terminar. Os buffers listados em
 * `transfer` são *transferidos*: depois da chamada ficam vazios (detached) aqui.
 */
function runInWorker(
  request: PdfWorkerRequest,
  transfer: ArrayBuffer[],
  { onProgress, signal }: WorkerOptions = {},
): Promise<WorkerOutput> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Operação cancelada.", "AbortError"));
      return;
    }

    // A forma `new Worker(new URL(...))` precisa ser literal para o bundler detectá-la.
    const worker = new Worker(new URL("./pdf-worker.ts", import.meta.url), {
      type: "module",
    });

    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Operação cancelada.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = ({ data }: MessageEvent<PdfWorkerResponse>) => {
      switch (data.type) {
        case "progress":
          onProgress?.(Math.round((data.completed / data.total) * 100));
          break;
        case "done":
          finish();
          resolve({ bytes: data.result, format: data.format });
          break;
        case "error":
          finish();
          reject(new PdfWorkerError(data.message, data.failedIndex));
          break;
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(new PdfWorkerError(event.message || "Falha inesperada no worker."));
    };

    worker.postMessage(request, transfer);
  });
}

/** Junta os PDFs, na ordem recebida, em um único PDF. */
export async function mergePdfsInWorker(
  buffers: ArrayBuffer[],
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "merge", buffers }, buffers, options);
  return bytes;
}

/** Gera um PDF por intervalo; com mais de um intervalo, o resultado é um ZIP. */
export function splitPdfInWorker(
  buffer: ArrayBuffer,
  ranges: PageRange[],
  baseName: string,
  options?: WorkerOptions,
): Promise<WorkerOutput> {
  return runInWorker({ type: "split", buffer, ranges, baseName }, [buffer], options);
}

/** Empacota arquivos já prontos (ex.: imagens) em um ZIP. */
export async function zipInWorker(
  entries: { name: string; buffer: ArrayBuffer }[],
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker(
    { type: "zip", entries },
    entries.map(({ buffer }) => buffer),
    options,
  );
  return bytes;
}

/** Reordena, gira e exclui páginas: o PDF de saída tem exatamente as páginas de `pages`. */
export async function organizePdfInWorker(
  buffer: ArrayBuffer,
  pages: PageEdit[],
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "organize", buffer, pages }, [buffer], options);
  return bytes;
}

/** Reduz o tamanho do PDF (o resultado pode ficar do mesmo tamanho se não houver o que reduzir). */
export async function compressPdfInWorker(
  buffer: ArrayBuffer,
  level: CompressionLevel,
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "compress", buffer, level }, [buffer], options);
  return bytes;
}

/** Aplica uma marca d'água de texto nas páginas indicadas em `watermark.pages`. */
export async function watermarkPdfInWorker(
  buffer: ArrayBuffer,
  watermark: WatermarkOptions,
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker(
    { type: "watermark", buffer, options: watermark },
    [buffer],
    options,
  );
  return bytes;
}

/** Cria um PDF com uma imagem por página, na ordem recebida. */
export async function imagesToPdfInWorker(
  images: ImageInput[],
  imageOptions: ImagesToPdfOptions,
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker(
    { type: "images", images, options: imageOptions },
    images.map(({ buffer }) => buffer),
    options,
  );
  return bytes;
}

/** Converte um .docx em PDF (motor leve em WebAssembly; fidelidade aproximada). */
export async function docxToPdfInWorker(
  buffer: ArrayBuffer,
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "docx", buffer }, [buffer], options);
  return bytes;
}

/** Monta um .docx editável a partir do texto extraído das páginas de um PDF. */
export async function pdfToDocxInWorker(
  pages: RawPage[],
  docxOptions: DocxOptions & { removeRepeated: boolean },
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "pdf-to-docx", pages, options: docxOptions }, [], options);
  return bytes;
}

/** Monta uma planilha .xlsx com as tabelas (e o texto) extraídos de um PDF. */
export async function pdfToXlsxInWorker(
  pages: RawPage[],
  xlsxOptions: XlsxOptions & { removeRepeated: boolean },
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "pdf-to-xlsx", pages, options: xlsxOptions }, [], options);
  return bytes;
}

/** Monta um .pptx com caixas de texto e tabelas editáveis nas posições do PDF. */
export async function pdfToPptxTextInWorker(
  pages: RawPage[],
  removeRepeated: boolean,
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker({ type: "pdf-to-pptx-text", pages, removeRepeated }, [], options);
  return bytes;
}

/** Monta um .pptx em que cada slide é a imagem de uma página do PDF. */
export async function pdfToPptxImagesInWorker(
  pages: PageImage[],
  options?: WorkerOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { bytes } = await runInWorker(
    { type: "pdf-to-pptx-images", pages },
    pages.map(({ jpeg }) => jpeg),
    options,
  );
  return bytes;
}

/**
 * Mensagem de erro para o usuário: cita o arquivo se o worker não conseguiu abri-lo.
 * Com uma lista de arquivos, usa o índice informado pelo worker para achar o culpado.
 */
export function describePdfError(
  fileOrFiles: File | File[],
  fallback: string,
  reason = "Ele pode estar corrompido ou protegido por senha.",
) {
  return (cause: unknown): string => {
    if (!(cause instanceof PdfWorkerError) || cause.failedIndex === undefined) return fallback;
    const failed = Array.isArray(fileOrFiles) ? fileOrFiles[cause.failedIndex] : fileOrFiles;
    return failed ? `Não foi possível ler "${failed.name}". ${reason}` : fallback;
  };
}
