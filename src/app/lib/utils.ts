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

// Extensões de entrada que as ferramentas reconhecem; qualquer outro ponto no nome é preservado.
const KNOWN_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|html?|jpe?g|png|webp|gif|bmp|avif)$/i

/** Nome do arquivo sem a extensão conhecida e sem caracteres inválidos em nomes de arquivo. */
export function fileBaseName(filename: string): string {
  return (
    filename.replace(KNOWN_EXTENSION, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "documento"
  )
}
