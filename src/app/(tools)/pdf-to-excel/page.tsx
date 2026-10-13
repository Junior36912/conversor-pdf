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
import { usePdfToExcel } from "@/app/hooks/usePdfToExcel";
import type { DecimalSeparator } from "@/app/lib/office/numbers";

type Choice = "yes" | "no";

const YES_NO = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const satisfies readonly { value: Choice; label: string }[];

const DECIMALS = [
  { value: "comma", label: "1.234,56 (Brasil)" },
  { value: "dot", label: "1,234.56 (EUA)" },
] as const satisfies readonly { value: DecimalSeparator; label: string }[];

export default function PdfToExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [perPage, setPerPage] = useState<Choice>("yes");
  const [includeText, setIncludeText] = useState<Choice>("yes");
  const [convertNumbers, setConvertNumbers] = useState<Choice>("yes");
  const [decimal, setDecimal] = useState<DecimalSeparator>("comma");
  const [removeRepeated, setRemoveRepeated] = useState<Choice>("yes");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, convert, reset } = usePdfToExcel();
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
        <h1 className="text-2xl font-bold tracking-tight">PDF para Excel</h1>
        <p className="mt-1 text-muted-foreground">
          Detecta as tabelas de um PDF pelo alinhamento do texto e as coloca em
          uma planilha .xlsx.
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
              <p className="text-sm font-medium">Uma planilha por página</p>
              <SegmentedControl
                label="Uma planilha por página"
                options={YES_NO}
                value={perPage}
                onChange={edit(setPerPage)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Incluir texto fora das tabelas</p>
              <SegmentedControl
                label="Incluir texto fora das tabelas"
                options={YES_NO}
                value={includeText}
                onChange={edit(setIncludeText)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Converter números</p>
              <SegmentedControl
                label="Converter números"
                options={YES_NO}
                value={convertNumbers}
                onChange={edit(setConvertNumbers)}
                disabled={isProcessing}
              />
              {convertNumbers === "yes" && (
                <SegmentedControl
                  label="Formato dos números"
                  options={DECIMALS}
                  value={decimal}
                  onChange={edit(setDecimal)}
                  disabled={isProcessing}
                />
              )}
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
              A detecção de tabelas é aproximada: células com várias linhas viram
              várias linhas na planilha, e PDFs digitalizados (sem texto) não
              podem ser convertidos.
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
                  perPage: perPage === "yes",
                  includeText: includeText === "yes",
                  convertNumbers: convertNumbers === "yes",
                  decimal,
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
                "Converter em Excel"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
