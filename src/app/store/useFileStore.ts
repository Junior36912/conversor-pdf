import { create } from "zustand";

export interface PdfFileItem {
  id: string;
  file: File;
  /** Data URL (base64) da primeira página, preenchida de forma assíncrona. */
  preview?: string;
}

interface FileState {
  files: PdfFileItem[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  /** Move o item `activeId` para a posição atual do item `overId`. */
  reorderFiles: (activeId: string, overId: string) => void;
  setPreview: (id: string, preview: string) => void;
}

// randomUUID só existe em contextos seguros (https/localhost).
const createId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const useFileStore = create<FileState>((set) => ({
  files: [],
  addFiles: (files) =>
    set((state) => ({
      files: [
        ...state.files,
        ...files.map((file): PdfFileItem => ({ id: createId(), file })),
      ],
    })),
  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((item) => item.id !== id) })),
  clearFiles: () => set({ files: [] }),
  reorderFiles: (activeId, overId) =>
    set((state) => {
      const from = state.files.findIndex((item) => item.id === activeId);
      const to = state.files.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0 || from === to) return state;

      const files = [...state.files];
      files.splice(to, 0, ...files.splice(from, 1));
      return { files };
    }),
  setPreview: (id, preview) =>
    set((state) => ({
      files: state.files.map((item) =>
        item.id === id ? { ...item, preview } : item,
      ),
    })),
}));
