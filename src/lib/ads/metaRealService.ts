/**
 * Meta Marketing API — solo lectura (GET).
 * Usar únicamente con ADS_MODE=read_only y credenciales en servidor.
 */
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";
import {
  getMissingMetaVariables,
  isMetaCredentialsConfigured,
  normalizeAdAccountId,
} from "@/lib/ads/metaConfig";
import { channelPlacementDisplayName } from "@/lib/ads/metaPlacements";
import {
  isMetaPermissionDenied,
  META_ADS_READ_PERMISSION_MESSAGE,
  recordMetaApiError,
  recordMetaApiSuccess,
} from "@/lib/ads/metaApiState";
import { isReadOnlyMode } from "@/lib/utils/config";

const META_API_VERSION = "v21.0";
const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

export class MetaConfigError extends Error {
  readonly code = "META_NOT_CONFIGURED" as const;

  constructor(message: string) {
    super(message);
    this.name = "MetaConfigError";
  }
}

export class MetaApiError extends Error {
  readonly code = "META_CONNECTION_FAILED" as const;

  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export class MetaPermissionError extends Error {
  readonly code = "META_PERMISSION_DENIED" as const;

  constructor(
    message: string = META_ADS_READ_PERMISSION_MESSAGE,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MetaPermissionError";
  }
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
}

export interface MetaRealCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
  source: "meta_api";
  readOnly: true;
}

export interface MetaRealAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id?: string;
  daily_budget?: string;
  optimization_goal?: string;
  source: "meta_api";
  readOnly: true;
}

export interface MetaRealAd {
  id: string;
  name: string;
  status: string;
  adset_id?: string;
  campaign_id?: string;
  source: "meta_api";
  readOnly: true;
}

export interface MetaInsightRow {
  channel: string;
  placement: string;
  publisher_platform?: string;
  platform_position?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  conversions: number;
  date_start: string;
  date_stop: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
}

export interface MetaInsightsParams {
  level?: "account" | "campaign" | "adset" | "ad";
  objectId?: string;
  datePreset?: string;
  since?: string;
  until?: string;
  breakdowns?: string[];
  campaignId?: string;
}

function requireReadOnlyMeta(): void {
  if (!isReadOnlyMode()) {
    throw new MetaConfigError(
      "Meta API real solo disponible con ADS_MODE=read_only."
    );
  }
  const missing = getMissingMetaVariables();
  if (missing.length > 0) {
    throw new MetaConfigError(
      `Faltan variables de entorno: ${missing.join(", ")}`
    );
  }
}

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new MetaConfigError("META_ACCESS_TOKEN no configurado");
  return token;
}

function getAdAccountId(): string {
  const id = normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID);
  if (!id) throw new MetaConfigError("META_AD_ACCOUNT_ID no configurado");
  return id;
}

async function metaGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const accessToken = getAccessToken();
  const url = new URL(
    path.startsWith("http") ? path : `${META_GRAPH}${path.startsWith("/") ? path : `/${path}`}`
  );
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const json = (await res.json()) as T & {
    error?: { message?: string; type?: string; code?: number };
  };

  if (!res.ok || json.error) {
    const errMessage = json.error?.message ?? `Meta API HTTP ${res.status}`;
    if (isMetaPermissionDenied(json.error)) {
      recordMetaApiError(META_ADS_READ_PERMISSION_MESSAGE, "META_PERMISSION_DENIED", true);
      throw new MetaPermissionError(META_ADS_READ_PERMISSION_MESSAGE, json.error);
    }
    recordMetaApiError(errMessage, "META_CONNECTION_FAILED", false);
    throw new MetaApiError(errMessage, json.error);
  }

  recordMetaApiSuccess();
  return json;
}

function parseActionCount(
  actions: Array<{ action_type: string; value: string }> | undefined,
  types: string[]
): number {
  if (!actions?.length) return 0;
  let total = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) {
      total += parseInt(a.value, 10) || 0;
    }
  }
  return total;
}

function mapInsightRow(
  row: Record<string, string | undefined> & {
    actions?: Array<{ action_type: string; value: string }>;
  }
): MetaInsightRow {
  const publisher = row.publisher_platform ?? "unknown";
  const position = row.platform_position ?? "unknown";
  const { channel, placement } = channelPlacementDisplayName(publisher, position);

  const spend = parseFloat(row.spend ?? "0");
  const impressions = parseInt(row.impressions ?? "0", 10);
  const reach = parseInt(row.reach ?? "0", 10);
  const clicks = parseInt(row.clicks ?? "0", 10);
  const ctr = parseFloat(row.ctr ?? "0");
  const cpc = parseFloat(row.cpc ?? "0");
  const cpm = parseFloat(row.cpm ?? "0");
  const leads = parseActionCount(row.actions, [
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
  ]);
  const conversions = parseActionCount(row.actions, [
    "purchase",
    "complete_registration",
    "onsite_conversion.messaging_conversation_started_7d",
  ]);

  return {
    channel,
    placement,
    publisher_platform: publisher,
    platform_position: position,
    spend,
    impressions,
    reach,
    clicks,
    ctr,
    cpc,
    cpm,
    leads,
    conversions,
    date_start: row.date_start ?? "",
    date_stop: row.date_stop ?? "",
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    adset_id: row.adset_id,
    ad_id: row.ad_id,
  };
}

