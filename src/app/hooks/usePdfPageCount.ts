"use client";

import { useEffect, useState } from "react";
import { getPdfPageCount } from "@/app/lib/pdf/render";

interface PageCountState {
  file: File;
  count?: number;
  failed?: boolean;
}

/** Lê o número de páginas do PDF selecionado, descartando resultados de arquivos antigos. */
export function usePdfPageCount(file: File | null) {
  const [state, setState] = useState<PageCountState | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    getPdfPageCount(file)
      .then((count) => {
        if (!cancelled) setState({ file, count });
      })
      .catch(() => {
        if (!cancelled) setState({ file, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const current = file && state?.file === file ? state : null;
  return { pageCount: current?.count, failed: current?.failed ?? false };
}
