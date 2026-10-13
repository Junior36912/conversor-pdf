"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import {
  EMPTY_WORKBOOK,
  WORKBOOK_TOO_LARGE,
  type XlsxToPdfOptions,
} from "@/app/lib/office/xlsx-render";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  PdfWorkerError,
  xlsxToPdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function useExcelToPdf() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File, options: XlsxToPdfOptions) => {
      const readError = describePdfError(
        file,
        "Ocorreu um erro ao converter a planilha. Tente novamente.",
        "O arquivo pode estar corrompido, protegido por senha ou não ser um .xlsx válido.",
      );
      return run(
        async ({ signal, onProgress, setOutputName }) => {
          const pdf = await xlsxToPdfInWorker(await file.arrayBuffer(), options, { onProgress, signal });
          const filename = `${fileBaseName(file.name)}.pdf`;
          downloadBlob(pdf, filename);
          setOutputName(filename);
        },
        (cause) => {
          if (cause instanceof PdfWorkerError && cause.message === EMPTY_WORKBOOK) {
            return "A planilha não tem dados visíveis para converter (todas as planilhas estão vazias ou ocultas).";
          }
          if (cause instanceof PdfWorkerError && cause.message === WORKBOOK_TOO_LARGE) {
            return "Uma das planilhas tem mais de 10.000 linhas, o que geraria um PDF enorme. Divida a planilha e converta em partes.";
          }
          return readError(cause);
        },
      );
    },
    [run],
  );

  return { ...task, convert };
}
