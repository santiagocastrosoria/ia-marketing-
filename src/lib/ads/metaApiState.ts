/** Estado en memoria del último resultado Meta API (por instancia de servidor). */

export interface MetaApiRuntimeState {
  adsReadConfirmed: boolean | null;
  lastMetaError?: string;
  lastMetaErrorCode?: string;
  lastCheckedAt?: string;
}

let runtimeState: MetaApiRuntimeState = { adsReadConfirmed: null };

export function getMetaApiRuntimeState(): MetaApiRuntimeState {
  return { ...runtimeState };
}

export function recordMetaApiSuccess(): void {
  runtimeState = {
    adsReadConfirmed: true,
    lastCheckedAt: new Date().toISOString(),
    lastMetaError: undefined,
    lastMetaErrorCode: undefined,
  };
}

export function recordMetaApiError(message: string, code: string, isPermission: boolean): void {
  runtimeState = {
    adsReadConfirmed: isPermission ? false : runtimeState.adsReadConfirmed,
    lastMetaError: message,
    lastMetaErrorCode: code,
    lastCheckedAt: new Date().toISOString(),
  };
}

export const META_ADS_READ_PERMISSION_MESSAGE =
  "No se pudieron importar métricas reales de Meta/Instagram. Falta permiso ads_read sobre la cuenta publicitaria.";

export const META_ADS_READ_PERMISSION_SUGGESTION =
  "Revisá Business Settings → Usuarios del sistema → Activos → Cuenta publicitaria → Ver rendimiento / Administrar campañas.";

export function isMetaPermissionDenied(details: unknown): boolean {
  const msg = [
    typeof details === "object" && details !== null && "message" in details
      ? String((details as { message?: string }).message)
      : "",
    JSON.stringify(details ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  return (
    msg.includes("ads_read") ||
    msg.includes("ads_management") ||
    msg.includes("(#200)") ||
    (msg.includes("permission") && msg.includes("grant")) ||
    (msg.includes("permiso") && msg.includes("otorg"))
  );
}
