export const MESSAGE_POLL_MS = 4000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = JSON.parse(text) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function meGet<T>(path: string) {
  return request<T>(`/api/me${path}`);
}

export function meSend<T>(path: string, method: string, body?: unknown) {
  return request<T>(`/api/me${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function companyGet<T>(path: string) {
  return request<T>(`/api/company${path}`);
}

export function companySend<T>(path: string, method: string, body?: unknown) {
  return request<T>(`/api/company${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
