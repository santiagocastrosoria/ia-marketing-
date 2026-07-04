/**
 * Diagnóstico Meta read_only — solo GET, sin modificar datos.
 */
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";
import { normalizeAdAccountId } from "@/lib/ads/metaConfig";
import { isReadOnlyMode } from "@/lib/utils/config";

const META_API_VERSION = "v21.0";
const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaDebugStepResult {
  step: string;
  label: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  errorCode?: number;
  errorType?: string;
  httpStatus?: number;
}

export interface MetaDebugTokenInfo {
  available: boolean;
  app_id?: string;
  type?: string;
  expires_at?: number;
  expires_at_iso?: string;
  is_valid?: boolean;
  scopes: string[];
  user_id?: string;
  error?: string;
}

export interface MetaDebugVisibleAccount {
  id: string;
  name: string;
  account_status?: number;
}

export interface MetaDebugPermissionsReport {
  readOnly: true;
  configuredAppId?: string;
  configuredAdAccountId?: string;
  configuredAdAccountMasked?: string;
  tokenDebug: MetaDebugTokenInfo;
  tokenValid: boolean;
  scopesDetected: string[];
  hasAdsReadScope: boolean;
  visibleAdAccounts: MetaDebugVisibleAccount[];
  configuredAccountInList: boolean;
  steps: MetaDebugStepResult[];
  recommendations: string[];
  primaryRecommendation?: string;
}

interface MetaGraphError {
  message?: string;
  type?: string;
  code?: number;
}

interface SafeGetResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: MetaGraphError;
}

function maskAdAccountId(id: string): string {
  const num = id.replace(/^act_/, "");
  if (num.length <= 4) return id;
  return `act_***${num.slice(-4)}`;
}

function normalizeAccountIdForCompare(id: string): string {
  return id.replace(/^act_/, "");
}

function getAccessToken(): string | null {
  return process.env.META_ACCESS_TOKEN?.trim() ?? null;
}

function extractScopes(debugData: Record<string, unknown>): string[] {
  const scopes = new Set<string>();
  const rawScopes = debugData.scopes;
  if (Array.isArray(rawScopes)) {
    for (const s of rawScopes) {
      if (typeof s === "string") scopes.add(s);
    }
  }
  const granular = debugData.granular_scopes;
  if (Array.isArray(granular)) {
    for (const item of granular) {
      if (item && typeof item === "object" && "scope" in item) {
        const scope = (item as { scope?: string }).scope;
        if (scope) scopes.add(scope);
      }
    }
  }
  return [...scopes];
}

function hasAdsReadInScopes(scopes: string[]): boolean {
  return scopes.some(
    (s) => s === "ads_read" || s === "ads_management" || s.includes("ads_read")
  );
}

async function safeMetaGet(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<SafeGetResult> {
  const url = new URL(
    path.startsWith("http") ? path : `${META_GRAPH}${path.startsWith("/") ? path : `/${path}`}`
  );
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const json = (await res.json()) as Record<string, unknown> & { error?: MetaGraphError };
    if (!res.ok || json.error) {
      return {
        ok: false,
        status: res.status,
        error: json.error ?? { message: `HTTP ${res.status}` },
      };
    }
    return { ok: true, status: res.status, data: json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: { message: e instanceof Error ? e.message : "Error de red" },
    };
  }
}

function stepFromResult(
  step: string,
  label: string,
  result: SafeGetResult,
  skipped = false
): MetaDebugStepResult {
  if (skipped) {
    return { step, label, ok: false, skipped: true, error: "Omitido — faltan credenciales" };
  }
  if (result.ok) {
    return { step, label, ok: true, httpStatus: result.status };
  }
  return {
    step,
    label,
    ok: false,
    httpStatus: result.status,
    error: result.error?.message ?? "Error desconocido",
    errorCode: result.error?.code,
    errorType: result.error?.type,
  };
}

