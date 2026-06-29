import type { ApiErrorBody } from "@/lib/api/apiError";

export class FetchApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FetchApiError";
  }
}

export async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  const text = await res.text();

  let data: T | ApiErrorBody | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T | ApiErrorBody;
    } catch {
      if (!res.ok) {
        throw new FetchApiError(
          `Respuesta inválida del servidor (HTTP ${res.status})`,
          res.status,
          "INVALID_JSON_RESPONSE"
        );
      }
      throw new FetchApiError("Respuesta vacía o no JSON del servidor", res.status);
    }
  }

  if (!res.ok) {
    const errBody = data as ApiErrorBody | null;
    const message =
      errBody?.message ??
      (typeof errBody?.error === "string" ? errBody.error : undefined) ??
      `Error HTTP ${res.status}`;
    throw new FetchApiError(
      message,
      res.status,
      errBody?.code,
      errBody ? (errBody as unknown as Record<string, unknown>) : undefined
    );
  }

  if (data === null) {
    throw new FetchApiError("Respuesta vacía del servidor", res.status);
  }

  return data as T;
}
