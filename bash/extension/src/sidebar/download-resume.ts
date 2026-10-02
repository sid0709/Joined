export function triggerResumeDownload(file: {
  name: string;
  mimeType?: string | null;
  base64: string;
}) {
  const a = document.createElement("a");
  a.href = `data:${file.mimeType || "application/octet-stream"};base64,${file.base64}`;
  a.download = file.name;
  a.rel = "noopener";
  a.click();
}
