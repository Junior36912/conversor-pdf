"use client";

import { useEffect, useState } from "react";
import { openPdfPages, type PdfPageRenderer } from "@/app/lib/pdf/render";

interface PagesState {
  file: File;
  renderer?: PdfPageRenderer;
  failed?: boolean;
}

/** Abre o PDF para renderizar miniaturas de qualquer página e o fecha ao trocar de arquivo. */
export function usePdfPages(file: File | null) {
  const [state, setState] = useState<PagesState | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    let opened: PdfPageRenderer | undefined;

    openPdfPages(file)
      .then((renderer) => {
        if (cancelled) {
          renderer.destroy();
          return;
        }
        opened = renderer;
        setState({ file, renderer });
      })
      .catch(() => {
        if (!cancelled) setState({ file, failed: true });
      });

    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [file]);

  const current = file && state?.file === file ? state : null;
  return {
    renderer: current?.renderer,
    pageCount: current?.renderer?.pageCount,
    failed: current?.failed ?? false,
  };
}
