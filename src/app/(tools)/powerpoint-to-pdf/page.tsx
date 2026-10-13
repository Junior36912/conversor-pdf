"use client";

import { useState } from "react";
import { CircleCheck, Loader2, Presentation } from "lucide-react";
import { FileDropzone } from "@/app/components/shared/FileDropzone";
import { SelectedFileCard } from "@/app/components/shared/SelectedFileCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { usePowerPointToPdf } from "@/app/hooks/usePowerPointToPdf";

const isPptx = (file: File): boolean => /\.(pptx|ppsx)$/i.test(file.name);

export default function PowerPointToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const { status, progress, error, outputName, convert, reset } = usePowerPointToPdf();
  const isProcessing = status === "processing";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">PowerPoint para PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Converta uma apresentação .pptx em PDF, um slide por página, com texto
          selecionável.
        </p>
      </header>

      {!file && (
        <FileDropzone
          accept=".pptx,.ppsx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          isAccepted={isPptx}
          multiple={false}
          onFiles={([selected]) => {
            setFile(selected);
            reset();
          }}
          idlePrompt="Arraste uma apresentação .pptx aqui ou clique para selecionar"
          dropPrompt="Solte a apresentação aqui"
          rejectedMessage={() =>
            "Só arquivos .pptx são aceitos. Para um .ppt antigo, abra no PowerPoint e use Salvar como .pptx."
          }
        />
      )}

      {file && (
        <>
          <SelectedFileCard
            file={file}
            icon={Presentation}
            disabled={isProcessing}
            onClear={() => {
              setFile(null);
              reset();
            }}
          />

          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A conversão é aproximada: as fontes do Office são trocadas por
                equivalentes, degradês viram cor sólida, e gráficos, diagramas
                SmartArt, animações e transições não são reproduzidos (gráficos e
                diagramas aparecem como uma caixa cinza). Slides ocultos são ignorados.
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
              <Button size="lg" className="self-end" disabled={isProcessing} onClick={() => convert(file)}>
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
