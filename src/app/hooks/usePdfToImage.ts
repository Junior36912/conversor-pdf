"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import {
  IMAGE_MIME_TYPES,
  renderPagesToImages,
  type ImageFormat,
} from "@/app/lib/pdf/render";
import { fileBaseName } from "@/app/lib/utils";
import { zipInWorker } from "@/app/lib/workers/pdf-worker-client";

const EXTENSIONS: Record<ImageFormat, string> = { png: "png", jpeg: "jpg" };

export interface ImageConversionOptions {
  /** Páginas a converter (1-based). */
  pages: number[];
  dpi: number;
  format: ImageFormat;
}

export function usePdfToImage() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File, { pages, dpi, format }: ImageConversionOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const baseName = fileBaseName(file.name);
          const extension = EXTENSIONS[format];

          const images = await renderPagesToImages(file, {
            pages,
            scale: dpi / 72,
            format,
            signal,
            onProgress: (completed, total) =>
              onProgress(Math.round((completed / total) * 100)),
          });

          const pad = String(Math.max(...pages)).length;
          const entries = images.map(({ page, buffer }) => ({
            name: `${baseName}_pagina-${String(page).padStart(pad, "0")}.${extension}`,
            buffer,
          }));

          if (entries.length === 1) {
            downloadBlob(entries[0].buffer, entries[0].name, IMAGE_MIME_TYPES[format]);
            setOutputName(entries[0].name);
            return;
          }

          const zip = await zipInWorker(entries, { signal });
          const zipName = `${baseName}_imagens.zip`;
          downloadBlob(zip, zipName, "application/zip");
          setOutputName(zipName);
        },
        () =>
          `Não foi possível converter "${file.name}" em imagens. Ele pode estar corrompido ou protegido por senha.`,
      ),
    [run],
  );

  return { ...task, convert };
}
