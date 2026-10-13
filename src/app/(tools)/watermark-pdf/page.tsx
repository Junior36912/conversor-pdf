"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { PageSelector } from "@/app/components/shared/PageSelector";
import { PdfDropzone } from "@/app/components/shared/PdfDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedPdfCard } from "@/app/components/shared/SelectedPdfCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Progress } from "@/app/components/ui/progress";
import { usePdfPageCount } from "@/app/hooks/usePdfPageCount";
import { usePdfWatermark } from "@/app/hooks/usePdfWatermark";
import { selectPages, type PagesMode } from "@/app/lib/pdf/ranges";
import { isWinAnsiText } from "@/app/lib/pdf/text";
import { hexToRgb, type WatermarkLayout } from "@/app/lib/pdf/watermark";

type Rotation = "45" | "0" | "90";

const ROTATIONS = [
  { value: "45", label: "Diagonal" },
  { value: "0", label: "Horizontal" },
  { value: "90", label: "Vertical" },
] as const satisfies readonly { value: Rotation; label: string }[];

const LAYOUTS = [
  { value: "center", label: "Centralizada" },
  { value: "tile", label: "Repetida (mosaico)" },
] as const satisfies readonly { value: WatermarkLayout; label: string }[];

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 300;
const TEXT_ERROR_ID = "watermark-text-error";
const SIZE_ERROR_ID = "watermark-size-error";

function validateText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "Digite o texto da marca d'água.";
  if (!isWinAnsiText(trimmed)) {
    return "O texto tem caracteres não suportados. Use letras latinas (com acento), números e pontuação comum.";
  }
  return null;
}

function validateSize(size: string): string | null {
  const value = Number(size);
  return Number.isInteger(value) && value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE
    ? null
    : `Informe um tamanho inteiro entre ${MIN_FONT_SIZE} e ${MAX_FONT_SIZE}.`;
}

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENCIAL");
  const [fontSize, setFontSize] = useState("60");
  const [color, setColor] = useState("#808080");
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState<Rotation>("45");
  const [layout, setLayout] = useState<WatermarkLayout>("center");
  const [pagesMode, setPagesMode] = useState<PagesMode>("all");
  const [pagesInput, setPagesInput] = useState("");
  const { pageCount, failed } = usePdfPageCount(file);
  const { status, progress, error, outputName, addWatermark, reset } = usePdfWatermark();

  const isProcessing = status === "processing";

  const plan = useMemo(
    () =>
      pageCount === undefined ? null : selectPages(pagesMode, pagesInput, pageCount),
    [pagesMode, pagesInput, pageCount],
  );
  const textError = validateText(text);
  const sizeError = validateSize(fontSize);
  const canSubmit = !!plan?.ok && !textError && !sizeError && !isProcessing;

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
    if (!file || !plan?.ok || !canSubmit) return;

    addWatermark(file, {
      text: text.trim(),
      fontSize: Number(fontSize),
      color: hexToRgb(color),
      opacity: opacity / 100,
      rotation: Number(rotation),
      layout,
      pages: plan.pages,
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marca d&apos;água</h1>
        <p className="mt-1 text-muted-foreground">
          Aplique um texto sobre as páginas do PDF, como &quot;CONFIDENCIAL&quot; ou
          &quot;RASCUNHO&quot;.
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
              <div className="space-y-1.5">
                <label htmlFor="watermark-text" className="text-sm font-medium">
                  Texto
                </label>
                <Input
                  id="watermark-text"
                  value={text}
                  maxLength={80}
                  autoComplete="off"
                  disabled={isProcessing}
                  aria-invalid={textError ? true : undefined}
                  aria-describedby={textError ? TEXT_ERROR_ID : undefined}
                  onChange={(event) => edit(setText)(event.target.value)}
                />
                {textError && (
                  <p id={TEXT_ERROR_ID} role="alert" className="text-sm text-destructive">
                    {textError}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="watermark-size" className="text-sm font-medium">
                    Tamanho da fonte
                  </label>
                  <Input
                    id="watermark-size"
                    type="number"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    value={fontSize}
                    disabled={isProcessing}
                    aria-invalid={sizeError ? true : undefined}
                    aria-describedby={sizeError ? SIZE_ERROR_ID : undefined}
                    onChange={(event) => edit(setFontSize)(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="watermark-color" className="text-sm font-medium">
                    Cor
                  </label>
                  <input
                    id="watermark-color"
                    type="color"
                    value={color}
                    disabled={isProcessing}
                    onChange={(event) => edit(setColor)(event.target.value)}
                    className="block h-8 w-full cursor-pointer rounded-lg border bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="watermark-opacity" className="text-sm font-medium">
                    Opacidade: {opacity}%
                  </label>
                  <input
                    id="watermark-opacity"
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={opacity}
                    disabled={isProcessing}
                    onChange={(event) => edit(setOpacity)(Number(event.target.value))}
                    className="block h-8 w-full accent-primary disabled:opacity-50"
                  />
                </div>
              </div>
              {sizeError && (
                <p id={SIZE_ERROR_ID} role="alert" className="-mt-3 text-sm text-destructive">
                  {sizeError}
                </p>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Orientação</p>
                <SegmentedControl
                  label="Orientação do texto"
                  options={ROTATIONS}
                  value={rotation}
                  onChange={edit(setRotation)}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Posição</p>
                <SegmentedControl
                  label="Posição da marca d'água"
                  options={LAYOUTS}
                  value={layout}
                  onChange={edit(setLayout)}
                  disabled={isProcessing}
                />
              </div>

              <PageSelector
                idPrefix="watermark"
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
                  A marca d&apos;água será aplicada em {plan.pages.length}{" "}
                  {plan.pages.length === 1 ? "página" : "páginas"}.
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
              <Button type="submit" size="lg" className="self-end" disabled={!canSubmit}>
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Aplicando...
                  </>
                ) : (
                  "Aplicar marca d'água"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
