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
import { usePdfToPowerPoint, type PowerPointMode } from "@/app/hooks/usePdfToPowerPoint";

type Choice = "yes" | "no";

const MODES = [
  { value: "text", label: "Editável (texto)" },
  { value: "image", label: "Fiel (imagens)" },
] as const satisfies readonly { value: PowerPointMode; label: string }[];

const YES_NO = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const satisfies readonly { value: Choice; label: string }[];

const DESCRIPTIONS: Record<PowerPointMode, string> = {
  text: "Cada página vira um slide com caixas de texto e tabelas nas posições originais, que você pode editar. Imagens, fundos e desenhos do PDF não são incluídos.",
  image:
    "Cada página vira um slide com a imagem da página, idêntica ao PDF. Não é possível editar o texto, mas nada se perde (imagens, fundos e desenhos ficam como estão).",
};

export default function PdfToPowerPointPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<PowerPointMode>("text");
  const [removeRepeated, setRemoveRepeated] = useState<Choice>("no");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, convert, reset } = usePdfToPowerPoint();
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
        <h1 className="text-2xl font-bold tracking-tight">PDF para PowerPoint</h1>
        <p className="mt-1 text-muted-foreground">
          Transforme as páginas de um PDF em slides de uma apresentação .pptx.
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
              <p className="text-sm font-medium">Modo</p>
              <SegmentedControl
                label="Modo da conversão"
                options={MODES}
                value={mode}
                onChange={edit(setMode)}
                disabled={isProcessing}
              />
              <p className="text-sm text-muted-foreground">{DESCRIPTIONS[mode]}</p>
            </div>

            {mode === "text" && (
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
            )}
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
              onClick={() => convert(file, { mode, removeRepeated: removeRepeated === "yes" })}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Convertendo...
                </>
              ) : (
                "Converter em PowerPoint"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
