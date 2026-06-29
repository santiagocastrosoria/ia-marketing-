import type { CampaignMetrics, CampaignPlan } from "@/lib/types/marketing";
import {
  canUseMetaInsights,
  isMockMode,
} from "@/lib/utils/config";
import { channelPlacementDisplayName } from "@/lib/ads/metaPlacements";

export interface PlacementMetricRow {
  platform: string;
  channel: string;
  placement: string;
  publisher_platform: string;
  platform_position: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  recommendation?: string;
}

export interface MetaInsightsResult {
  source: "mock" | "meta_api" | "stored";
  simulated: boolean;
  rows: PlacementMetricRow[];
  byPublisher: Record<string, PlacementMetricRow>;
  byInstagramPosition: Record<string, PlacementMetricRow>;
}

const INSTAGRAM_POSITIONS = ["stream", "story", "reels", "explore", "profile_feed"];

/** Perfiles mock por placement — reflejan comportamiento esperado en demo */
const MOCK_PROFILES: Record<
  string,
  { reach: number; ctr: number; leadRate: number; spendShare: number }
> = {
  "instagram:reels": { reach: 1.8, ctr: 0.9, leadRate: 0.04, spendShare: 0.28 },
  "instagram:story": { reach: 1.2, ctr: 1.6, leadRate: 0.06, spendShare: 0.22 },
  "instagram:stream": { reach: 1.0, ctr: 1.1, leadRate: 0.12, spendShare: 0.3 },
  "instagram:explore": { reach: 1.3, ctr: 0.8, leadRate: 0.05, spendShare: 0.1 },
  "facebook:feed": { reach: 0.7, ctr: 0.6, leadRate: 0.03, spendShare: 0.08 },
  "google:search": { reach: 0.4, ctr: 3.5, leadRate: 0.15, spendShare: 1 },
};

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

function buildMockRow(
  plan: CampaignPlan,
  publisher: string,
  position: string,
  dailyBudget: number
): PlacementMetricRow {
  const key = `${publisher}:${position}`;
  const profile = MOCK_PROFILES[key] ?? {
    reach: 1,
    ctr: 1,
    leadRate: 0.05,
    spendShare: 0.2,
  };
  const jitter = 0.85 + seedFromId(`${plan.id}-${key}`) * 0.3;
  const spend = Math.round(dailyBudget * profile.spendShare * 14 * jitter);
  const impressions = Math.floor(spend * 18 * profile.reach * jitter);
  const ctr = profile.ctr * jitter;
  const clicks = Math.max(1, Math.floor(impressions * (ctr / 100)));
  const leads = Math.max(
    publisher === "google" ? 1 : 0,
    Math.floor(clicks * profile.leadRate * jitter)
  );
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const { channel, placement } = channelPlacementDisplayName(publisher, position);

  return {
    platform: plan.platform,
    channel,
    placement,
    publisher_platform: publisher,
    platform_position: position,
    spend,
    impressions,
    clicks,
    leads,
    ctr: Math.round(ctr * 100) / 100,
    cpc: Math.round(cpc * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    cpl: Math.round(cpl * 100) / 100,
    recommendation: mockRecommendation(publisher, position, leads, spend, cpl),
  };
}

function mockRecommendation(
  publisher: string,
  position: string,
  leads: number,
  spend: number,
  cpl: number
): string {
  if (leads === 0 && spend > 15000) {
    return "Pausar — consume presupuesto sin generar leads";
  }
  if (publisher === "instagram" && position === "reels") {
    return leads > 2
      ? "Buen alcance — considerar aumentar presupuesto (requiere aprobación)"
      : "Mantener para awareness visual";
  }
  if (publisher === "instagram" && position === "story") {
    return "CTR fuerte — ideal para engagement y consultas rápidas";
  }
  if (publisher === "instagram" && position === "stream") {
    return leads > 3
      ? "Mejor conversión a WhatsApp — escalar con aprobación"
      : "Priorizar para leads WhatsApp";
  }
  if (publisher === "facebook") {
    return "Rol de apoyo — mantener presupuesto bajo";
  }
  if (publisher === "google") {
    return "Menor volumen, mayor intención — mantener para búsquedas premium";
  }
  if (cpl > 0 && cpl < 8000) {
    return "Rendimiento sólido — evaluar aumento de presupuesto (requiere aprobación)";
  }
  return "Monitorear 7 días más";
}

export async function fetchMetaPlacementInsights(
  plan: CampaignPlan,
  dateRange?: { since: string; until: string }
): Promise<MetaInsightsResult> {
  if (isMockMode() || !canUseMetaInsights()) {
    return buildSimulatedPlacementInsights(plan);
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const campaignId = plan.platform_campaign_id;

  if (!accessToken || !campaignId) {
    return buildSimulatedPlacementInsights(plan);
  }

  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: "spend,impressions,clicks,actions",
      breakdowns: "publisher_platform,platform_position",
      time_range: JSON.stringify(
        dateRange ?? {
          since: new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
          until: new Date().toISOString().split("T")[0],
        }
      ),
    });

    const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      return buildSimulatedPlacementInsights(plan);
    }

    const json = (await res.json()) as {
      data?: Array<{
        publisher_platform?: string;
        platform_position?: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        actions?: Array<{ action_type: string; value: string }>;
      }>;
    };

    const rows: PlacementMetricRow[] = (json.data ?? []).map((row) => {
      const spend = parseFloat(row.spend ?? "0");
      const impressions = parseInt(row.impressions ?? "0", 10);
      const clicks = parseInt(row.clicks ?? "0", 10);
      const leads =
        row.actions?.find((a) => a.action_type === "lead")?.value ?? "0";
      const leadCount = parseInt(leads, 10);
      const publisher = row.publisher_platform ?? "unknown";
      const position = row.platform_position ?? "unknown";
      const { channel, placement } = channelPlacementDisplayName(
        publisher,
        position
      );

      return {
        platform: plan.platform,
        channel,
        placement,
        publisher_platform: publisher,
        platform_position: position,
        spend,
        impressions,
        clicks,
        leads: leadCount,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        cpl: leadCount > 0 ? spend / leadCount : 0,
      };
    });

    return aggregatePlacementRows(rows, "meta_api", false);
  } catch {
    return buildSimulatedPlacementInsights(plan);
  }
}

