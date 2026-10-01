export function joinedApiUrl(): string {
  const url = process.env.JOINED_API_URL;
  if (!url) {
    throw new Error("JOINED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}
