import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organizar PDF",
  description:
    "Gire, reordene e exclua páginas de um PDF, direto no navegador e sem enviar nenhum arquivo.",
};

export default function OrganizePdfLayout({
  children,
}: LayoutProps<"/organize-pdf">) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">{children}</section>
  );
}
