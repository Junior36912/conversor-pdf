"use client";

import { useCallback } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { FileThumbnail } from "@/app/components/shared/FileThumbnail";
import { SortableFileList } from "@/app/components/shared/SortableFileList";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePdfMerge } from "@/app/hooks/usePdfMerge";
import { useFileStore, type PdfFileItem } from "@/app/store/useFileStore";

const MIN_FILES = 2;

/** Miniatura que guarda o preview no store (evita renderizar de novo ao reordenar). */
function MergeThumbnail({ item }: { item: PdfFileItem }) {
  const setPreview = useFileStore((state) => state.setPreview);
  const { id, file, preview } = item;
  const handleReady = useCallback(
    (dataUrl: string) => setPreview(id, dataUrl),
    [id, setPreview],
  );
  return (
    <FileThumbnail
      file={file}
      alt={`Primeira página de ${file.name}`}
      preview={preview}
      onPreviewReady={handleReady}
    />
  );
}

export default function MergePdfPage() {
  const files = useFileStore((state) => state.files);
  const removeFile = useFileStore((state) => state.removeFile);
  const clearFiles = useFileStore((state) => state.clearFiles);
  const reorderFiles = useFileStore((state) => state.reorderFiles);
  const { status, progress, error, merge, reset } = usePdfMerge();

  const isProcessing = status === "processing";
  const canMerge = files.length >= MIN_FILES && !isProcessing;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Juntar PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Adicione dois ou mais PDFs e combine-os em um único arquivo. Arraste
          pela alça para mudar a ordem.
        </p>
      </header>

      <PdfDropzone />

      {files.length > 0 && (
        <Card>
          <CardContent>
            <SortableFileList
              items={files}
              renderThumbnail={(item) => <MergeThumbnail item={item} />}
              disabled={isProcessing}
              onReorder={reorderFiles}
              onRemove={removeFile}
            />
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {isProcessing && (
              <Progress value={progress} aria-label="Progresso da junção" />
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {status === "done" && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-primary"
              >
                <CircleCheck className="size-4" aria-hidden />
                Pronto! O download de merged.pdf foi iniciado.
              </p>
            )}
            {files.length < MIN_FILES && (
              <p className="text-sm text-muted-foreground">
                Adicione pelo menos {MIN_FILES} PDFs para juntá-los.
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                disabled={isProcessing}
                onClick={() => {
                  clearFiles();
                  reset();
                }}
              >
                Limpar tudo
              </Button>
              <Button
                size="lg"
                disabled={!canMerge}
                onClick={() => merge(files.map((item) => item.file))}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Processando...
                  </>
                ) : (
                  "Juntar PDFs"
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
