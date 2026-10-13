"use client";

import { useCallback, useState } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import type { CompressionLevel } from "@/app/lib/pdf/compress";
import { fileBaseName } from "@/app/lib/utils";
import {
  compressPdfInWorker,
  describePdfError,
} from "@/app/lib/workers/pdf-worker-client";

/** Abaixo disso a economia é desprezível e entregamos o original em vez do "comprimido". */
const MIN_SAVING = 0.01;

export interface CompressionResult {
  before: number;
  after: number;
  /** `false` quando o PDF já estava otimizado e nenhum arquivo foi baixado. */
  reduced: boolean;
}

export function usePdfCompress() {
  const { run, reset: resetTask, ...task } = usePdfTask();
  const [result, setResult] = useState<CompressionResult | null>(null);

  const compress = useCallback(
    (file: File, level: CompressionLevel) => {
      setResult(null);
      return run(
        async ({ signal, onProgress, setOutputName }) => {
          const buffer = await file.arrayBuffer();
          const compressed = await compressPdfInWorker(buffer, level, { onProgress, signal });

          const reduced = compressed.length < file.size * (1 - MIN_SAVING);
          if (reduced) {
            const filename = `${fileBaseName(file.name)}_comprimido.pdf`;
            downloadBlob(compressed, filename);
            setOutputName(filename);
          }
          setResult({
            before: file.size,
            after: reduced ? compressed.length : file.size,
            reduced,
          });
        },
        describePdfError(file, "Ocorreu um erro ao comprimir o PDF. Tente novamente."),
      );
    },
    [run],
  );

  const reset = useCallback(() => {
    setResult(null);
    resetTask();
  }, [resetTask]);

  return { ...task, result, compress, reset };
}
