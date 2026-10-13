import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imagem para PDF",
  description:
    "Transforme JPG, PNG e outras imagens em um PDF, direto no navegador e sem enviar nenhum arquivo.",
};

export default function ImageToPdfLayout({
  children,
}: LayoutProps<"/image-to-pdf">) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">{children}</section>
  );
}
