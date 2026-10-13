import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Word para PDF",
  description:
    "Converta documentos .docx em PDF direto no navegador, sem enviar nenhum arquivo.",
};

export default function WordToPdfLayout({ children }: LayoutProps<"/word-to-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
