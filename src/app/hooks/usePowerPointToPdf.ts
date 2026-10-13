"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { NO_SLIDES } from "@/app/lib/office/pptx/render";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  PdfWorkerError,
  pptxToPdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function usePowerPointToPdf() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File) => {
      const readError = describePdfError(
        file,
        "Ocorreu um erro ao converter a apresentação. Tente novamente.",
        "O arquivo pode estar corrompido, protegido por senha ou não ser um .pptx válido.",
      );
      return run(
        async ({ signal, onProgress, setOutputName }) => {
          const pdf = await pptxToPdfInWorker(await file.arrayBuffer(), { onProgress, signal });
          const filename = `${fileBaseName(file.name)}.pdf`;
          downloadBlob(pdf, filename);
          setOutputName(filename);
        },
        (cause) =>
          cause instanceof PdfWorkerError && cause.message === NO_SLIDES
            ? "A apresentação não tem slides visíveis para converter (todos estão ocultos)."
            : readError(cause),
      );
    },
    [run],
  );

  return { ...task, convert };
}
