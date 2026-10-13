import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marca d'água",
  description:
    "Aplique uma marca d'água de texto em um PDF, direto no navegador e sem enviar nenhum arquivo.",
};

export default function WatermarkPdfLayout({
  children,
}: LayoutProps<"/watermark-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
