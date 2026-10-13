import { ShieldCheck } from "lucide-react";
import { SITE_NAME } from "@/app/lib/constants";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          100% Gratuita, Offline e Segura
        </p>
        <p>
          {SITE_NAME} processa tudo no seu navegador. Seus arquivos nunca são
          enviados a nenhum servidor.
        </p>
      </div>
    </footer>
  );
}
