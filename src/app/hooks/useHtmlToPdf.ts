"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import type { PageSetup } from "@/app/lib/html/document";
import { CAPTURE_SCALE, captureHtmlPages } from "@/app/lib/html/raster";
import { imagesToPdfInWorker } from "@/app/lib/workers/pdf-worker-client";

export function useHtmlToPdf() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (frame: HTMLIFrameElement, setup: PageSetup, baseName: string) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const pages = await captureHtmlPages(frame, setup, {
            signal,
            onProgress: (done, total) => onProgress(Math.round((done / total) * 80)),
          });
          const pdf = await imagesToPdfInWorker(
            pages.map((buffer) => ({ name: "pagina", buffer })),
            // As capturas têm CAPTURE_SCALE vezes a resolução CSS: a página sai no tamanho certo.
            { pageSize: "fit", orientation: "auto", margin: "none", dpi: 96 * CAPTURE_SCALE },
            { signal },
          );
          onProgress(100);

          const filename = `${baseName}.pdf`;
          downloadBlob(pdf, filename);
          setOutputName(filename);
        },
        () => "Não foi possível converter este HTML. Verifique se o código está completo e tente novamente.",
      ),
    [run],
  );

  return { ...task, convert };
}
