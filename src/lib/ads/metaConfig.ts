import { getAdsMode, type AdsMode } from "@/lib/utils/config";
import {
  getMetaApiRuntimeState,
  META_ADS_READ_PERMISSION_SUGGESTION,
} from "@/lib/ads/metaApiState";

export type MetaConfigStatus =
  | "not_configured"
  | "partial"
  | "configured"
  | "connected"
  | "connection_failed";

export interface MetaIntegrationStatus {
  adsMode: AdsMode;
  metaReadEnabled: boolean;
  status: MetaConfigStatus;
  message: string;
  adAccountId?: string;
  adAccountIdMasked?: string;
  hasAppId: boolean;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
  /** Token configurado en servidor */
  tokenConfigured: boolean;
  /** Ad account ID configurado */
  adAccountConfigured: boolean;
  /** null = sin verificar; true/false según última prueba Meta */
  adsReadConfirmed: boolean | null;
  lastMetaError?: string;
  lastMetaErrorCode?: string;
  lastCheckedAt?: string;
  permissionSuggestion?: string;
  missingVariables: string[];
  optionalMissing?: string[];
}

const REQUIRED_FOR_READ = [
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
] as const;

const OPTIONAL = ["META_APP_ID", "META_APP_SECRET"] as const;

export function normalizeAdAccountId(raw?: string): string | null {
  if (!raw?.trim()) return null;
  const id = raw.trim().replace(/^act_/, "");
  return id ? `act_${id}` : null;
}

function maskAdAccountId(id: string): string {
  const num = id.replace(/^act_/, "");
  if (num.length <= 4) return id;
  return `act_***${num.slice(-4)}`;
}

export function getMissingMetaVariables(): string[] {
  const missing: string[] = [];
  if (!process.env.META_ACCESS_TOKEN?.trim()) missing.push("META_ACCESS_TOKEN");
  if (!normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID))
    missing.push("META_AD_ACCOUNT_ID");
  return missing;
}

export function isMetaCredentialsConfigured(): boolean {
  return getMissingMetaVariables().length === 0;
}

export function getMetaIntegrationStatus(
  connectionOk?: boolean,
  connectionError?: string
): MetaIntegrationStatus {
  const adsMode = getAdsMode();
  const missing = getMissingMetaVariables();
  const adAccountId = normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID);
  const runtime = getMetaApiRuntimeState();
  const hasAccessToken = !!process.env.META_ACCESS_TOKEN?.trim();
  const adAccountConfigured = !!adAccountId;
  const metaReadEnabled =
    adsMode === "read_only" && missing.length === 0;

  let status: MetaConfigStatus = "not_configured";
  let message = "Meta API no configurada.";

  if (missing.length > 0 && missing.length < REQUIRED_FOR_READ.length) {
    status = "partial";
    message = `Faltan variables: ${missing.join(", ")}`;
  } else if (missing.length === 0) {
    status = connectionOk === true ? "connected" : "configured";
    message =
      connectionOk === true
        ? "Conexión Meta verificada (solo lectura)."
        : "Credenciales presentes. Usá «Probar conexión» para validar.";
    if (connectionOk === false && connectionError) {
      status = "connection_failed";
      message = connectionError;
      if (runtime.lastMetaErrorCode === "META_PERMISSION_DENIED") {
        message = connectionError;
      }
    }
  } else {
    message = `Faltan credenciales: ${missing.join(", ")}`;
  }

  const adsReadConfirmed =
    connectionOk === true
      ? true
      : connectionOk === false && runtime.lastMetaErrorCode === "META_PERMISSION_DENIED"
        ? false
        : runtime.adsReadConfirmed;

  return {
    adsMode,
    metaReadEnabled,
    status,
    message,
    adAccountId: adAccountId ?? undefined,
    adAccountIdMasked: adAccountId ? maskAdAccountId(adAccountId) : undefined,
    hasAppId: !!process.env.META_APP_ID?.trim(),
    hasAppSecret: !!process.env.META_APP_SECRET?.trim(),
    hasAccessToken,
    tokenConfigured: hasAccessToken,
    adAccountConfigured,
    adsReadConfirmed,
    lastMetaError: runtime.lastMetaError ?? (connectionOk === false ? connectionError : undefined),
    lastMetaErrorCode: runtime.lastMetaErrorCode,
    lastCheckedAt: runtime.lastCheckedAt,
    permissionSuggestion:
      runtime.lastMetaErrorCode === "META_PERMISSION_DENIED" ||
      adsReadConfirmed === false
        ? META_ADS_READ_PERMISSION_SUGGESTION
        : undefined,
    missingVariables: missing,
    optionalMissing: OPTIONAL.filter((k) => !process.env[k]?.trim()),
  };
}
