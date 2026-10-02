/** Remembers successful uploads by oak node id after the file input is remounted away. */

const uploadedByOakId = new Map<string, string>();

export function rememberUploadedFile(oakId: string | null | undefined, fileName: string): void {
  if (!oakId || !fileName) return;
  uploadedByOakId.set(String(oakId), fileName);
}

export function getRememberedUpload(oakId: number | string): string | null {
  return uploadedByOakId.get(String(oakId)) ?? null;
}

export function pageMentionsFilename(doc: Document, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  if ((doc.body?.innerText || "").toLowerCase().includes(needle)) return true;

  for (const node of Array.from(doc.querySelectorAll("a, span, div, p, li, button"))) {
    const text = ((node as HTMLElement).innerText || node.textContent || "").trim();
    if (!text) continue;
    if (text.toLowerCase() === needle || text.toLowerCase().includes(needle)) {
      if ((node as HTMLElement).getClientRects().length > 0) return true;
    }
  }
  return false;
}
