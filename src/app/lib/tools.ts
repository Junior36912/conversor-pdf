import {
  FileImage,
  LayoutGrid,
  Merge,
  Scissors,
  Shrink,
  Stamp,
  type LucideIcon,
} from "lucide-react";

export interface Tool {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export const TOOLS: Tool[] = [
  {
    title: "Juntar PDF",
    description: "Combine vários arquivos PDF em um único documento.",
    icon: Merge,
    href: "/merge-pdf",
  },
  {
    title: "Dividir PDF",
    description: "Separe páginas ou intervalos de um PDF em novos arquivos.",
    icon: Scissors,
    href: "/split-pdf",
  },
  {
    title: "Organizar PDF",
    description: "Gire, reordene e exclua páginas de um PDF.",
    icon: LayoutGrid,
    href: "/organize-pdf",
  },
  {
    title: "Comprimir PDF",
    description: "Reduza o tamanho do arquivo mantendo o texto legível.",
    icon: Shrink,
    href: "/compress-pdf",
  },
  {
    title: "Marca d'água",
    description: "Aplique um texto como marca d'água nas páginas do PDF.",
    icon: Stamp,
    href: "/watermark-pdf",
  },
  {
    title: "PDF para Imagem",
    description: "Converta cada página de um PDF em uma imagem.",
    icon: FileImage,
    href: "/pdf-to-image",
  },
];
