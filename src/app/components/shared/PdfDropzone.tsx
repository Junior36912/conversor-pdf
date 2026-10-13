"use client";

import { FileDropzone } from "@/app/components/shared/FileDropzone";
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
export function PdfDropzone({ className, multiple = true, onFiles }: PdfDropzoneProps) {
  const addFiles = useFileStore((state) => state.addFiles);

  return (
    <FileDropzone
      accept="application/pdf,.pdf"
      isAccepted={isPdf}
      multiple={multiple}
      onFiles={onFiles ?? addFiles}
      className={className}
      idlePrompt={
        multiple
          ? "Arraste seus PDFs aqui ou clique para selecionar"
          : "Arraste um PDF aqui ou clique para selecionar"
      }
      dropPrompt={multiple ? "Solte os PDFs aqui" : "Solte o PDF aqui"}
      rejectedMessage={(count) =>
        count === 1
          ? "1 arquivo foi ignorado por não ser um PDF."
          : `${count} arquivos foram ignorados por não serem PDFs.`
      }
    />
  );
}
