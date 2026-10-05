export function joinedApiUrl(): string {
  const url = process.env.JOINED_API_URL;
  if (!url) {
    throw new Error("JOINED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export function isCompanyModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED === "true";
}
