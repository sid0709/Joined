export function openedApiUrl(): string {
  const url = process.env.OPENED_API_URL;
  if (!url) {
    throw new Error("OPENED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}
