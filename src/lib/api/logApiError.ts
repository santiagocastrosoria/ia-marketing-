import type { PostgrestError } from "@supabase/supabase-js";

export function formatSupabaseError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const e = error as PostgrestError;
    return [e.message, e.details, e.hint].filter(Boolean).join(" | ");
  }
  return error instanceof Error ? error.message : String(error);
}

export function logApiError(
  route: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const details = formatSupabaseError(error);
  const supa =
    error && typeof error === "object" && "code" in error
      ? (error as PostgrestError)
      : null;

  console.error(`[api:${route}]`, {
    message: details,
    supabaseCode: supa?.code,
    context,
  });
}
