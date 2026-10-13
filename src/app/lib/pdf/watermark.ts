export type WatermarkLayout = "center" | "tile";

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  /** Componentes de 0 a 1. */
  color: { r: number; g: number; b: number };
  /** De 0 (invisível) a 1 (opaco). */
  opacity: number;
  /** Graus, anti-horário, como o texto aparece na tela. */
  rotation: number;
  layout: WatermarkLayout;
  /** Páginas (1-based) que recebem a marca d'água. */
  pages: number[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  x: number;
  y: number;
}

const MAX_PLACEMENTS = 5000;

/** Converte "#rrggbb" em componentes de 0 a 1 (cinza médio se o valor for inválido). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = match ? parseInt(match[1], 16) : 0x808080;
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

/**
 * Calcula onde desenhar o texto (âncora = canto inferior esquerdo da linha de base,
 * já considerando a rotação) para centralizá-lo ou repeti-lo em mosaico na página.
 * `angle` é o ângulo no espaço de conteúdo do PDF (já somado à rotação da página).
 */
export function computePlacements(
  box: Box,
  textWidth: number,
  fontSize: number,
  angle: number,
  layout: WatermarkLayout,
): Placement[] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotate = (u: number, v: number): [number, number] => [
    u * cos - v * sin,
    u * sin + v * cos,
  ];

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const halfCapHeight = fontSize * 0.36; // centraliza o texto na vertical, não na linha de base

  // (u, v): posição do centro do texto em relação ao centro da página, no eixo do texto.
  const anchorFor = (u: number, v: number): Placement => {
    const [dx, dy] = rotate(u - textWidth / 2, v - halfCapHeight);
    return { x: centerX + dx, y: centerY + dy };
  };

  if (layout === "center") return [anchorFor(0, 0)];

  const stepX = textWidth + fontSize * 2;
  const stepY = fontSize * 4;
  const reach = Math.hypot(box.width, box.height) / 2 + textWidth / 2 + fontSize;
  const rows = Math.ceil(reach / stepY);
  const cols = Math.ceil(reach / stepX);
  const margin = textWidth / 2 + fontSize;

  const placements: Placement[] = [];
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      // Linhas alternadas ficam deslocadas meio passo, formando um mosaico.
      const u = col * stepX + (Math.abs(row) % 2 === 1 ? stepX / 2 : 0);
      const v = row * stepY;

      const [dx, dy] = rotate(u, v);
      const x = centerX + dx;
      const y = centerY + dy;
      const outside =
        x < box.x - margin ||
        x > box.x + box.width + margin ||
        y < box.y - margin ||
        y > box.y + box.height + margin;
      if (outside) continue;

      placements.push(anchorFor(u, v));
      if (placements.length >= MAX_PLACEMENTS) return placements;
    }
  }
  return placements;
}
