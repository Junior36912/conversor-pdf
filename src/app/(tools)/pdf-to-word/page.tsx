"use client";

import { useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePdfPageCount } from "@/app/hooks/usePdfPageCount";
import { usePdfToWord } from "@/app/hooks/usePdfToWord";

type Choice = "yes" | "no";

const YES_NO = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const satisfies readonly { value: Choice; label: string }[];

export default function PdfToWordPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageBreaks, setPageBreaks] = useState<Choice>("no");
  const [removeRepeated, setRemoveRepeated] = useState<Choice>("yes");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, convert, reset } = usePdfToWord();
  const isProcessing = status === "processing";

  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      if (status === "done" || status === "error") reset();
      setter(value);
    };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">PDF para Word</h1>
        <p className="mt-1 text-muted-foreground">
          Extraia o texto, os títulos, as listas e as tabelas de um PDF para um
          documento .docx editável.
        </p>
      </header>

      {!file && (
        <PdfDropzone
          multiple={false}
          onFiles={([selected]) => {
            setFile(selected);
            reset();
          }}
        />
      )}

      {file && (
        <SelectedPdfCard
          file={file}
          pageCount={pageCount}
          failed={failed}
          disabled={isProcessing}
          onClear={() => {
            setFile(null);
            reset();
          }}
        />
      )}

      {file && pageCount !== undefined && (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Manter a quebra de página do PDF</p>
              <SegmentedControl
                label="Manter a quebra de página do PDF"
                options={YES_NO}
                value={pageBreaks}
                onChange={edit(setPageBreaks)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Remover cabeçalhos e rodapés repetidos</p>
              <SegmentedControl
                label="Remover cabeçalhos e rodapés repetidos"
                options={YES_NO}
                value={removeRepeated}
                onChange={edit(setRemoveRepeated)}
                disabled={isProcessing}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              A conversão reconstrói o texto a partir da posição das letras, então o
              resultado é uma aproximação: imagens e gráficos não são incluídos, e
              layouts em várias colunas podem sair misturados. PDFs digitalizados
              (sem texto) não podem ser convertidos.
            </p>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {isProcessing && <Progress value={progress} aria-label="Progresso da conversão" />}
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
              disabled={isProcessing}
              onClick={() =>
                convert(file, {
                  pageBreaks: pageBreaks === "yes",
                  removeRepeated: removeRepeated === "yes",
                })
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Convertendo...
                </>
              ) : (
                "Converter em Word"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
