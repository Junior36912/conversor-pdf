"use client";

import { useCallback } from "react";
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { PdfThumbnail } from "@/app/components/shared/PdfThumbnail";
import { Button } from "@/app/components/ui/button";
import { cn, formatBytes } from "@/app/lib/utils";
import type { PdfFileItem } from "@/app/store/useFileStore";

interface SortablePdfListProps {
  items: PdfFileItem[];
  /** Bloqueia reordenar e remover (ex.: enquanto o merge está rodando). */
  disabled?: boolean;
  onReorder: (activeId: string, overId: string) => void;
  onRemove: (id: string) => void;
  onPreviewReady: (id: string, dataUrl: string) => void;
}

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pressione espaço ou Enter na alça, use as setas para mover e pressione espaço ou Enter para soltar. Esc cancela.",
};

export function SortablePdfList({
  items,
  disabled,
  onReorder,
  onRemove,
  onPreviewReady,
}: SortablePdfListProps) {
  const sensors = useSensors(
    // A distância mínima evita que um simples clique inicie o arraste.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: UniqueIdentifier) =>
    items.find((item) => item.id === id)?.file.name ?? "Arquivo";
  const positionOf = (id: UniqueIdentifier) =>
    items.findIndex((item) => item.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOf(active.id)} selecionado.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} está sobre a posição ${positionOf(over.id)} de ${items.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} movido para a posição ${positionOf(over.id)} de ${items.length}.`
        : `${nameOf(active.id)} solto sem alteração.`,
    onDragCancel: ({ active }) => `Movimento de ${nameOf(active.id)} cancelado.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    // `id` fixo evita divergência de hidratação nos atributos aria gerados pelo dnd-kit.
    <DndContext
      id="pdf-sortable-list"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="divide-y">
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              position={index + 1}
              disabled={disabled}
              onRemove={onRemove}
              onPreviewReady={onPreviewReady}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  item: PdfFileItem;
  position: number;
  disabled?: boolean;
  onRemove: (id: string) => void;
  onPreviewReady: (id: string, dataUrl: string) => void;
}

function SortableRow({
  item,
  position,
  disabled,
  onRemove,
  onPreviewReady,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const { id, file, preview } = item;
  const handlePreviewReady = useCallback(
    (dataUrl: string) => onPreviewReady(id, dataUrl),
    [id, onPreviewReady],
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex items-center gap-3 bg-card py-3",
        isDragging && "z-10 rounded-lg shadow-lg ring-1 ring-border",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Reordenar ${file.name}`}
        className="cursor-grab touch-none active:cursor-grabbing"
      >
        <GripVertical aria-hidden />
      </Button>
      <span
        aria-hidden
        className="w-5 text-center text-sm tabular-nums text-muted-foreground"
      >
        {position}
      </span>
      <PdfThumbnail
        file={file}
        preview={preview}
        onPreviewReady={handlePreviewReady}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => onRemove(id)}
        aria-label={`Remover ${file.name}`}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}
