import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dividir PDF",
  description:
    "Divida um PDF por intervalos de páginas, direto no navegador e sem enviar nenhum arquivo.",
};

export default function SplitPdfLayout({ children }: LayoutProps<"/split-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
