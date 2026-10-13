"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Info, Loader2 } from "lucide-react";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePdfCompress } from "@/app/hooks/usePdfCompress";
import { usePdfPageCount } from "@/app/hooks/usePdfPageCount";
import type { CompressionLevel } from "@/app/lib/pdf/compress";
import { formatBytes } from "@/app/lib/utils";

const LEVELS = [
  { value: "light", label: "Leve" },
  { value: "recommended", label: "Recomendada" },
  { value: "strong", label: "Forte" },
] as const satisfies readonly { value: CompressionLevel; label: string }[];

const DESCRIPTIONS: Record<CompressionLevel, string> = {
  light:
    "Sem perda de qualidade. Comprime apenas dados que estavam sem compressão; a economia costuma ser pequena.",
  recommended:
    "Recodifica as imagens em JPEG (qualidade 75%, até 2000 px). Bom equilíbrio entre tamanho e qualidade.",
  strong:
    "Imagens mais comprimidas (qualidade 50%, até 1400 px). Maior redução, mas as imagens podem perder nitidez.",
};

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("recommended");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, result, compress, reset } = usePdfCompress();

  const isProcessing = status === "processing";

  const pickFile = ([selected]: File[]) => {
    setFile(selected);
    reset();
  };

  const clearFile = () => {
    setFile(null);
    reset();
  };

  const changeLevel = (value: CompressionLevel) => {
    if (status === "done" || status === "error") reset();
    setLevel(value);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (file) compress(file, level);
  };

  const saved = result?.reduced
    ? Math.round((1 - result.after / result.before) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comprimir PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Reduza o tamanho do arquivo. O texto e os gráficos vetoriais nunca são
          alterados; só as imagens podem perder qualidade.
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

      {file && pageCount !== undefined && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Nível de compressão</p>
              <SegmentedControl
                label="Nível de compressão"
                options={LEVELS}
                value={level}
                onChange={changeLevel}
                disabled={isProcessing}
              />
              <p className="text-sm text-muted-foreground">{DESCRIPTIONS[level]}</p>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-3">
              {isProcessing && (
                <Progress value={progress} aria-label="Progresso da compressão" />
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {status === "done" && result?.reduced && outputName && (
                <p role="status" className="flex items-center gap-2 text-sm text-primary">
                  <CircleCheck className="size-4 shrink-0" aria-hidden />
                  Pronto! De {formatBytes(result.before)} para{" "}
                  {formatBytes(result.after)} (−{saved}%). O download de {outputName}{" "}
                  foi iniciado.
                </p>
              )}
              {status === "done" && result && !result.reduced && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Info className="size-4 shrink-0" aria-hidden />
                  Não foi possível reduzir este PDF neste nível: ele já está
                  otimizado. Nenhum arquivo foi baixado.
                </p>
              )}
              <Button type="submit" size="lg" className="self-end" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Comprimindo...
                  </>
                ) : (
                  "Comprimir PDF"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
