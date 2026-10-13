"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TaskStatus = "idle" | "processing" | "done" | "error";

interface TaskContext {
  signal: AbortSignal;
  /** Informe um valor de 0 a 100. */
  onProgress: (percent: number) => void;
  /** Registra o nome do arquivo entregue ao usuário (exibido na mensagem de sucesso). */
  setOutputName: (name: string) => void;
}

/**
 * Ciclo de vida comum às ferramentas que rodam em Web Worker: status, progresso,
 * mensagem de erro, nome do arquivo gerado e cancelamento automático quando a
 * página sai de cena.
 */
export function usePdfTask() {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (
      task: (context: TaskContext) => Promise<void>,
      describeError: (cause: unknown) => string,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("processing");
      setProgress(0);
      setError(null);
      setOutputName(null);

      try {
        await task({
          signal: controller.signal,
          onProgress: setProgress,
          setOutputName,
        });
        setStatus("done");
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          setStatus("idle");
          setProgress(0);
          return;
        }
        setError(describeError(cause));
        setStatus("error");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setOutputName(null);
  }, []);

  return { status, progress, error, outputName, run, reset };
}
