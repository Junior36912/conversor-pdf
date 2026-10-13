import { zipSync, type Zippable } from "fflate";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Empacota os arquivos num ZIP sem recomprimir: PDFs já são comprimidos por dentro. */
export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const files: Zippable = {};
  for (const { name, data } of entries) files[name] = [data, { level: 0 }];
  return zipSync(files);
}
