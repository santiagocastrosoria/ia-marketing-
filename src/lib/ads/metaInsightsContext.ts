import type { MetaInsightsSnapshot } from "@/lib/types/campaignBlueprint";
import { canUseMetaRealApi } from "@/lib/ads/metaRealService";
import { listMetaCampaigns, getMetaInsights } from "@/lib/ads/metaRealService";
import { isReadOnlyMode } from "@/lib/utils/config";

export async function gatherMetaPerformanceContext(): Promise<MetaInsightsSnapshot> {
  const empty: MetaInsightsSnapshot = {
    used: false,
    campaignCount: 0,
    insightRowCount: 0,
    topPlacements: [],
    priorCampaignNames: [],
    note: isReadOnlyMode()
      ? "Meta read_only no configurado o sin datos históricos."
      : "Insights reales disponibles solo en ADS_MODE=read_only.",
  };

  if (!canUseMetaRealApi()) return empty;

  try {
    const campaigns = await listMetaCampaigns({ limit: 20 });
    const insights = await getMetaInsights({
      datePreset: "maximum",
      breakdowns: ["publisher_platform", "platform_position"],
    });

    const sorted = [...insights.rows].sort((a, b) => b.spend - a.spend);
    const topPlacements = sorted.slice(0, 6).map((r) => ({
      channel: r.channel,
      placement: r.placement,
      spend: r.spend,
      ctr: r.ctr,
      cpc: r.cpc,
      cpm: r.cpm,
    }));

    return {
      used: insights.rows.length > 0 || campaigns.length > 0,
      campaignCount: campaigns.length,
      insightRowCount: insights.rows.length,
      topPlacements,
      priorCampaignNames: campaigns.slice(0, 8).map((c) => c.name),
      note:
        insights.rows.length > 0
          ? "Insights históricos Meta incorporados a la propuesta."
          : "Campañas Meta visibles pero sin insights en el período máximo.",
    };
  } catch {
    return {
      ...empty,
      note: "No se pudieron leer insights Meta (permisos o sin datos). Propuesta basada en brand knowledge.",
    };
  }
}
