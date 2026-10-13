"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useFileStore } from "@/app/store/useFileStore";

const isPdf = (file: File): boolean =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

interface PdfDropzoneProps {
  className?: string;
  /** Com `false`, aceita um único PDF (o primeiro, se vários forem soltos). */
  multiple?: boolean;
  /** Por padrão os PDFs vão para o store global; passe isto para tratá-los à parte. */
  onFiles?: (files: File[]) => void;
}

/** Aceita `.pdf` (arrastar ou selecionar) e os adiciona ao store global. */
export function PdfDropzone({
  className,
  multiple = true,
  onFiles,
}: PdfDropzoneProps) {
  const addFiles = useFileStore((state) => state.addFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  // Contador evita o "piscar" causado por dragenter/dragleave dos elementos filhos.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);

  const handleFiles = (list: FileList | null) => {
    const incoming = Array.from(list ?? []);
    const pdfs = incoming.filter(isPdf);
    setRejectedCount(incoming.length - pdfs.length);
    if (pdfs.length > 0) {
      (onFiles ?? addFiles)(multiple ? pdfs : pdfs.slice(0, 1));
    }
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
        accept="application/pdf,.pdf"
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
          {isDragging
            ? multiple
              ? "Solte os PDFs aqui"
              : "Solte o PDF aqui"
            : multiple
              ? "Arraste seus PDFs aqui ou clique para selecionar"
              : "Arraste um PDF aqui ou clique para selecionar"}
        </span>
        <span className="text-sm text-muted-foreground">
          Os arquivos ficam no seu navegador e nunca são enviados.
        </span>
      </button>
      {rejectedCount > 0 && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rejectedCount === 1
            ? "1 arquivo foi ignorado por não ser um PDF."
            : `${rejectedCount} arquivos foram ignorados por não serem PDFs.`}
        </p>
      )}
    </div>
  );
}
