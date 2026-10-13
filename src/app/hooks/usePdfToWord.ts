"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import { hasText } from "@/app/lib/pdf/analyze-layout";
import { extractRawPages } from "@/app/lib/pdf/extract";
import { fileBaseName } from "@/app/lib/utils";
import { pdfToDocxInWorker } from "@/app/lib/workers/pdf-worker-client";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Erro de conteúdo (não de leitura): o PDF não tem texto para converter. */
class NoTextError extends Error {}

export interface PdfToWordOptions {
  pageBreaks: boolean;
  removeRepeated: boolean;
}

export function usePdfToWord() {
  const { run, ...task } = usePdfTask();

  const convert = useCallback(
    (file: File, options: PdfToWordOptions) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const pages = await extractRawPages(file, {
            signal,
            onProgress: (done, total) => onProgress(Math.round((done / total) * 80)),
          });
          if (!hasText(pages)) throw new NoTextError();

          const docx = await pdfToDocxInWorker(pages, options, { signal });
          onProgress(100);

          const filename = `${fileBaseName(file.name)}.docx`;
          downloadBlob(docx, filename, DOCX_TYPE);
          setOutputName(filename);
        },
        (cause) =>
          cause instanceof NoTextError
            ? "Este PDF não tem texto selecionável (parece digitalizado). Para convertê-lo seria preciso OCR, que ainda não está disponível."
            : `Não foi possível converter "${file.name}". Ele pode estar corrompido ou protegido por senha.`,
      ),
    [run],
  );

  return { ...task, convert };
}
