import { DEMO_USER_ID } from "@/lib/constants/demoIds";

export type AdsMode = "mock" | "read_only" | "draft_only" | "live_approval";

function normalizeAdsMode(raw: string | undefined): AdsMode {
  const mode = (raw ?? "mock").trim().toLowerCase();
  if (mode === "live") return "live_approval";
  if (
    mode === "read_only" ||
    mode === "draft_only" ||
    mode === "live_approval" ||
    mode === "mock"
  ) {
    return mode;
  }
  return "mock";
}

export function getAdsMode(): AdsMode {
  return normalizeAdsMode(
    process.env.ADS_MODE ?? process.env.NEXT_PUBLIC_ADS_MODE
  );
}

export function isMockMode(): boolean {
  return getAdsMode() === "mock";
}

export function isReadOnlyMode(): boolean {
  return getAdsMode() === "read_only";
}

export function isDraftOnlyMode(): boolean {
  return getAdsMode() === "draft_only";
}

export function isLiveApprovalMode(): boolean {
  return getAdsMode() === "live_approval";
}

/** @deprecated usar isLiveApprovalMode */
export function isLiveMode(): boolean {
  return isLiveApprovalMode();
}

/** Insights reales desde Meta API (read_only con credenciales) */
export function canUseMetaInsights(): boolean {
  if (isMockMode()) return false;
  if (!isReadOnlyMode()) return false;
  return !!(
    process.env.META_ACCESS_TOKEN?.trim() &&
    process.env.META_AD_ACCOUNT_ID?.trim()
  );
}

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Permite DEMO_USER_ID solo en desarrollo cuando ENABLE_DEMO_USER=true */
export function isDemoUserEnabled(): boolean {
  return process.env.ENABLE_DEMO_USER === "true" && !isProduction();
}

/** Herramientas de desarrollo (cleanup legacy, etc.) */
export function isDevToolsEnabled(): boolean {
  return !isProduction() || process.env.ALLOW_DEV_TOOLS === "true";
}

/** @deprecated Usar getUserId() en rutas API o getDemoUserId() desde @/lib/auth/getUserId */
export function getDemoUserId(): string {
  return process.env.DEMO_USER_ID ?? DEMO_USER_ID;
}
