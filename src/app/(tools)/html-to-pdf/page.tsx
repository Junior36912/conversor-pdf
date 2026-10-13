"use client";

import { useMemo, useRef, useState } from "react";
import { CircleCheck, FileCode, Loader2, Printer, ShieldAlert } from "lucide-react";
import { FileDropzone } from "@/app/components/shared/FileDropzone";
import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { SelectedFileCard } from "@/app/components/shared/SelectedFileCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { useHtmlToPdf } from "@/app/hooks/useHtmlToPdf";
import { pageMetrics, prepareDocument, type PageSetup } from "@/app/lib/html/document";
import { fileBaseName } from "@/app/lib/utils";

type InputMode = "paste" | "file";

const INPUT_MODES = [
  { value: "paste", label: "Colar código HTML" },
  { value: "file", label: "Enviar arquivo .html" },
] as const satisfies readonly { value: InputMode; label: string }[];

const SIZES = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Carta" },
] as const satisfies readonly { value: PageSetup["size"]; label: string }[];

const ORIENTATIONS = [
  { value: "portrait", label: "Retrato" },
  { value: "landscape", label: "Paisagem" },
] as const satisfies readonly { value: PageSetup["orientation"]; label: string }[];

const MARGINS = [
  { value: "none", label: "Sem margem" },
  { value: "small", label: "Pequena" },
  { value: "normal", label: "Normal" },
] as const satisfies readonly { value: PageSetup["margin"]; label: string }[];

const isHtml = (file: File): boolean => /\.(html?|xhtml)$/i.test(file.name) || file.type === "text/html";

export default function HtmlToPdfPage() {
  const [mode, setMode] = useState<InputMode>("paste");
  const [html, setHtml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<PageSetup["size"]>("a4");
  const [orientation, setOrientation] = useState<PageSetup["orientation"]>("portrait");
  const [margin, setMargin] = useState<PageSetup["margin"]>("normal");
  const [frameHeight, setFrameHeight] = useState(480);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { status, progress, error, outputName, convert, reset } = useHtmlToPdf();
  const isProcessing = status === "processing";

  const setup = useMemo<PageSetup>(() => ({ size, orientation, margin }), [size, orientation, margin]);
  const metrics = pageMetrics(setup);
  const prepared = useMemo(() => (html.trim() ? prepareDocument(html, setup) : null), [html, setup]);

  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      if (status === "done" || status === "error") reset();
      setter(value);
    };

  const measureFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setFrameHeight(Math.max(120, Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)));
  };

  const baseName = file ? fileBaseName(file.name) : "pagina";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">HTML para PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Converta um código ou arquivo HTML em PDF. Por segurança, scripts não
          são executados e nada é carregado da internet.
        </p>
      </header>

      <SegmentedControl
        label="Origem do HTML"
        options={INPUT_MODES}
        value={mode}
        onChange={edit(setMode)}
        disabled={isProcessing}
      />

      {mode === "paste" ? (
        <div className="space-y-1.5">
          <label htmlFor="html-source" className="text-sm font-medium">
            Código HTML
          </label>
          <textarea
            id="html-source"
            value={html}
            disabled={isProcessing}
            onChange={(event) => edit(setHtml)(event.target.value)}
            rows={10}
            spellCheck={false}
            placeholder="<h1>Meu documento</h1><p>Cole aqui o HTML (com CSS dentro de <style>).</p>"
            className="block w-full rounded-lg border bg-background p-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
      ) : (
        <>
          {!file && (
            <FileDropzone
              accept=".html,.htm,.xhtml,text/html"
              isAccepted={isHtml}
              multiple={false}
              onFiles={async ([selected]) => {
                reset();
                setFile(selected);
                setHtml(await selected.text());
              }}
              idlePrompt="Arraste um arquivo .html aqui ou clique para selecionar"
              dropPrompt="Solte o arquivo aqui"
              rejectedMessage={() => "Só arquivos .html ou .htm são aceitos."}
            />
          )}
          {file && (
            <SelectedFileCard
              file={file}
              icon={FileCode}
              disabled={isProcessing}
              onClear={() => {
                setFile(null);
                setHtml("");
                reset();
              }}
            />
          )}
        </>
      )}

      {prepared && (
        <>
          <Card>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tamanho da página</p>
                <SegmentedControl label="Tamanho da página" options={SIZES} value={size} onChange={edit(setSize)} disabled={isProcessing} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Orientação</p>
                <SegmentedControl label="Orientação da página" options={ORIENTATIONS} value={orientation} onChange={edit(setOrientation)} disabled={isProcessing} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Margem</p>
                <SegmentedControl label="Margem da página" options={MARGINS} value={margin} onChange={edit(setMargin)} disabled={isProcessing} />
              </div>
              {prepared.blocked > 0 && (
                <p role="note" className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {prepared.blocked === 1
                    ? "1 recurso externo (imagem ou CSS) foi bloqueado."
                    : `${prepared.blocked} recursos externos (imagens ou CSS) foram bloqueados.`}{" "}
                  Para aparecerem no PDF, coloque imagens como data URI e o CSS dentro de &lt;style&gt;.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pré-visualização</p>
            <div className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-3">
              <iframe
                ref={frameRef}
                title="Pré-visualização do HTML"
                // Sem allow-scripts: o código da página nunca é executado.
                sandbox="allow-same-origin allow-modals"
                srcDoc={prepared.html}
                onLoad={measureFrame}
                style={{ width: metrics.contentWidth, height: frameHeight, border: 0, background: "white" }}
                className="mx-auto block max-w-none shadow-sm"
              />
            </div>
          </div>

          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                <strong>Converter em PDF</strong> baixa o arquivo na hora, com a aparência
                exata da pré-visualização, mas o texto vira imagem (não dá para selecionar).
                <strong> Imprimir / salvar como PDF</strong> abre a impressão do navegador:
                escolha &quot;Salvar como PDF&quot; para um arquivo com texto selecionável.
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
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isProcessing}
                  onClick={() => frameRef.current?.contentWindow?.print()}
                >
                  <Printer aria-hidden />
                  Imprimir / salvar como PDF
                </Button>
                <Button
                  size="lg"
                  disabled={isProcessing}
                  onClick={() => frameRef.current && convert(frameRef.current, setup, baseName)}
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
              </div>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
