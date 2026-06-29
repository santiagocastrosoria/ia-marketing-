import { NextResponse } from "next/server";
import { formatSupabaseError } from "@/lib/api/logApiError";

export interface ApiErrorBody {
  error: true;
  code: string;
  message: string;
  details?: string;
}

export function isUuidError(message: string): boolean {
  return (
    message.includes("invalid input syntax for type uuid") ||
    message.includes("invalid UUID") ||
    message.includes("invalid input syntax for type uuid")
  );
}

export function isRlsError(message: string): boolean {
  return (
    message.includes("row-level security") ||
    message.includes("RLS") ||
    message.includes("42501")
  );
}

export function apiErrorResponse(
  error: unknown,
  code = "INTERNAL_ERROR",
  status = 500
): NextResponse<ApiErrorBody> {
  const details = formatSupabaseError(error);
  const uuidProblem = isUuidError(details);
  const rlsProblem = isRlsError(details);

  let resolvedCode = code;
  let message = details || "Error interno del servidor";

  if (uuidProblem) {
    resolvedCode = "INVALID_UUID_OR_SUPABASE_ERROR";
    message =
      "Hubo un problema con el identificador de usuario. Verificá la sesión y los UUID.";
  } else if (rlsProblem) {
    resolvedCode = "RLS_POLICY_VIOLATION";
    message =
      "Permiso denegado por políticas RLS. Verificá que el business pertenezca al usuario autenticado.";
  }

  const body: ApiErrorBody = {
    error: true,
    code: resolvedCode,
    message,
    details,
  };

  console.error("[api-error]", body.code, details);

  return NextResponse.json(body, { status });
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ error: false, ...data }, { status });
}

export function apiFail(
  message: string,
  code: string,
  status = 400,
  extra?: Record<string, unknown>
): NextResponse<ApiErrorBody & Record<string, unknown>> {
  return NextResponse.json({ error: true, code, message, ...extra }, { status });
}
