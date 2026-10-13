import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comprimir PDF",
  description:
    "Reduza o tamanho de um PDF direto no navegador, sem enviar nenhum arquivo.",
};

export default function CompressPdfLayout({
  children,
}: LayoutProps<"/compress-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
