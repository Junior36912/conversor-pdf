"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface FileDropzoneProps {
  /** Valor do atributo `accept` do input (ex.: ".docx"). */
  accept: string;
  /** Decide quais arquivos soltos/escolhidos são aceitos; os demais são descartados com aviso. */
  isAccepted: (file: File) => boolean;
  /** Texto principal em repouso (ex.: "Arraste seus PDFs aqui ou clique para selecionar"). */
  idlePrompt: string;
  /** Texto principal enquanto algo é arrastado sobre a área. */
  dropPrompt: string;
  /** Aviso mostrado quando `count` arquivos foram descartados. */
  rejectedMessage: (count: number) => string;
  /** Linha secundária (por padrão, lembra que nada é enviado). */
  hint?: string;
  /** Com `false`, usa só o primeiro arquivo aceito. */
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}

/** Área de arrastar e soltar (ou clicar) genérica, independente do tipo de arquivo. */
export function FileDropzone({
  accept,
  isAccepted,
  idlePrompt,
  dropPrompt,
  rejectedMessage,
  hint = "Os arquivos ficam no seu navegador e nunca são enviados.",
  multiple = true,
  onFiles,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Contador evita o "piscar" causado por dragenter/dragleave dos elementos filhos.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);

  const handleFiles = (list: FileList | null) => {
    const incoming = Array.from(list ?? []);
    const accepted = incoming.filter(isAccepted);
    setRejectedCount(incoming.length - accepted.length);
    if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = ""; // permite selecionar o mesmo arquivo novamente
  };

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/50",
        )}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        <span className="text-base font-medium">
          {isDragging ? dropPrompt : idlePrompt}
        </span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </button>
      {rejectedCount > 0 && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rejectedMessage(rejectedCount)}
        </p>
      )}
    </div>
  );
}
