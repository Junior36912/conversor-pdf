"use client";

import { useCallback } from "react";
import { usePdfTask } from "@/app/hooks/usePdfTask";
import { downloadBlob } from "@/app/lib/download";
import type { PageEdit } from "@/app/lib/pdf/core";
import { fileBaseName } from "@/app/lib/utils";
import {
  describePdfError,
  organizePdfInWorker,
} from "@/app/lib/workers/pdf-worker-client";

export function usePdfOrganize() {
  const { run, ...task } = usePdfTask();

  const organize = useCallback(
    (file: File, pages: PageEdit[]) =>
      run(
        async ({ signal, onProgress, setOutputName }) => {
          const buffer = await file.arrayBuffer();
          const result = await organizePdfInWorker(buffer, pages, { onProgress, signal });

          const filename = `${fileBaseName(file.name)}_organizado.pdf`;
          downloadBlob(result, filename);
          setOutputName(filename);
        },
        describePdfError(file, "Ocorreu um erro ao organizar o PDF. Tente novamente."),
      ),
    [run],
  );

  return { ...task, organize };
}
