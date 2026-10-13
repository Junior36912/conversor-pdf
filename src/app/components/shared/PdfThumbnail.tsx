"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { renderFirstPage } from "@/app/lib/pdf/render";
import { cn } from "@/app/lib/utils";

interface PdfThumbnailProps {
  file: File;
  /** Data URL já conhecida (por exemplo, guardada no store); evita renderizar de novo. */
  preview?: string;
  /** Chamado quando a miniatura termina de ser gerada. */
  onPreviewReady?: (dataUrl: string) => void;
  className?: string;
}

/** Miniatura da primeira página do PDF, gerada sob demanda com o pdf.js. */
export function PdfThumbnail({
  file,
  preview,
  onPreviewReady,
  className,
}: PdfThumbnailProps) {
  const [rendered, setRendered] = useState<{ file: File; dataUrl: string }>();
  const [failedFile, setFailedFile] = useState<File>();

  useEffect(() => {
    if (preview) return;

    let cancelled = false;
    renderFirstPage(file)
      .then((dataUrl) => {
        if (cancelled) return;
        setRendered({ file, dataUrl });
        onPreviewReady?.(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setFailedFile(file);
      });

    return () => {
      cancelled = true;
    };
  }, [file, preview, onPreviewReady]);

  const src = preview ?? (rendered?.file === file ? rendered.dataUrl : undefined);
  const failed = failedFile === file;

  return (
    <div
      className={cn(
        "flex aspect-[3/4] w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted",
        !src && !failed && "animate-pulse",
        className,
      )}
    >
      {src ? (
        // Data URL local: next/image não traria nenhuma otimização aqui.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Primeira página de ${file.name}`}
          className="size-full object-cover"
        />
      ) : (
        <FileText className="size-5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
