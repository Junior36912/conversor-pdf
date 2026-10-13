"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import type { ImagesToPdfOptions } from "@/app/lib/pdf/images";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  imagesToPdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function useImagesToPdf() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (files: File[], options: ImagesToPdfOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const images = await Promise.all(
            files.map(async (file) => ({ name: file.name, buffer: await file.arrayBuffer() })),
          );
          const pdf = await imagesToPdfInWorker(images, options, { onProgress, signal });

          const filename = files.length === 1 ? `${fileBaseName(files[0].name)}.pdf` : "imagens.pdf";
          downloadBlob(pdf, filename);
          setOutputName(filename);
        },
        describePdfError(
          files,
          "Ocorreu um erro ao criar o PDF. Tente novamente.",
          "O arquivo pode estar corrompido ou ser de um formato que o navegador não abre.",
        ),
      ),
    [run],
  );

  return { ...task, convert };
}
