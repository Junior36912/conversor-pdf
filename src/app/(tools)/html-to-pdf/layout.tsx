import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML para PDF",
  description:
    "Converta código ou arquivos HTML em PDF direto no navegador, sem executar scripts e sem enviar nada.",
};

export default function HtmlToPdfLayout({ children }: LayoutProps<"/html-to-pdf">) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">{children}</section>
  );
}
