export { cn } from "cn"

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  )
  const value = bytes / 1024 ** exponent
  return `${exponent === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[exponent]}`
}

/** Nome do arquivo sem a extensão `.pdf` e sem caracteres inválidos em nomes de arquivo. */
export function fileBaseName(filename: string): string {
  return (
    filename.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "documento"
  )
}
