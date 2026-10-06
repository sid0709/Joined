export const ACCOUNT_EXPORT_PATH = "/api/auth/account/export";
export const ACCOUNT_EXPORT_FILENAME = "joined-account-export.json";
export const ACCOUNT_EXPORT_ZIP_FILENAME = "joined-account-export.zip";
export const ACCOUNT_EXPORT_RATE_LIMIT = "You can export once an hour.";

const JSON_TYPE = "application/json";
const ZIP_TYPE = "application/zip";

export class AccountExportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccountExportError";
    this.status = status;
  }
}

export function exportFilename(contentType: string | null): string {
  if (contentType?.includes(ZIP_TYPE)) return ACCOUNT_EXPORT_ZIP_FILENAME;
  return ACCOUNT_EXPORT_FILENAME;
}

export function exportFailure(status: number, body: string): AccountExportError {
  let message = "Could not export your account.";
  try {
    const parsed = JSON.parse(body) as { error?: string; detail?: string };
    if (parsed.detail) message = parsed.detail;
    else if (parsed.error) message = parsed.error;
  } catch {
    /* keep the generic message */
  }
  if (status === 429 && message === "Could not export your account.") {
    message = ACCOUNT_EXPORT_RATE_LIMIT;
  }
  return new AccountExportError(message, status);
}

export async function downloadAccountExport(): Promise<{ filename: string }> {
  const response = await fetch(ACCOUNT_EXPORT_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw exportFailure(response.status, await response.text());
  }
  const filename = exportFilename(response.headers.get("Content-Type") ?? JSON_TYPE);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { filename };
}
