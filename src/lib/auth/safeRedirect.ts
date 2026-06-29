const ALLOWED_REDIRECT_PREFIXES = [
  "/dashboard",
  "/brand-knowledge",
  "/objectives",
  "/strategy",
  "/campaigns",
  "/approvals",
  "/metrics",
];

/**
 * Valida que un path de redirección sea relativo y apunte a rutas permitidas.
 * Previene open redirects (//evil.com, https://..., etc.).
 */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!path || typeof path !== "string") return fallback;

  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;

  const pathname = trimmed.split("?")[0].split("#")[0];
  const allowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return allowed ? trimmed : fallback;
}
