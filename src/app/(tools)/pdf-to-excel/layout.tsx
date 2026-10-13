import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF para Excel",
  description:
    "Extraia tabelas de um PDF para uma planilha .xlsx, direto no navegador e sem enviar nenhum arquivo.",
};

export default function PdfToExcelLayout({ children }: LayoutProps<"/pdf-to-excel">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
