"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import {
  mergePdfsInWorker,
  PdfWorkerError,
} from "@/app/lib/workers/pdf-worker-client";

const OUTPUT_FILENAME = "merged.pdf";

export function usePdfMerge() {
  const { run, ...task } = usePdfTask();

  const merge = useCallback(
    (files: File[]) =>
      run(
        async ({ signal, onProgress }) => {
          const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));
          const merged = await mergePdfsInWorker(buffers, { onProgress, signal });
          downloadBlob(merged, OUTPUT_FILENAME);
        },
        (cause) => {
          const failedFile =
            cause instanceof PdfWorkerError && cause.failedIndex !== undefined
              ? files[cause.failedIndex]
              : undefined;
          return failedFile
            ? `Não foi possível ler "${failedFile.name}". Ele pode estar corrompido ou protegido por senha.`
            : "Ocorreu um erro ao juntar os PDFs. Tente novamente.";
        },
      ),
    [run],
  );

  return { ...task, merge };
}
