import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF para Word",
  description:
    "Converta um PDF em documento .docx editável, direto no navegador e sem enviar nenhum arquivo.",
};

export default function PdfToWordLayout({ children }: LayoutProps<"/pdf-to-word">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
