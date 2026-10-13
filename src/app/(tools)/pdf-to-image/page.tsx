"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { PageSelector } from "@/app/components/shared/PageSelector";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePdfPageCount } from "@/app/hooks/usePdfPageCount";
import { usePdfToImage } from "@/app/hooks/usePdfToImage";
import { selectPages, type PagesMode } from "@/app/lib/pdf/ranges";
import type { ImageFormat } from "@/app/lib/pdf/render";

type Resolution = "72" | "150" | "300";

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
] as const satisfies readonly { value: ImageFormat; label: string }[];

const RESOLUTIONS = [
  { value: "72", label: "72 DPI (rápida)" },
  { value: "150", label: "150 DPI" },
  { value: "300", label: "300 DPI (alta)" },
] as const satisfies readonly { value: Resolution; label: string }[];

export default function PdfToImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [resolution, setResolution] = useState<Resolution>("150");
  const [pagesMode, setPagesMode] = useState<PagesMode>("all");
  const [pagesInput, setPagesInput] = useState("");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, convert, reset } = usePdfToImage();

  const isProcessing = status === "processing";

  const plan = useMemo(
    () =>
      pageCount === undefined ? null : selectPages(pagesMode, pagesInput, pageCount),
    [pagesMode, pagesInput, pageCount],
  );

  const pickFile = ([selected]: File[]) => {
    setFile(selected);
    setPagesMode("all");
    setPagesInput("");
    reset();
  };

  const clearFile = () => {
    setFile(null);
    reset();
  };

  // Editar as opções invalida o resultado/erro da execução anterior.
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      if (status === "done" || status === "error") reset();
      setter(value);
    };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (file && plan?.ok) {
      convert(file, { pages: plan.pages, dpi: Number(resolution), format });
    }
  };

  const formatLabel = format === "png" ? "PNG" : "JPG";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">PDF para Imagem</h1>
        <p className="mt-1 text-muted-foreground">
          Converta as páginas de um PDF em imagens PNG ou JPG.
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

      {file && pageCount !== undefined && plan && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Formato</p>
                <SegmentedControl
                  label="Formato da imagem"
                  options={FORMATS}
                  value={format}
                  onChange={edit(setFormat)}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Resolução</p>
                <SegmentedControl
                  label="Resolução da imagem"
                  options={RESOLUTIONS}
                  value={resolution}
                  onChange={edit(setResolution)}
                  disabled={isProcessing}
                />
              </div>

              <PageSelector
                idPrefix="image"
                pageCount={pageCount}
                mode={pagesMode}
                onModeChange={edit(setPagesMode)}
                input={pagesInput}
                onInputChange={edit(setPagesInput)}
                plan={plan}
                disabled={isProcessing}
              />

              {plan.ok && (
                <p className="text-sm text-muted-foreground">
                  {plan.pages.length === 1
                    ? `Será gerada 1 imagem ${formatLabel} (${resolution} DPI).`
                    : `Serão geradas ${plan.pages.length} imagens ${formatLabel} (${resolution} DPI), entregues em um ZIP.`}
                </p>
              )}
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
              <Button
                type="submit"
                size="lg"
                className="self-end"
                disabled={!plan.ok || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Convertendo...
                  </>
                ) : (
                  "Converter em imagens"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
