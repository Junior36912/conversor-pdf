"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Progress } from "@/app/components/ui/progress";
import { usePdfPageCount } from "@/app/hooks/usePdfPageCount";
import { usePdfSplit } from "@/app/hooks/usePdfSplit";
import {
  chunkRanges,
  formatRange,
  parsePageRanges,
  type ParseRangesResult,
} from "@/app/lib/pdf/ranges";

type Mode = "ranges" | "every";

const MODES = [
  { value: "ranges", label: "Por intervalos" },
  { value: "every", label: "A cada N páginas" },
] as const satisfies readonly { value: Mode; label: string }[];

const MAX_LISTED_RANGES = 12;
const PLAN_ERROR_ID = "split-plan-error";

function buildPlan(
  mode: Mode,
  rangesInput: string,
  everyInput: string,
  pageCount: number,
): ParseRangesResult {
  if (mode === "ranges") return parsePageRanges(rangesInput, pageCount);

  const size = Number(everyInput);
  if (!Number.isInteger(size) || size < 1) {
    return { ok: false, error: "Informe um número inteiro maior que zero." };
  }
  if (size >= pageCount) {
    return {
      ok: false,
      error: `Informe um valor menor que o total de páginas (${pageCount}).`,
    };
  }
  return { ok: true, ranges: chunkRanges(pageCount, size) };
}

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("ranges");
  const [rangesInput, setRangesInput] = useState("");
  const [everyInput, setEveryInput] = useState("1");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, split, reset } = usePdfSplit();

  const isProcessing = status === "processing";

  const plan = useMemo(
    () =>
      pageCount === undefined
        ? null
        : buildPlan(mode, rangesInput, everyInput, pageCount),
    [mode, rangesInput, everyInput, pageCount],
  );

  const pickFile = ([selected]: File[]) => {
    setFile(selected);
    setMode("ranges");
    setRangesInput("");
    setEveryInput("1");
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
    if (file && plan?.ok) split(file, plan.ranges);
  };

  const showPlanError =
    plan && !plan.ok && (mode === "every" || rangesInput.trim() !== "");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dividir PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Separe um PDF em vários arquivos, por intervalos de páginas ou a cada
          N páginas.
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
            <CardContent className="space-y-4">
              <SegmentedControl
                label="Modo de divisão"
                options={MODES}
                value={mode}
                onChange={edit(setMode)}
                disabled={isProcessing}
              />

              {mode === "ranges" ? (
                <div className="space-y-1.5">
                  <label htmlFor="split-ranges" className="text-sm font-medium">
                    Intervalos de páginas
                  </label>
                  <Input
                    id="split-ranges"
                    value={rangesInput}
                    placeholder="1-3, 5, 8-"
                    autoComplete="off"
                    disabled={isProcessing}
                    aria-invalid={showPlanError || undefined}
                    aria-describedby={showPlanError ? PLAN_ERROR_ID : undefined}
                    onChange={(event) => edit(setRangesInput)(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cada intervalo vira um arquivo. &quot;8-&quot; vai até a última
                    página ({pageCount}).
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="split-every" className="text-sm font-medium">
                    Páginas por arquivo
                  </label>
                  <Input
                    id="split-every"
                    type="number"
                    min={1}
                    max={Math.max(pageCount - 1, 1)}
                    value={everyInput}
                    disabled={isProcessing}
                    aria-invalid={showPlanError || undefined}
                    aria-describedby={showPlanError ? PLAN_ERROR_ID : undefined}
                    onChange={(event) => edit(setEveryInput)(event.target.value)}
                  />
                </div>
              )}

              {showPlanError && !plan.ok && (
                <p id={PLAN_ERROR_ID} role="alert" className="text-sm text-destructive">
                  {plan.error}
                </p>
              )}

              {plan.ok && (
                <p className="text-sm text-muted-foreground">
                  {plan.ranges.length === 1
                    ? "Será gerado 1 arquivo PDF: "
                    : `Serão gerados ${plan.ranges.length} arquivos PDF, entregues em um ZIP: `}
                  <span className="font-medium text-foreground">
                    {plan.ranges.slice(0, MAX_LISTED_RANGES).map(formatRange).join(", ")}
                    {plan.ranges.length > MAX_LISTED_RANGES && ", ..."}
                  </span>
                </p>
              )}
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-3">
              {isProcessing && (
                <Progress value={progress} aria-label="Progresso da divisão" />
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
                    Processando...
                  </>
                ) : (
                  "Dividir PDF"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
