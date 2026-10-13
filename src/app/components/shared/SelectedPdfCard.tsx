"use client";

import { PdfThumbnail } from "@/app/components/shared/PdfThumbnail";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { formatBytes } from "@/app/lib/utils";

interface SelectedPdfCardProps {
  file: File;
  /** `undefined` enquanto as páginas ainda estão sendo lidas. */
  pageCount?: number;
  /** O PDF não pôde ser aberto (corrompido ou protegido por senha). */
  failed?: boolean;
  disabled?: boolean;
  onClear: () => void;
}

/** Resumo do PDF escolhido nas ferramentas de arquivo único. */
export function SelectedPdfCard({
  file,
  pageCount,
  failed,
  disabled,
  onClear,
}: SelectedPdfCardProps) {
  return (
    <div className="space-y-2">
      <Card>
        <CardContent className="flex items-center gap-4">
          <PdfThumbnail file={file} className="w-16" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
              {" · "}
              {failed
                ? "não foi possível ler"
                : pageCount === undefined
                  ? "lendo páginas..."
                  : `${pageCount} ${pageCount === 1 ? "página" : "páginas"}`}
            </p>
          </div>
          <Button variant="outline" disabled={disabled} onClick={onClear}>
            Trocar arquivo
          </Button>
        </CardContent>
      </Card>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível ler &quot;{file.name}&quot;. Ele pode estar corrompido ou
          protegido por senha.
        </p>
      )}
    </div>
  );
}
