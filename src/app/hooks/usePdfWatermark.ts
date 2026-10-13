"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import type { WatermarkOptions } from "@/app/lib/pdf/watermark";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  watermarkPdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function usePdfWatermark() {
  const { run, ...task } = usePdfTask();

  const addWatermark = useCallback(
    (file: File, options: WatermarkOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const buffer = await file.arrayBuffer();
          const result = await watermarkPdfInWorker(buffer, options, { onProgress, signal });

          const filename = `${fileBaseName(file.name)}_marca-dagua.pdf`;
          downloadBlob(result, filename);
          setOutputName(filename);
        },
        describePdfError(file, "Ocorreu um erro ao aplicar a marca d'água. Tente novamente."),
      ),
    [run],
  );

  return { ...task, addWatermark };
}
