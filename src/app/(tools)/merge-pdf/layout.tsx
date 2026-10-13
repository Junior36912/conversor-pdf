import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Juntar PDF",
  description:
    "Junte vários PDFs em um só, direto no navegador e sem enviar nenhum arquivo.",
};

export default function MergePdfLayout({ children }: LayoutProps<"/merge-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
