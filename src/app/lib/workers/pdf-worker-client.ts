import type {
  PdfOutputFormat,
  PdfWorkerRequest,
  PdfWorkerResponse,
} from "./pdf-worker";
import type { CompressionLevel } from "@/app/lib/pdf/compress";
import type { PageEdit } from "@/app/lib/pdf/core";
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

/** Mensagem de erro para o usuário: cita o arquivo se o worker não conseguiu abri-lo. */
export function describePdfError(file: File, fallback: string) {
  return (cause: unknown): string =>
    cause instanceof PdfWorkerError && cause.failedIndex !== undefined
      ? `Não foi possível ler "${file.name}". Ele pode estar corrompido ou protegido por senha.`
      : fallback;
}
