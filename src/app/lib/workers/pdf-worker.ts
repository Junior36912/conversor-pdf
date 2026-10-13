import { compressPdfDocument, type CompressionLevel } from "@/app/lib/pdf/compress";
import {
  addTextWatermark,
  mergePdfDocuments,
  organizePdfDocument,
  PdfLoadError,
  splitPdfDocument,
  type PageEdit,
} from "@/app/lib/pdf/core";
import { formatRange, type PageRange } from "@/app/lib/pdf/ranges";
import type { WatermarkOptions } from "@/app/lib/pdf/watermark";
import { createZip } from "@/app/lib/zip";

export type PdfWorkerRequest =
  | { type: "merge"; buffers: ArrayBuffer[] }
  | { type: "split"; buffer: ArrayBuffer; ranges: PageRange[]; baseName: string }
  | { type: "zip"; entries: { name: string; buffer: ArrayBuffer }[] }
  | { type: "organize"; buffer: ArrayBuffer; pages: PageEdit[] }
  | { type: "compress"; buffer: ArrayBuffer; level: CompressionLevel }
  | { type: "watermark"; buffer: ArrayBuffer; options: WatermarkOptions };

export type PdfOutputFormat = "pdf" | "zip";

export type PdfWorkerResponse =
  | { type: "progress"; completed: number; total: number }
  | {
      type: "done";
      result: Uint8Array<ArrayBuffer>;
      format: PdfOutputFormat;
    }
  | { type: "error"; message: string; failedIndex?: number };

// O lib "dom" tipa `self` como Window; aqui só precisamos do contrato do worker.
const ctx = self as unknown as {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<PdfWorkerRequest>) => void,
  ): void;
  postMessage(message: PdfWorkerResponse, transfer?: Transferable[]): void;
};

type Output = { result: Uint8Array<ArrayBuffer>; format: PdfOutputFormat };
type Report = (completed: number, total: number) => void;

async function runSplit(
  { buffer, ranges, baseName }: Extract<PdfWorkerRequest, { type: "split" }>,
  report: Report,
): Promise<Output> {
  const parts = await splitPdfDocument(buffer, ranges, report);
  if (parts.length === 1) return { result: parts[0], format: "pdf" };

  const pad = String(parts.length).length;
  const entries = parts.map((data, index) => ({
    // O índice no nome garante unicidade mesmo com intervalos repetidos.
    name: `${baseName}_parte-${String(index + 1).padStart(pad, "0")}_pag-${formatRange(ranges[index])}.pdf`,
    data,
  }));
  return { result: createZip(entries), format: "zip" };
}

ctx.addEventListener("message", async ({ data }) => {
  const report: Report = (completed, total) =>
    ctx.postMessage({ type: "progress", completed, total });

  try {
    let output: Output;
    switch (data.type) {
      case "merge":
        output = {
          result: await mergePdfDocuments(data.buffers, report),
          format: "pdf",
        };
        break;
      case "split":
        output = await runSplit(data, report);
        break;
      case "zip":
        output = {
          result: createZip(
            data.entries.map(({ name, buffer }) => ({ name, data: new Uint8Array(buffer) })),
          ),
          format: "zip",
        };
        break;
      case "organize":
        output = {
          result: await organizePdfDocument(data.buffer, data.pages, report),
          format: "pdf",
        };
        break;
      case "compress":
        output = {
          result: await compressPdfDocument(data.buffer, data.level, report),
          format: "pdf",
        };
        break;
      case "watermark":
        output = {
          result: await addTextWatermark(data.buffer, data.options, report),
          format: "pdf",
        };
        break;
      default:
        return;
    }
    // Transfere o buffer (zero-copy) em vez de cloná-lo.
    ctx.postMessage({ type: "done", ...output }, [output.result.buffer]);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
      failedIndex: error instanceof PdfLoadError ? error.index : undefined,
    });
  }
});
