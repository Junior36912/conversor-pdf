"use client";

import { useState } from "react";
import { CircleCheck, FileSpreadsheet, Loader2 } from "lucide-react";
import { FileDropzone } from "@/app/components/shared/FileDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedFileCard } from "@/app/components/shared/SelectedFileCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { useExcelToPdf } from "@/app/hooks/useExcelToPdf";
import type { XlsxToPdfOptions } from "@/app/lib/office/xlsx-render";

type Choice = "yes" | "no";

const PAGE_SIZES = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Carta" },
] as const satisfies readonly { value: XlsxToPdfOptions["pageSize"]; label: string }[];

const ORIENTATIONS = [
  { value: "auto", label: "Automática" },
  { value: "portrait", label: "Retrato" },
  { value: "landscape", label: "Paisagem" },
] as const satisfies readonly { value: XlsxToPdfOptions["orientation"]; label: string }[];

const YES_NO = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
] as const satisfies readonly { value: Choice; label: string }[];

const DECIMALS = [
  { value: "comma", label: "1.234,56 (Brasil)" },
  { value: "dot", label: "1,234.56 (EUA)" },
] as const satisfies readonly { value: XlsxToPdfOptions["decimal"]; label: string }[];

const isXlsx = (file: File): boolean => /\.(xlsx|xlsm)$/i.test(file.name);

export default function ExcelToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<XlsxToPdfOptions["pageSize"]>("a4");
  const [orientation, setOrientation] = useState<XlsxToPdfOptions["orientation"]>("auto");
  const [fitWidth, setFitWidth] = useState<Choice>("yes");
  const [gridlines, setGridlines] = useState<Choice>("no");
  const [decimal, setDecimal] = useState<XlsxToPdfOptions["decimal"]>("comma");
  const { status, progress, error, outputName, convert, reset } = useExcelToPdf();
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
        <h1 className="text-2xl font-bold tracking-tight">Excel para PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Converta cada planilha visível de um arquivo .xlsx em páginas de PDF,
          com cores, bordas, mesclagens e formatos de número.
        </p>
      </header>

      {!file && (
        <FileDropzone
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          isAccepted={isXlsx}
          multiple={false}
          onFiles={([selected]) => {
            setFile(selected);
            reset();
          }}
          idlePrompt="Arraste uma planilha .xlsx aqui ou clique para selecionar"
          dropPrompt="Solte a planilha aqui"
          rejectedMessage={() =>
            "Só arquivos .xlsx são aceitos. Para um .xls antigo, abra no Excel e use Salvar como .xlsx."
          }
        />
      )}

      {file && (
        <>
          <SelectedFileCard
            file={file}
            icon={FileSpreadsheet}
            disabled={isProcessing}
            onClear={() => {
              setFile(null);
              reset();
            }}
          />

          <Card>
            <CardContent className="space-y-5">
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
              <div className="space-y-2">
                <p className="text-sm font-medium">Ajustar à largura da página</p>
                <SegmentedControl
                  label="Ajustar à largura da página"
                  options={YES_NO}
                  value={fitWidth}
                  onChange={edit(setFitWidth)}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Mostrar linhas de grade</p>
                <SegmentedControl
                  label="Mostrar linhas de grade"
                  options={YES_NO}
                  value={gridlines}
                  onChange={edit(setGridlines)}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Formato dos números</p>
                <SegmentedControl
                  label="Formato dos números"
                  options={DECIMALS}
                  value={decimal}
                  onChange={edit(setDecimal)}
                  disabled={isProcessing}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                A conversão é aproximada: gráficos, imagens e formatação condicional
                não são desenhados, e a fonte é trocada por uma equivalente a Arial.
                Planilhas ocultas são ignoradas.
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
                    pageSize,
                    orientation,
                    fitWidth: fitWidth === "yes",
                    gridlines: gridlines === "yes",
                    decimal,
                  })
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Convertendo...
                  </>
                ) : (
                  "Converter em PDF"
                )}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
