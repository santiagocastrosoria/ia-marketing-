import type { CampaignMetrics, CampaignPlan } from "@/lib/types/marketing";
import {
  canUseMetaInsights,
  isMockMode,
} from "@/lib/utils/config";

export interface PlacementMetricRow {
  publisher_platform: string;
  platform_position: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export interface MetaInsightsResult {
  source: "mock" | "meta_api" | "stored";
  simulated: boolean;
  rows: PlacementMetricRow[];
  byPublisher: Record<string, PlacementMetricRow>;
  byInstagramPosition: Record<string, PlacementMetricRow>;
}

const INSTAGRAM_POSITIONS = ["stream", "story", "reels", "explore", "profile_feed"];

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

      return {
        publisher_platform: row.publisher_platform ?? "unknown",
        platform_position: row.platform_position ?? "unknown",
        spend,
        impressions,
        clicks,
        leads: leadCount,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
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
  const igPositions =
    plan.instagramPositions?.length
      ? plan.instagramPositions
      : (["stream", "story", "reels"] as const);

  const rows: PlacementMetricRow[] = [];

  for (const pos of igPositions) {
    const spend = 20000 + Math.random() * 40000;
    const impressions = 1500 + Math.random() * 3500;
    const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.025));
    const leads = Math.floor(clicks * (0.03 + Math.random() * 0.1));

    rows.push({
      publisher_platform: "instagram",
      platform_position: pos,
      spend: Math.round(spend),
      impressions: Math.floor(impressions),
      clicks,
      leads,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
    });
  }

  if (
    plan.publisherPlatforms?.includes("facebook") ||
    plan.placementStrategy === "MANUAL_ALL_META" ||
    plan.metaChannelPreference === "META_FULL"
  ) {
    const spend = 8000 + Math.random() * 15000;
    const impressions = 800 + Math.random() * 2000;
    const clicks = Math.floor(impressions * (0.006 + Math.random() * 0.015));
    const leads = Math.floor(clicks * (0.02 + Math.random() * 0.06));

    rows.push({
      publisher_platform: "facebook",
      platform_position: "feed",
      spend: Math.round(spend),
      impressions: Math.floor(impressions),
      clicks,
      leads,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
    });
  }

  return aggregatePlacementRows(rows, "mock", true);
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
      byPublisher[pub] = emptyRow(pub, "all");
    }
    mergeRow(byPublisher[pub], row);

    if (pub === "instagram" && INSTAGRAM_POSITIONS.includes(row.platform_position)) {
      const key = row.platform_position;
      if (!byInstagramPosition[key]) {
        byInstagramPosition[key] = emptyRow("instagram", key);
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
  platform_position: string
): PlacementMetricRow {
  return {
    publisher_platform,
    platform_position,
    spend: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    ctr: 0,
    cpc: 0,
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
