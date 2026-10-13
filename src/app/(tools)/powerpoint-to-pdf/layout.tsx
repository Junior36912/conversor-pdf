import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PowerPoint para PDF",
  description:
    "Converta apresentações .pptx em PDF direto no navegador, sem enviar nenhum arquivo.",
};

export default function PowerPointToPdfLayout({
  children,
}: LayoutProps<"/powerpoint-to-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
