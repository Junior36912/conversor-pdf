import { compressPdfDocument, type CompressionLevel } from "@/app/lib/pdf/compress";
import {
  addTextWatermark,
  mergePdfDocuments,
  organizePdfDocument,
  PdfLoadError,
  splitPdfDocument,
  type PageEdit,
} from "@/app/lib/pdf/core";
import { analyzeDocument, type RawPage } from "@/app/lib/pdf/analyze-layout";
import { docxToPdf } from "@/app/lib/pdf/docx";
import { imagesToPdf, type ImageInput, type ImagesToPdfOptions } from "@/app/lib/pdf/images";
import { formatRange, type PageRange } from "@/app/lib/pdf/ranges";
import type { WatermarkOptions } from "@/app/lib/pdf/watermark";
import { writeDocx, type DocxOptions } from "@/app/lib/office/docx-writer";
import {
  writePptxFromImages,
  writePptxFromText,
  type PageImage,
} from "@/app/lib/office/pptx-writer";
import { pptxToPdf } from "@/app/lib/office/pptx/render";
import { xlsxToPdf, type XlsxToPdfOptions } from "@/app/lib/office/xlsx-render";
import { writeXlsx, type XlsxOptions } from "@/app/lib/office/xlsx-writer";
import { createZip } from "@/app/lib/zip";

export type PdfWorkerRequest =
  | { type: "merge"; buffers: ArrayBuffer[] }
  | { type: "split"; buffer: ArrayBuffer; ranges: PageRange[]; baseName: string }
  | { type: "zip"; entries: { name: string; buffer: ArrayBuffer }[] }
  | { type: "organize"; buffer: ArrayBuffer; pages: PageEdit[] }
  | { type: "compress"; buffer: ArrayBuffer; level: CompressionLevel }
  | { type: "watermark"; buffer: ArrayBuffer; options: WatermarkOptions }
  | { type: "images"; images: ImageInput[]; options: ImagesToPdfOptions }
  | { type: "docx"; buffer: ArrayBuffer }
  | { type: "pdf-to-docx"; pages: RawPage[]; options: DocxOptions & { removeRepeated: boolean } }
  | { type: "pdf-to-xlsx"; pages: RawPage[]; options: XlsxOptions & { removeRepeated: boolean } }
  | { type: "pdf-to-pptx-text"; pages: RawPage[]; removeRepeated: boolean }
  | { type: "pdf-to-pptx-images"; pages: PageImage[] }
  | { type: "xlsx"; buffer: ArrayBuffer; options: XlsxToPdfOptions }
  | { type: "pptx"; buffer: ArrayBuffer };

export type PdfOutputFormat = "pdf" | "zip" | "docx" | "xlsx" | "pptx";

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
      case "images":
        output = {
          result: await imagesToPdf(data.images, data.options, report),
          format: "pdf",
        };
        break;
      case "docx":
        output = { result: await docxToPdf(data.buffer), format: "pdf" };
        break;
      case "pdf-to-docx": {
        const { pages } = analyzeDocument(data.pages, { removeRepeated: data.options.removeRepeated });
        report(1, 2);
        output = { result: await writeDocx(pages, data.options), format: "docx" };
        break;
      }
      case "pdf-to-xlsx": {
        const { pages } = analyzeDocument(data.pages, { removeRepeated: data.options.removeRepeated });
        report(1, 2);
        output = { result: await writeXlsx(pages, data.options), format: "xlsx" };
        break;
      }
      case "pdf-to-pptx-text": {
        const { pages } = analyzeDocument(data.pages, { removeRepeated: data.removeRepeated });
        report(1, 2);
        output = { result: await writePptxFromText(pages), format: "pptx" };
        break;
      }
      case "pdf-to-pptx-images":
        output = { result: await writePptxFromImages(data.pages), format: "pptx" };
        break;
      case "xlsx":
        output = { result: await xlsxToPdf(data.buffer, data.options, report), format: "pdf" };
        break;
      case "pptx":
        output = { result: await pptxToPdf(data.buffer, report), format: "pdf" };
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
