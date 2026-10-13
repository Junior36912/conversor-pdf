import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF para PowerPoint",
  description:
    "Converta as páginas de um PDF em slides .pptx, direto no navegador e sem enviar nenhum arquivo.",
};

export default function PdfToPowerPointLayout({
  children,
}: LayoutProps<"/pdf-to-powerpoint">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
