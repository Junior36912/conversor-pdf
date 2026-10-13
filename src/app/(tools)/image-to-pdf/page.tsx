"use client";

import { useState, type FormEvent } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CircleCheck, Loader2 } from "lucide-react";
import { FileDropzone } from "@/app/components/shared/FileDropzone";
import { FileThumbnail } from "@/app/components/shared/FileThumbnail";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SortableFileList } from "@/app/components/shared/SortableFileList";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { useImagesToPdf } from "@/app/hooks/useImagesToPdf";
import type {
  MarginOption,
  OrientationOption,
  PageSizeOption,
} from "@/app/lib/pdf/images";
import { renderImageThumbnail } from "@/app/lib/pdf/render";

interface ImageItem {
  id: string;
  file: File;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const isImage = (file: File): boolean =>
  file.type
    ? /^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(file.type)
    : IMAGE_EXTENSIONS.test(file.name);

const PAGE_SIZES = [
  { value: "fit", label: "Do tamanho da imagem" },
  { value: "a4", label: "A4" },
  { value: "letter", label: "Carta" },
] as const satisfies readonly { value: PageSizeOption; label: string }[];

const ORIENTATIONS = [
  { value: "auto", label: "Automática" },
  { value: "portrait", label: "Retrato" },
  { value: "landscape", label: "Paisagem" },
] as const satisfies readonly { value: OrientationOption; label: string }[];

const MARGINS = [
  { value: "none", label: "Sem margem" },
  { value: "small", label: "Pequena" },
  { value: "large", label: "Grande" },
] as const satisfies readonly { value: MarginOption; label: string }[];

let nextId = 0;
const createItem = (file: File): ImageItem => ({ id: `image-${++nextId}`, file });

export default function ImageToPdfPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>("a4");
  const [orientation, setOrientation] = useState<OrientationOption>("auto");
  const [margin, setMargin] = useState<MarginOption>("small");
  const { status, progress, error, outputName, convert, reset } = useImagesToPdf();

  const isProcessing = status === "processing";

  // Editar a lista ou as opções invalida o resultado/erro da execução anterior.
  const touch = () => {
    if (status === "done" || status === "error") reset();
  };
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      touch();
      setter(value);
    };

  const addImages = (files: File[]) => {
    touch();
    setImages((current) => [...current, ...files.map(createItem)]);
  };
  const removeImage = (id: string) => {
    touch();
    setImages((current) => current.filter((item) => item.id !== id));
  };
  const reorder = (activeId: string, overId: string) => {
    touch();
    setImages((current) => {
      const from = current.findIndex((item) => item.id === activeId);
      const to = current.findIndex((item) => item.id === overId);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (images.length > 0) {
      convert(
        images.map((item) => item.file),
        { pageSize, orientation, margin },
      );
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Imagem para PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Transforme imagens JPG, PNG, WebP, GIF, BMP ou AVIF em um PDF, uma por
          página. Arraste pela alça para mudar a ordem.
        </p>
      </header>

      <FileDropzone
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif"
        isAccepted={isImage}
        onFiles={addImages}
        idlePrompt="Arraste suas imagens aqui ou clique para selecionar"
        dropPrompt="Solte as imagens aqui"
        rejectedMessage={(count) =>
          count === 1
            ? "1 arquivo foi ignorado por não ser uma imagem compatível."
            : `${count} arquivos foram ignorados por não serem imagens compatíveis.`
        }
      />

      {images.length > 0 && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-5">
              <SortableFileList
                items={images}
                renderThumbnail={(item) => (
                  <FileThumbnail
                    file={item.file}
                    render={renderImageThumbnail}
                    alt={`Prévia de ${item.file.name}`}
                  />
                )}
                disabled={isProcessing}
                onReorder={reorder}
                onRemove={removeImage}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">Tamanho da página</p>
                <SegmentedControl
                  label="Tamanho da página"
                  options={PAGE_SIZES}
                  value={pageSize}
                  onChange={edit(setPageSize)}
                  disabled={isProcessing}
                />
              </div>

              {pageSize !== "fit" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Orientação</p>
                  <SegmentedControl
                    label="Orientação da página"
                    options={ORIENTATIONS}
                    value={orientation}
                    onChange={edit(setOrientation)}
                    disabled={isProcessing}
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Margem</p>
                <SegmentedControl
                  label="Margem da página"
                  options={MARGINS}
                  value={margin}
                  onChange={edit(setMargin)}
                  disabled={isProcessing}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Será gerado um PDF com {images.length}{" "}
                {images.length === 1 ? "página" : "páginas"}.
              </p>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-3">
              {isProcessing && (
                <Progress value={progress} aria-label="Progresso da conversão" />
              )}
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
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => {
                    setImages([]);
                    reset();
                  }}
                >
                  Limpar tudo
                </Button>
                <Button type="submit" size="lg" disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Convertendo...
                    </>
                  ) : (
                    "Converter em PDF"
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
