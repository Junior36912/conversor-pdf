"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { formatRange, type PageRange } from "@/app/lib/pdf/ranges";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  splitPdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function usePdfSplit() {
  const { run, ...task } = usePdfTask();

  const split = useCallback(
    (file: File, ranges: PageRange[]) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const baseName = fileBaseName(file.name);
          const buffer = await file.arrayBuffer();
          const { bytes, format } = await splitPdfInWorker(buffer, ranges, baseName, {
            onProgress,
            signal,
          });

          const filename =
            format === "zip"
              ? `${baseName}_dividido.zip`
              : `${baseName}_pag-${formatRange(ranges[0])}.pdf`;
          downloadBlob(bytes, filename, format === "zip" ? "application/zip" : "application/pdf");
          setOutputName(filename);
        },
        describePdfError(file, "Ocorreu um erro ao dividir o PDF. Tente novamente."),
      ),
    [run],
  );

  return { ...task, split };
}
