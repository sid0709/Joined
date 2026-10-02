/** Remembers successful uploads by acorn node id after the file input is remounted away. */

const uploadedByAcornId = new Map<string, string>();

export function rememberUploadedFile(acornId: string | null | undefined, fileName: string): void {
  if (!acornId || !fileName) return;
  uploadedByAcornId.set(String(acornId), fileName);
}

export function getRememberedUpload(acornId: number | string): string | null {
  return uploadedByAcornId.get(String(acornId)) ?? null;
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
