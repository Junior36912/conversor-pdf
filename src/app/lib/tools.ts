import {
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Images,
  LayoutGrid,
  Merge,
  Presentation,
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

export interface ToolGroup {
  id: string;
  title: string;
  tools: Tool[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "edit",
    title: "Organizar e editar",
    tools: [
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
    ],
  },
  {
    id: "to-pdf",
    title: "Converter para PDF",
    tools: [
      {
        title: "Imagem para PDF",
        description: "Transforme JPG, PNG e outras imagens em um único PDF.",
        icon: Images,
        href: "/image-to-pdf",
      },
      {
        title: "Word para PDF",
        description: "Converta documentos .docx em PDF.",
        icon: FileText,
        href: "/word-to-pdf",
      },
      {
        title: "PowerPoint para PDF",
        description: "Converta apresentações .pptx em PDF.",
        icon: Presentation,
        href: "/powerpoint-to-pdf",
      },
      {
        title: "Excel para PDF",
        description: "Converta planilhas .xlsx em PDF.",
        icon: FileSpreadsheet,
        href: "/excel-to-pdf",
      },
      {
        title: "HTML para PDF",
        description: "Converta uma página HTML em PDF.",
        icon: FileCode,
        href: "/html-to-pdf",
      },
    ],
  },
  {
    id: "from-pdf",
    title: "Converter de PDF",
    tools: [
      {
        title: "PDF para Imagem",
        description: "Converta cada página de um PDF em PNG ou JPG.",
        icon: FileImage,
        href: "/pdf-to-image",
      },
      {
        title: "PDF para Word",
        description: "Extraia o texto de um PDF para um documento .docx editável.",
        icon: FileText,
        href: "/pdf-to-word",
      },
      {
        title: "PDF para PowerPoint",
        description: "Transforme as páginas de um PDF em slides .pptx.",
        icon: Presentation,
        href: "/pdf-to-powerpoint",
      },
      {
        title: "PDF para Excel",
        description: "Extraia tabelas e textos de um PDF para uma planilha .xlsx.",
        icon: FileSpreadsheet,
        href: "/pdf-to-excel",
      },
    ],
  },
];

export const TOOLS: Tool[] = TOOL_GROUPS.flatMap((group) => group.tools);
