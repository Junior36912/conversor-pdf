"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { formatBytes } from "@/app/lib/utils";

interface SelectedFileCardProps {
  file: File;
  icon: LucideIcon;
  /** Complemento ao tamanho (ex.: "3 planilhas"). */
  detail?: string;
  disabled?: boolean;
  onClear: () => void;
}

/** Resumo do arquivo escolhido nas ferramentas que não são de PDF (Word, Excel, HTML...). */
export function SelectedFileCard({
  file,
  icon: Icon,
  detail,
  disabled,
  onClear,
}: SelectedFileCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
            {detail ? ` · ${detail}` : ""}
          </p>
        </div>
        <Button variant="outline" disabled={disabled} onClick={onClear}>
          Trocar arquivo
        </Button>
      </CardContent>
    </Card>
  );
}
