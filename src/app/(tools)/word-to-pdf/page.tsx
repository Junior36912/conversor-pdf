"use client";

import { useState } from "react";
import { CircleCheck, FileText, Loader2 } from "lucide-react";
import { FileDropzone } from "@/app/components/shared/FileDropzone";
import { SelectedFileCard } from "@/app/components/shared/SelectedFileCard";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { useWordToPdf } from "@/app/hooks/useWordToPdf";

const isDocx = (file: File): boolean => /\.docx$/i.test(file.name);

export default function WordToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const { status, progress, error, outputName, convert, reset } = useWordToPdf();
  const isProcessing = status === "processing";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Word para PDF</h1>
        <p className="mt-1 text-muted-foreground">
          Converta um documento do Word (.docx) em PDF, com texto selecionável.
        </p>
      </header>

      {!file && (
        <FileDropzone
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          isAccepted={isDocx}
          multiple={false}
          onFiles={([selected]) => {
            setFile(selected);
            reset();
          }}
          idlePrompt="Arraste um documento .docx aqui ou clique para selecionar"
          dropPrompt="Solte o documento aqui"
          rejectedMessage={() =>
            "Só arquivos .docx são aceitos. Para um .doc antigo, abra no Word e use Salvar como .docx."
          }
        />
      )}

      {file && (
        <>
          <SelectedFileCard
            file={file}
            icon={FileText}
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
                equivalentes (Liberation), e notas de rodapé e alguns recursos
                avançados podem não aparecer. O texto continua selecionável.
              </p>
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
                size="lg"
                className="self-end"
                disabled={isProcessing}
                onClick={() => convert(file)}
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
