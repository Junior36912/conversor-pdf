"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { fileBaseName } from "@/app/lib/utils";
import { describePdfError, docxToPdfInWorker } from "@/app/lib/workers/pdf-worker-client";

export function useWordToPdf() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const pdf = await docxToPdfInWorker(await file.arrayBuffer(), { onProgress, signal });
          const filename = `${fileBaseName(file.name)}.pdf`;
          downloadBlob(pdf, filename);
          setOutputName(filename);
        },
        describePdfError(
          file,
          "Ocorreu um erro ao converter o documento. Tente novamente.",
          "O arquivo pode estar corrompido, protegido por senha ou não ser um .docx válido.",
        ),
      ),
    [run],
  );

  return { ...task, convert };
}
