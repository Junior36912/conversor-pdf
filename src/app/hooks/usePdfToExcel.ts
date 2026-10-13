"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { hasText } from "@/app/lib/pdf/analyze-layout";
import { extractRawPages } from "@/app/lib/pdf/extract";
import type { DecimalSeparator } from "@/app/lib/office/numbers";
import { NO_TABLES } from "@/app/lib/office/xlsx-writer";
import { fileBaseName } from "@/app/lib/utils";
import { PdfWorkerError, pdfToXlsxInWorker } from "@/app/lib/workers/pdf-worker-client";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

class NoTextError extends Error {}

export interface PdfToExcelOptions {
  perPage: boolean;
  includeText: boolean;
  convertNumbers: boolean;
  decimal: DecimalSeparator;
  removeRepeated: boolean;
}

export function usePdfToExcel() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File, options: PdfToExcelOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const pages = await extractRawPages(file, {
            signal,
            onProgress: (done, total) => onProgress(Math.round((done / total) * 80)),
          });
          if (!hasText(pages)) throw new NoTextError();

          const xlsx = await pdfToXlsxInWorker(pages, options, { signal });
          onProgress(100);

          const filename = `${fileBaseName(file.name)}.xlsx`;
          downloadBlob(xlsx, filename, XLSX_TYPE);
          setOutputName(filename);
        },
        (cause) => {
          if (cause instanceof NoTextError) {
            return "Este PDF não tem texto selecionável (parece digitalizado). Para convertê-lo seria preciso OCR, que ainda não está disponível.";
          }
          if (cause instanceof PdfWorkerError && cause.message === NO_TABLES) {
            return "Não encontrei tabelas neste PDF. Ative \"Incluir texto fora das tabelas\" para exportar o texto.";
          }
          return `Não foi possível converter "${file.name}". Ele pode estar corrompido ou protegido por senha.`;
        },
      ),
    [run],
  );

  return { ...task, convert };
}
