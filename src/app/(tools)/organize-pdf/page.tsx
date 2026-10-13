"use client";

import { useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CircleCheck, Loader2, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import {
  SortablePageGrid,
  type PageItem,
} from "@/app/components/shared/SortablePageGrid";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePdfOrganize } from "@/app/hooks/usePdfOrganize";
import { usePdfPages } from "@/app/hooks/usePdfPages";

const originalPages = (pageCount: number): PageItem[] =>
  Array.from({ length: pageCount }, (_, i) => ({
    id: `page-${i + 1}`,
    page: i + 1,
    rotation: 0,
  }));

const turn = (rotation: number, delta: number) => (((rotation + delta) % 360) + 360) % 360;

export default function OrganizePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  // Edições do usuário; ficam atreladas ao arquivo para não vazarem entre PDFs.
  const [edited, setEdited] = useState<{ file: File; items: PageItem[] } | null>(null);
  const { renderer, pageCount, failed } = usePdfPages(file);
  const { status, progress, error, outputName, organize, reset } = usePdfOrganize();

  const isProcessing = status === "processing";

  const items = useMemo(
    () =>
      edited && edited.file === file
        ? edited.items
        : pageCount !== undefined
          ? originalPages(pageCount)
          : [],
    [edited, file, pageCount],
  );

  // Qualquer edição invalida o resultado/erro da execução anterior.
  const update = (change: (current: PageItem[]) => PageItem[]) => {
    if (!file) return;
    if (status === "done" || status === "error") reset();
    setEdited({ file, items: change(items) });
  };

  const pickFile = ([selected]: File[]) => {
    setFile(selected);
    setEdited(null);
    reset();
  };

  const clearFile = () => {
    setFile(null);
    setEdited(null);
    reset();
  };

  const rotate = (id: string, delta: number) =>
    update((current) =>
      current.map((item) =>
        item.id === id ? { ...item, rotation: turn(item.rotation, delta) } : item,
      ),
    );

  const rotateAll = (delta: number) =>
    update((current) =>
      current.map((item) => ({ ...item, rotation: turn(item.rotation, delta) })),
    );

  const remove = (id: string) => update((current) => current.filter((item) => item.id !== id));

  const reorder = (activeId: string, overId: string) =>
    update((current) => {
      const from = current.findIndex((item) => item.id === activeId);
      const to = current.findIndex((item) => item.id === overId);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });

  const restore = () => {
    if (status === "done" || status === "error") reset();
    setEdited(null);
  };

  const save = () => {
    if (file && items.length > 0) {
      organize(
        file,
        items.map(({ page, rotation }) => ({ page, rotation })),
      );
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Organizar PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Arraste as páginas para reordenar, gire ou exclua as que não quiser e
          salve o resultado.
        </p>
      </header>

      {!file && <PdfDropzone multiple={false} onFiles={pickFile} />}

      {file && (
        <SelectedPdfCard
          file={file}
          pageCount={pageCount}
          failed={failed}
          disabled={isProcessing}
          onClear={clearFile}
        />
      )}

      {file && renderer && pageCount !== undefined && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-muted-foreground">
                {items.length} de {pageCount} {pageCount === 1 ? "página" : "páginas"}
              </p>
              <Button
                variant="outline"
                disabled={isProcessing || items.length === 0}
                onClick={() => rotateAll(-90)}
              >
                <RotateCcw aria-hidden />
                Girar todas à esquerda
              </Button>
              <Button
                variant="outline"
                disabled={isProcessing || items.length === 0}
                onClick={() => rotateAll(90)}
              >
                <RotateCw aria-hidden />
                Girar todas à direita
              </Button>
              <Button variant="outline" disabled={isProcessing} onClick={restore}>
                <Undo2 aria-hidden />
                Restaurar original
              </Button>
            </div>

            {items.length > 0 ? (
              <SortablePageGrid
                items={items}
                renderer={renderer}
                disabled={isProcessing}
                onReorder={reorder}
                onRotate={rotate}
                onRemove={remove}
              />
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Todas as páginas foram excluídas. Use &quot;Restaurar original&quot; para
                começar de novo.
              </p>
            )}
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {isProcessing && <Progress value={progress} aria-label="Progresso" />}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {status === "done" && outputName && (
              <p role="status" className="flex items-center gap-2 text-sm text-primary">
                <CircleCheck className="size-4" aria-hidden />
                Pronto! O download de {outputName} foi iniciado.
              </p>
            )}
            <Button
              size="lg"
              className="self-end"
              disabled={items.length === 0 || isProcessing}
              onClick={save}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Salvando...
                </>
              ) : (
                "Salvar PDF"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
