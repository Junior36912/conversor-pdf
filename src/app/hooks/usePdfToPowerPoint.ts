"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { hasText } from "@/app/lib/pdf/analyze-layout";
import { extractRawPages } from "@/app/lib/pdf/extract";
import { getPdfPageSizes, renderPagesToImages } from "@/app/lib/pdf/render";
import { fileBaseName } from "@/app/lib/utils";
import {
  pdfToPptxImagesInWorker,
  pdfToPptxTextInWorker,
} from "@/app/lib/workers/pdf-worker-client";

const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
// 2x (144 DPI): nítido na tela cheia sem deixar o arquivo gigante.
const IMAGE_SCALE = 2;

class NoTextError extends Error {}

export type PowerPointMode = "text" | "image";

export interface PdfToPowerPointOptions {
  mode: PowerPointMode;
  removeRepeated: boolean;
}

export function usePdfToPowerPoint() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File, { mode, removeRepeated }: PdfToPowerPointOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          let pptx: Uint8Array<ArrayBuffer>;

          if (mode === "text") {
            const pages = await extractRawPages(file, {
              signal,
              onProgress: (done, total) => onProgress(Math.round((done / total) * 80)),
            });
            if (!hasText(pages)) throw new NoTextError();
            pptx = await pdfToPptxTextInWorker(pages, removeRepeated, { signal });
          } else {
            const sizes = await getPdfPageSizes(file);
            const images = await renderPagesToImages(file, {
              pages: sizes.map((_, index) => index + 1),
              scale: IMAGE_SCALE,
              format: "jpeg",
              quality: 0.88,
              signal,
              onProgress: (done, total) => onProgress(Math.round((done / total) * 85)),
            });
            pptx = await pdfToPptxImagesInWorker(
              images.map(({ buffer }, index) => ({ ...sizes[index], jpeg: buffer })),
              { signal },
            );
          }
          onProgress(100);

          const filename = `${fileBaseName(file.name)}.pptx`;
          downloadBlob(pptx, filename, PPTX_TYPE);
          setOutputName(filename);
        },
        (cause) =>
          cause instanceof NoTextError
            ? "Este PDF não tem texto selecionável (parece digitalizado). Use o modo \"Fiel (imagens)\", que converte cada página em uma imagem."
            : `Não foi possível converter "${file.name}". Ele pode estar corrompido ou protegido por senha.`,
      ),
    [run],
  );

  return { ...task, convert };
}
