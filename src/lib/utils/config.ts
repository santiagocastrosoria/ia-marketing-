import { DEMO_USER_ID } from "@/lib/constants/demoIds";

export type AdsMode = "mock" | "read_only" | "live";

export function getAdsMode(): AdsMode {
  const mode =
    process.env.ADS_MODE ??
    process.env.NEXT_PUBLIC_ADS_MODE ??
    "mock";
  if (mode === "live") return "live";
  if (mode === "read_only") return "read_only";
  return "mock";
}

export function isMockMode(): boolean {
  return getAdsMode() === "mock";
}

export function isReadOnlyMode(): boolean {
  return getAdsMode() === "read_only";
}

export function isLiveMode(): boolean {
  return getAdsMode() === "live";
}

/** Insights reales desde Meta API (read_only o live) si hay credenciales */
export function canUseMetaInsights(): boolean {
  const mode = getAdsMode();
  if (mode === "mock") return false;
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
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

/** @deprecated Usar getUserId() en rutas API o getDemoUserId() desde @/lib/auth/getUserId */
export function getDemoUserId(): string {
  return process.env.DEMO_USER_ID ?? DEMO_USER_ID;
}
