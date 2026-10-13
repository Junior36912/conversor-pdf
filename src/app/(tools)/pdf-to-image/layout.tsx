import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF para Imagem",
  description:
    "Converta as páginas de um PDF em imagens PNG ou JPG, direto no navegador e sem enviar nenhum arquivo.",
};

export default function PdfToImageLayout({
  children,
}: LayoutProps<"/pdf-to-image">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
