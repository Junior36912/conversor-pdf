import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Excel para PDF",
  description:
    "Converta planilhas .xlsx em PDF direto no navegador, sem enviar nenhum arquivo.",
};

export default function ExcelToPdfLayout({ children }: LayoutProps<"/excel-to-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