async function debugToken(accessToken: string): Promise<MetaDebugTokenInfo> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  let debugAccessToken: string | null = null;
  if (appId && appSecret) {
    debugAccessToken = `${appId}|${appSecret}`;
  } else {
    debugAccessToken = accessToken;
  }

  const url = new URL(`${META_GRAPH}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", debugAccessToken);

  try {
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const json = (await res.json()) as {
      data?: Record<string, unknown>;
      error?: MetaGraphError;
    };

    if (!res.ok || json.error || !json.data) {
      return {
        available: false,
        scopes: [],
        error:
          json.error?.message ??
          (!appId || !appSecret
            ? "No se pudo depurar el token. Configurá META_APP_ID y META_APP_SECRET para diagnóstico completo."
            : "No se pudo depurar el token."),
      };
    }

    const data = json.data;
    const scopes = extractScopes(data);
    const expiresAt =
      typeof data.expires_at === "number" ? data.expires_at : undefined;

    return {
      available: true,
      app_id: typeof data.app_id === "string" ? data.app_id : String(data.app_id ?? ""),
      type: typeof data.type === "string" ? data.type : undefined,
      expires_at: expiresAt,
      expires_at_iso:
        expiresAt && expiresAt > 0
          ? new Date(expiresAt * 1000).toISOString()
          : expiresAt === 0
            ? "No expira"
            : undefined,
      is_valid: data.is_valid === true,
      scopes,
      user_id:
        typeof data.user_id === "string"
          ? data.user_id
          : data.user_id !== undefined
            ? String(data.user_id)
            : undefined,
    };
  } catch (e) {
    return {
      available: false,
      scopes: [],
      error: e instanceof Error ? e.message : "Error al depurar token",
    };
  }
}

function buildRecommendations(input: {
  envAppId?: string;
  tokenDebug: MetaDebugTokenInfo;
  hasAdsReadScope: boolean;
  configuredAdAccountId?: string;
  configuredAccountInList: boolean;
  steps: MetaDebugStepResult[];
}): string[] {
  const recs: string[] = [];

  if (
    input.envAppId &&
    input.tokenDebug.app_id &&
    input.envAppId !== input.tokenDebug.app_id
  ) {
    recs.push(
      "d) La app_id del token no coincide con META_APP_ID — generaste el token desde la app equivocada."
    );
  }

  if (input.tokenDebug.available && !input.hasAdsReadScope) {
    recs.push(
      "a) Falta ads_read en los scopes del token — regenerá el token con permiso ads_read (System User en Business Settings)."
    );
  }

  if (
    input.hasAdsReadScope &&
    input.configuredAdAccountId &&
    !input.configuredAccountInList
  ) {
    recs.push(
      "b) ads_read existe pero la cuenta no aparece en /me/adaccounts — asigná la cuenta publicitaria al System User en Business Settings → Activos."
    );
  }

  const insightsStep = input.steps.find((s) => s.step === "insights");
  const accountDirectOk = input.steps.find((s) => s.step === "adaccount_direct")?.ok;

  if (
    input.configuredAccountInList &&
    accountDirectOk &&
    insightsStep &&
    !insightsStep.ok &&
    !insightsStep.skipped
  ) {
    recs.push(
      "c) La cuenta aparece pero insights falla — revisá permiso «Ver rendimiento» / «Administrar campañas» en Activos de la cuenta publicitaria."
    );
  }

  if (input.tokenDebug.available && input.tokenDebug.is_valid === false) {
    recs.push("El token no es válido o expiró — generá un token nuevo para el System User.");
  }

  if (recs.length === 0) {
    const allOk = input.steps.filter((s) => !s.skipped).every((s) => s.ok);
    if (allOk) {
      recs.push("Todas las lecturas de diagnóstico pasaron. La integración Meta debería funcionar.");
    } else {
      recs.push(
        "Revisá los errores exactos de cada paso y los scopes del token en Business Settings."
      );
    }
  }

  return recs;
}

export async function diagnoseMetaPermissions(): Promise<MetaDebugPermissionsReport> {
  assertReadOnlyModeAllows("DEBUG_PERMISSIONS");

  if (!isReadOnlyMode()) {
    throw new Error("Diagnóstico Meta solo disponible con ADS_MODE=read_only.");
  }

  const accessToken = getAccessToken();
  const configuredAppId = process.env.META_APP_ID?.trim();
  const configuredAdAccountId = normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID);
  const steps: MetaDebugStepResult[] = [];

  if (!accessToken) {
    return {
      readOnly: true,
      configuredAppId,
      configuredAdAccountId: configuredAdAccountId ?? undefined,
      tokenDebug: { available: false, scopes: [], error: "META_ACCESS_TOKEN no configurado" },
      tokenValid: false,
      scopesDetected: [],
      hasAdsReadScope: false,
      visibleAdAccounts: [],
      configuredAccountInList: false,
      steps: [
        {
          step: "token",
          label: "Debug del token",
          ok: false,
          skipped: true,
          error: "META_ACCESS_TOKEN no configurado",
        },
      ],
      recommendations: ["Configurá META_ACCESS_TOKEN en el servidor."],
      primaryRecommendation: "Configurá META_ACCESS_TOKEN en el servidor.",
    };
  }

  const tokenDebug = await debugToken(accessToken);
  steps.push(
    tokenDebug.available && tokenDebug.is_valid !== false
      ? { step: "debug_token", label: "Debug del token", ok: true }
      : {
          step: "debug_token",
          label: "Debug del token",
          ok: false,
          error: tokenDebug.error ?? "Token inválido o no depurable",
        }
  );

  const scopesDetected = tokenDebug.scopes;
  const hasAdsReadScope = hasAdsReadInScopes(scopesDetected);
  const tokenValid = tokenDebug.is_valid === true;

  const adAccountsResult = await safeMetaGet(
    "/me/adaccounts",
    { fields: "id,name,account_status", limit: "50" },
    accessToken
  );
  steps.push(
    stepFromResult("me_adaccounts", "GET /me/adaccounts", adAccountsResult)
  );

  const visibleAdAccounts: MetaDebugVisibleAccount[] = [];
  const adAccountsData = adAccountsResult.data?.data;
  if (Array.isArray(adAccountsData)) {
    for (const item of adAccountsData) {
      if (item && typeof item === "object" && "id" in item) {
        const row = item as { id: string; name?: string; account_status?: number };
        visibleAdAccounts.push({
          id: row.id,
          name: row.name ?? row.id,
          account_status: row.account_status,
        });
      }
    }
  }

  const configuredAccountInList = configuredAdAccountId
    ? visibleAdAccounts.some(
        (a) =>
          normalizeAccountIdForCompare(a.id) ===
          normalizeAccountIdForCompare(configuredAdAccountId)
      )
    : false;

  if (configuredAdAccountId) {
    const directResult = await safeMetaGet(
      `/${configuredAdAccountId}`,
      { fields: "id,name,account_status" },
      accessToken
    );
    steps.push(
      stepFromResult(
        "adaccount_direct",
        `GET /${maskAdAccountId(configuredAdAccountId)}`,
        directResult
      )
    );

    const campaignsResult = await safeMetaGet(
      `/${configuredAdAccountId}/campaigns`,
      { fields: "id,name,status", limit: "1" },
      accessToken
    );
    steps.push(
      stepFromResult(
        "campaigns",
        `GET /${maskAdAccountId(configuredAdAccountId)}/campaigns?limit=1`,
        campaignsResult
      )
    );

    const insightsResult = await safeMetaGet(
      `/${configuredAdAccountId}/insights`,
      { date_preset: "last_30d", limit: "1", fields: "spend,impressions" },
      accessToken
    );
    steps.push(
      stepFromResult(
        "insights",
        `GET /${maskAdAccountId(configuredAdAccountId)}/insights?date_preset=last_30d&limit=1`,
        insightsResult
      )
    );
  } else {
    steps.push(
      {
        step: "adaccount_direct",
        label: "GET /{ad_account}",
        ok: false,
        skipped: true,
        error: "META_AD_ACCOUNT_ID no configurado",
      },
      {
        step: "campaigns",
        label: "GET /{ad_account}/campaigns",
        ok: false,
        skipped: true,
        error: "META_AD_ACCOUNT_ID no configurado",
      },
      {
        step: "insights",
        label: "GET /{ad_account}/insights",
        ok: false,
        skipped: true,
        error: "META_AD_ACCOUNT_ID no configurado",
      }
    );
  }

  const recommendations = buildRecommendations({
    envAppId: configuredAppId,
    tokenDebug,
    hasAdsReadScope,
    configuredAdAccountId: configuredAdAccountId ?? undefined,
    configuredAccountInList,
    steps,
  });

  return {
    readOnly: true,
    configuredAppId,
    configuredAdAccountId: configuredAdAccountId ?? undefined,
    configuredAdAccountMasked: configuredAdAccountId
      ? maskAdAccountId(configuredAdAccountId)
      : undefined,
    tokenDebug,
    tokenValid,
    scopesDetected,
    hasAdsReadScope,
    visibleAdAccounts,
    configuredAccountInList,
    steps,
    recommendations,
    primaryRecommendation: recommendations[0],
  };
}
