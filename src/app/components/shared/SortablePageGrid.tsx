"use client";

import { useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PdfPageRenderer } from "@/app/lib/pdf/render";
import { cn } from "@/app/lib/utils";

/** Página na lista de saída: `page` é a página de origem; `rotation`, o giro extra (horário). */
export interface PageItem {
  id: string;
  page: number;
  rotation: number;
}

interface SortablePageGridProps {
  items: PageItem[];
  renderer: PdfPageRenderer;
  disabled?: boolean;
  onReorder: (activeId: string, overId: string) => void;
  onRotate: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pressione espaço ou Enter na miniatura, use as setas para mover e pressione espaço ou Enter para soltar. Esc cancela.",
};

export function SortablePageGrid({
  items,
  renderer,
  disabled,
  onReorder,
  onRotate,
  onRemove,
}: SortablePageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: UniqueIdentifier) =>
    `Página ${items.find((item) => item.id === id)?.page ?? "?"}`;
  const positionOf = (id: UniqueIdentifier) =>
    items.findIndex((item) => item.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${labelOf(active.id)} selecionada.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} está sobre a posição ${positionOf(over.id)} de ${items.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} movida para a posição ${positionOf(over.id)} de ${items.length}.`
        : `${labelOf(active.id)} solta sem alteração.`,
    onDragCancel: ({ active }) => `Movimento de ${labelOf(active.id)} cancelado.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      id="pdf-page-grid"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <PageTile
              key={item.id}
              item={item}
              position={index + 1}
              renderer={renderer}
              disabled={disabled}
              onRotate={onRotate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface PageTileProps {
  item: PageItem;
  position: number;
  renderer: PdfPageRenderer;
  disabled?: boolean;
  onRotate: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

function PageTile({ item, position, renderer, disabled, onRotate, onRemove }: PageTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });
  const { id, page, rotation } = item;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-lg border bg-card p-2",
        isDragging && "z-10 shadow-lg ring-1 ring-border",
      )}
    >
      {/* A própria miniatura é a alça: um alvo grande para mouse, toque e teclado. */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reordenar página ${page}`}
        aria-disabled={disabled}
        className={cn(
          "relative flex aspect-square touch-none items-center justify-center overflow-hidden rounded bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
        )}
      >
        <PageImage renderer={renderer} page={page} rotation={rotation} />
        <span
          aria-hidden
          className="absolute top-1 left-1 rounded bg-background/90 px-1.5 text-xs font-medium tabular-nums shadow-sm"
        >
          {position}
        </span>
      </div>

      <div className="flex items-center justify-between gap-1">
        <span className="px-1 text-xs text-muted-foreground">Pág. {page}</span>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => onRotate(id, -90)}
            aria-label={`Girar página ${page} para a esquerda`}
          >
            <RotateCcw aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => onRotate(id, 90)}
            aria-label={`Girar página ${page} para a direita`}
          >
            <RotateCw aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => onRemove(id)}
            aria-label={`Excluir página ${page}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

interface PageImageProps {
  renderer: PdfPageRenderer;
  page: number;
  rotation: number;
}

function PageImage({ renderer, page, rotation }: PageImageProps) {
  const [loaded, setLoaded] = useState<{
    renderer: PdfPageRenderer;
    page: number;
    src?: string;
  }>();

  useEffect(() => {
    let cancelled = false;
    renderer
      .renderThumbnail(page)
      .then((src) => !cancelled && setLoaded({ renderer, page, src }))
      .catch(() => !cancelled && setLoaded({ renderer, page }));
    return () => {
      cancelled = true;
    };
  }, [renderer, page]);

  const current = loaded?.renderer === renderer && loaded.page === page ? loaded : null;

  if (!current) return <div className="size-full animate-pulse bg-muted" />;
  if (!current.src) return <FileText className="size-8 text-muted-foreground" aria-hidden />;

  return (
    // Data URL local: next/image não traria nenhuma otimização aqui.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.src}
      alt={`Miniatura da página ${page}`}
      draggable={false}
      style={{ transform: `rotate(${rotation}deg)` }}
      className="max-h-full max-w-full object-contain transition-transform duration-150"
    />
  );
}
