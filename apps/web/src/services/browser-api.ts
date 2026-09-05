export class BrowserApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "BrowserApiError";
  }
}

export async function browserApiGet<T>(
  pathname: string,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>(pathname, { method: "GET", ...(signal ? { signal } : {}) });
}

export async function browserApiMutation<T>(
  pathname: string,
  method: "POST" | "PATCH" | "DELETE",
  input?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>(pathname, {
    method,
    ...(input === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    ...(signal ? { signal } : {}),
  });
}

async function request<T>(pathname: string, init: RequestInit): Promise<T> {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const response = await fetch(`/api/bff${normalized}`, {
    ...init,
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = readErrorCode(body) ?? "API_UNAVAILABLE";
    throw new BrowserApiError(code, response.status);
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new BrowserApiError("API_UNAVAILABLE", 503);
  }
  return (body as { data: T }).data;
}

function readErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = body.error;
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}