export function buildSimulatedPlacementInsights(
  plan: CampaignPlan
): MetaInsightsResult {
  const dailyBudget = plan.dailyBudget || 50000;
  const rows: PlacementMetricRow[] = [];

  if (plan.platform === "GOOGLE") {
    rows.push(buildMockRow(plan, "google", "search", dailyBudget));
    return aggregatePlacementRows(rows, "mock", true);
  }

  const igPositions =
    plan.instagramPositions?.length
      ? plan.instagramPositions
      : (["stream", "story", "reels"] as const);

  for (const pos of igPositions) {
    rows.push(buildMockRow(plan, "instagram", pos, dailyBudget));
  }

  if (
    plan.publisherPlatforms?.includes("facebook") ||
    plan.metaChannelPreference === "FACEBOOK_COMPLEMENT" ||
    plan.metaChannelPreference === "INSTAGRAM_PRIORITY" ||
    plan.metaChannelPreference === "META_FULL"
  ) {
    rows.push(buildMockRow(plan, "facebook", "feed", dailyBudget));
  }

  return aggregatePlacementRows(rows, "mock", true);
}

export function buildAllChannelMockInsights(
  campaigns: CampaignPlan[]
): PlacementMetricRow[] {
  const rows: PlacementMetricRow[] = [];
  for (const plan of campaigns) {
    rows.push(...buildSimulatedPlacementInsights(plan).rows);
  }
  return rows;
}

function aggregatePlacementRows(
  rows: PlacementMetricRow[],
  source: MetaInsightsResult["source"],
  simulated: boolean
): MetaInsightsResult {
  const byPublisher: Record<string, PlacementMetricRow> = {};
  const byInstagramPosition: Record<string, PlacementMetricRow> = {};

  for (const row of rows) {
    const pub = row.publisher_platform;
    if (!byPublisher[pub]) {
      byPublisher[pub] = emptyRow(pub, "all", row.platform, row.channel, "All");
    }
    mergeRow(byPublisher[pub], row);

    if (pub === "instagram" && INSTAGRAM_POSITIONS.includes(row.platform_position)) {
      const key = row.platform_position;
      if (!byInstagramPosition[key]) {
        const { channel, placement } = channelPlacementDisplayName("instagram", key);
        byInstagramPosition[key] = emptyRow(
          "instagram",
          key,
          row.platform,
          channel,
          placement
        );
      }
      mergeRow(byInstagramPosition[key], row);
    }
  }

  recalcRates(byPublisher);
  recalcRates(byInstagramPosition);

  return { source, simulated, rows, byPublisher, byInstagramPosition };
}

function emptyRow(
  publisher_platform: string,
  platform_position: string,
  platform: string,
  channel: string,
  placement: string
): PlacementMetricRow {
  return {
    platform,
    channel,
    placement,
    publisher_platform,
    platform_position,
    spend: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    cpl: 0,
  };
}

function mergeRow(target: PlacementMetricRow, source: PlacementMetricRow) {
  target.spend += source.spend;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
  target.leads += source.leads;
}

function recalcRates(map: Record<string, PlacementMetricRow>) {
  for (const row of Object.values(map)) {
    row.ctr =
      row.impressions > 0
        ? Math.round((row.clicks / row.impressions) * 10000) / 100
        : 0;
    row.cpc =
      row.clicks > 0 ? Math.round((row.spend / row.clicks) * 100) / 100 : 0;
    row.cpm =
      row.impressions > 0
        ? Math.round((row.spend / row.impressions) * 1000 * 100) / 100
        : 0;
    row.cpl =
      row.leads > 0 ? Math.round((row.spend / row.leads) * 100) / 100 : 0;
  }
}

export function extractPlacementBreakdown(
  metrics: CampaignMetrics[]
): MetaInsightsResult | null {
  const rows: PlacementMetricRow[] = [];

  for (const m of metrics) {
    const breakdown = m.raw_metrics_json?.placement_breakdown as
      | PlacementMetricRow[]
      | undefined;
    if (breakdown?.length) {
      rows.push(...breakdown);
    }
  }

  if (rows.length === 0) return null;
  return aggregatePlacementRows(rows, "stored", isMockMode());
}