export async function testMetaConnection(): Promise<{
  ok: boolean;
  user?: { id: string; name?: string };
  adAccount?: MetaAdAccount;
}> {
  assertReadOnlyModeAllows("TEST_CONNECTION");
  requireReadOnlyMeta();

  const me = await metaGet<{ id: string; name?: string }>("/me", {
    fields: "id,name",
  });

  const adAccount = await getMetaAdAccount();

  return { ok: true, user: me, adAccount };
}

export async function getMetaAdAccount(): Promise<MetaAdAccount> {
  assertReadOnlyModeAllows("READ_ACCOUNT");
  requireReadOnlyMeta();

  const accountId = getAdAccountId();
  const data = await metaGet<MetaAdAccount>(`/${accountId}`, {
    fields: "id,name,account_status,currency,timezone_name",
  });

  return data;
}

export async function listMetaCampaigns(params?: {
  limit?: number;
}): Promise<MetaRealCampaign[]> {
  assertReadOnlyModeAllows("READ_CAMPAIGNS");
  requireReadOnlyMeta();

  const accountId = getAdAccountId();
  const data = await metaGet<{
    data?: Array<Record<string, string>>;
  }>(`/${accountId}/campaigns`, {
    fields:
      "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time",
    limit: String(params?.limit ?? 50),
  });

  return (data.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    daily_budget: c.daily_budget,
    lifetime_budget: c.lifetime_budget,
    created_time: c.created_time,
    updated_time: c.updated_time,
    source: "meta_api" as const,
    readOnly: true as const,
  }));
}

export async function listMetaAdSets(params?: {
  campaignId?: string;
  limit?: number;
}): Promise<MetaRealAdSet[]> {
  assertReadOnlyModeAllows("READ_ADSETS");
  requireReadOnlyMeta();

  const accountId = getAdAccountId();
  const path = params?.campaignId
    ? `/${params.campaignId}/adsets`
    : `/${accountId}/adsets`;

  const data = await metaGet<{ data?: Array<Record<string, string>> }>(path, {
    fields: "id,name,status,campaign_id,daily_budget,optimization_goal",
    limit: String(params?.limit ?? 50),
  });

  return (data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    campaign_id: a.campaign_id,
    daily_budget: a.daily_budget,
    optimization_goal: a.optimization_goal,
    source: "meta_api" as const,
    readOnly: true as const,
  }));
}

export async function listMetaAds(params?: {
  adSetId?: string;
  campaignId?: string;
  limit?: number;
}): Promise<MetaRealAd[]> {
  assertReadOnlyModeAllows("READ_ADS");
  requireReadOnlyMeta();

  const accountId = getAdAccountId();
  let path = `/${accountId}/ads`;
  if (params?.adSetId) path = `/${params.adSetId}/ads`;
  else if (params?.campaignId) path = `/${params.campaignId}/ads`;

  const data = await metaGet<{ data?: Array<Record<string, string>> }>(path, {
    fields: "id,name,status,adset_id,campaign_id",
    limit: String(params?.limit ?? 50),
  });

  return (data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    adset_id: a.adset_id,
    campaign_id: a.campaign_id,
    source: "meta_api" as const,
    readOnly: true as const,
  }));
}

export async function getMetaInsights(
  params: MetaInsightsParams = {}
): Promise<{ rows: MetaInsightRow[]; rawCount: number }> {
  assertReadOnlyModeAllows("READ_INSIGHTS");
  requireReadOnlyMeta();

  const accountId = getAdAccountId();
  const level = params.level ?? "account";
  let objectId = params.objectId ?? accountId;

  if (params.campaignId) objectId = params.campaignId;

  const fields = [
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "actions",
    "campaign_id",
    "campaign_name",
    "adset_id",
    "ad_id",
    "date_start",
    "date_stop",
  ].join(",");

  const query: Record<string, string> = {
    fields,
    level,
  };

  const breakdowns =
    params.breakdowns ??
    (level === "account" ? ["publisher_platform", "platform_position"] : undefined);

  if (breakdowns?.length) {
    query.breakdowns = breakdowns.join(",");
  }

  if (params.datePreset) {
    query.date_preset = params.datePreset;
  } else if (params.since && params.until) {
    query.time_range = JSON.stringify({ since: params.since, until: params.until });
  } else {
    query.date_preset = "last_30d";
  }

  const data = await metaGet<{
    data?: Array<Record<string, string> & { actions?: Array<{ action_type: string; value: string }> }>;
  }>(`/${objectId}/insights`, query);

  const rows = (data.data ?? []).map((row) => mapInsightRow(row));

  return { rows, rawCount: rows.length };
}

export function canUseMetaRealApi(): boolean {
  return isReadOnlyMode() && isMetaCredentialsConfigured();
}
