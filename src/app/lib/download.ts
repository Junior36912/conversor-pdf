/** Dispara o download de bytes gerados localmente, sem passar por nenhum servidor. */
export function downloadBlob(
  data: BlobPart,
  filename: string,
  type = "application/pdf",
): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
