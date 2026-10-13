"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { renderFirstPage } from "@/app/lib/pdf/render";
import { cn } from "@/app/lib/utils";

interface FileThumbnailProps {
  file: File;
  /** Como gerar a miniatura (data URL). Por padrão, a primeira página de um PDF. */
  render?: (file: File) => Promise<string>;
  /** Texto alternativo da miniatura. */
  alt?: string;
  /** Data URL já conhecida (por exemplo, guardada no store); evita renderizar de novo. */
  preview?: string;
  /** Chamado quando a miniatura termina de ser gerada. */
  onPreviewReady?: (dataUrl: string) => void;
  className?: string;
}

/** Miniatura de um arquivo (padrão: 1ª página de um PDF, via pdf.js), gerada sob demanda. */
export function FileThumbnail({
  file,
  render = renderFirstPage,
  alt,
  preview,
  onPreviewReady,
  className,
}: FileThumbnailProps) {
  const [rendered, setRendered] = useState<{ file: File; dataUrl: string }>();
  const [failedFile, setFailedFile] = useState<File>();

  useEffect(() => {
    if (preview) return;

    let cancelled = false;
    render(file)
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
  }, [file, render, preview, onPreviewReady]);

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
          alt={alt ?? `Prévia de ${file.name}`}
          className="size-full object-cover"
        />
      ) : (
        <FileText className="size-5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
