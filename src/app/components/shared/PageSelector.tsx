"use client";

import { SegmentedControl } from "@/app/components/shared/SegmentedControl";
import { Input } from "@/app/components/ui/input";
import type { PagesMode, PagesPlan } from "@/app/lib/pdf/ranges";

const PAGES_MODES = [
  { value: "all", label: "Todas as páginas" },
  { value: "custom", label: "Páginas específicas" },
] as const satisfies readonly { value: PagesMode; label: string }[];

interface PageSelectorProps {
  /** Prefixo dos ids gerados (`<prefixo>-pages` e `<prefixo>-pages-error`). */
  idPrefix: string;
  pageCount: number;
  mode: PagesMode;
  onModeChange: (mode: PagesMode) => void;
  input: string;
  onInputChange: (input: string) => void;
  plan: PagesPlan;
  disabled?: boolean;
}

/** Escolha entre todas as páginas ou um texto de intervalos (ex.: 1-3, 5, 8-). */
export function PageSelector({
  idPrefix,
  pageCount,
  mode,
  onModeChange,
  input,
  onInputChange,
  plan,
  disabled,
}: PageSelectorProps) {
  const inputId = `${idPrefix}-pages`;
  const errorId = `${inputId}-error`;
  const showError = !plan.ok && mode === "custom" && input.trim() !== "";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Páginas</p>
      <SegmentedControl
        label="Páginas a processar"
        options={PAGES_MODES}
        value={mode}
        onChange={onModeChange}
        disabled={disabled}
      />

      {mode === "custom" && (
        <div className="space-y-1.5 pt-1">
          <label htmlFor={inputId} className="sr-only">
            Páginas a processar
          </label>
          <Input
            id={inputId}
            value={input}
            placeholder="1-3, 5, 8-"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errorId : undefined}
            onChange={(event) => onInputChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Informe páginas e intervalos separados por vírgula. &quot;8-&quot; vai
            até a última página ({pageCount}).
          </p>
          {!plan.ok && showError && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {plan.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
