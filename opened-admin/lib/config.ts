export function adminApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_ADMIN_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}
