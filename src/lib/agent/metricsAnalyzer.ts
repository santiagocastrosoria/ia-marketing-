import type {
  CampaignMetrics,
  CampaignPlan,
  MetricsAnalysis,
  Recommendation,
  AggregatedPlacementRow,
} from "@/lib/types/marketing";
import { formatARS } from "@/lib/utils/formatARS";
import {
  buildSimulatedPlacementInsights,
  extractPlacementBreakdown,
  type MetaInsightsResult,
} from "@/lib/ads/metaInsightsService";
import { instagramPositionLabel } from "@/lib/ads/metaPlacements";
import type { InstagramPosition } from "@/lib/types/marketing";
import { isMockMode } from "@/lib/utils/config";

const MIN_DATA_DAYS = 3;
const MIN_IMPRESSIONS = 1000;

export function analyzeMetrics(
  metrics: CampaignMetrics[],
  campaign?: CampaignPlan
): MetricsAnalysis {
  if (metrics.length < MIN_DATA_DAYS) {
    return {
      summary:
        "Datos insuficientes para tomar decisiones. Se recomienda esperar al menos 3 días de datos.",
      insights: [
        {
          metric: "Volumen de datos",
          diagnosis: `Solo ${metrics.length} día(s) de datos disponibles.`,
          severity: "LOW",
        },
      ],
      recommendations: [],
    };
  }

  const totals = aggregateMetrics(metrics);
  const insights: MetricsAnalysis["insights"] = [];
  const recommendations: MetricsAnalysis["recommendations"] = [];

  if (totals.ctr < 0.8) {
    insights.push({
      metric: "CTR",
      diagnosis: `CTR bajo (${totals.ctr.toFixed(2)}%). Problema probable de creatividad, copy o segmentación.`,
      severity: "MEDIUM",
    });
    recommendations.push({
      type: "NEW_COPY_VARIANT",
      title: "Crear nueva variante de copy",
      description: "El CTR indica que los anuncios no están resonando con la audiencia.",
      reason: `CTR promedio de ${totals.ctr.toFixed(2)}% por debajo del umbral de 0.8%.`,
      supporting_metrics_json: { ctr: totals.ctr },
      expected_impact: "MEDIUM",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (totals.cpc > 2 && totals.ctr < 1.5) {
    insights.push({
      metric: "CPC + CTR",
      diagnosis: `CPC alto (${formatARS(totals.cpc)}) con CTR bajo. Anuncio poco relevante o público incorrecto.`,
      severity: "HIGH",
    });
    recommendations.push({
      type: "CHANGE_AUDIENCE",
      title: "Revisar segmentación de audiencia",
      description: "Combinación de CPC alto y CTR bajo sugiere targeting incorrecto.",
      reason: `CPC ${formatARS(totals.cpc)}, CTR ${totals.ctr.toFixed(2)}%.`,
      supporting_metrics_json: { cpc: totals.cpc, ctr: totals.ctr },
      expected_impact: "HIGH",
      risk_level: "MEDIUM",
      requires_approval: false,
    });
  }

  if (totals.clicks > 50 && totals.leads < 3) {
    insights.push({
      metric: "Clics sin leads",
      diagnosis: "Muchos clics pero pocos leads. Problema probable en landing, WhatsApp u oferta.",
      severity: "HIGH",
    });
    recommendations.push({
      type: "IMPROVE_LANDING",
      title: "Mejorar landing page o flujo WhatsApp",
      description: "El tráfico llega pero no convierte.",
      reason: `${totals.clicks} clics con solo ${totals.leads} leads.`,
      supporting_metrics_json: { clicks: totals.clicks, leads: totals.leads },
      expected_impact: "HIGH",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (totals.leads > 10 && totals.lead_quality_score < 5) {
    insights.push({
      metric: "Calidad de lead",
      diagnosis: "Muchos leads pero baja calidad. El copy no está filtrando correctamente.",
      severity: "MEDIUM",
    });
    recommendations.push({
      type: "FILTER_LEADS",
      title: "Mejorar mensaje filtrador premium",
      description: "Agregar términos como 'premium', 'a medida', 'proyectos exclusivos' al copy.",
      reason: `Calidad promedio ${totals.lead_quality_score.toFixed(1)}/10 con ${totals.leads} leads.`,
      supporting_metrics_json: {
        lead_quality_score: totals.lead_quality_score,
        leads: totals.leads,
      },
      expected_impact: "HIGH",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (totals.cpl > 50 && totals.lead_quality_score >= 7) {
    insights.push({
      metric: "CPL alto, leads buenos",
      diagnosis: `CPL de ${formatARS(totals.cpl)} pero leads de calidad. Puede valer la pena en producto premium.`,
      severity: "LOW",
    });
  }

  if (
    campaign?.funnelStage === "REMARKETING" &&
    totals.cpl < 30 &&
    totals.leads >= 5
  ) {
    insights.push({
      metric: "Remarketing performante",
      diagnosis: "Remarketing con buen CPL. Considerar aumento de presupuesto.",
      severity: "LOW",
    });
    recommendations.push({
      type: "CHANGE_BUDGET",
      title: "Aumentar presupuesto de remarketing",
      description: "La campaña de remarketing muestra buen rendimiento.",
      reason: `CPL ${formatARS(totals.cpl)} con ${totals.leads} leads.`,
      supporting_metrics_json: { cpl: totals.cpl, leads: totals.leads },
      expected_impact: "MEDIUM",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  if (totals.impressions < MIN_IMPRESSIONS) {
    insights.push({
      metric: "Impresiones",
      diagnosis: "Volumen de impresiones aún bajo para conclusiones definitivas.",
      severity: "LOW",
    });
  }

  const summary = insights.length > 0
    ? `Análisis de ${metrics.length} días: ${insights.length} hallazgo(s) identificado(s). Gasto total ${formatARS(totals.spend)}, ${totals.leads} leads, CPL ${formatARS(totals.cpl)}.`
    : `Rendimiento dentro de parámetros esperados. Gasto ${formatARS(totals.spend)}, CTR ${totals.ctr.toFixed(2)}%, ${totals.leads} leads.`;

  const placementInsights = buildPlacementInsights(metrics, campaign);

  const placementRecs =
    campaign && placementInsights
      ? analyzePlacementRecommendations(
          campaign,
          extractPlacementBreakdown(metrics) ??
            buildSimulatedPlacementInsights(campaign)
        )
      : [];

  return {
    summary,
    insights,
    recommendations: [...recommendations, ...placementRecs],
    placementInsights,
  };
}

function buildPlacementInsights(
  metrics: CampaignMetrics[],
  campaign?: CampaignPlan
): MetricsAnalysis["placementInsights"] | undefined {
  let breakdown: MetaInsightsResult | null = extractPlacementBreakdown(metrics);

  if (!breakdown && campaign) {
    breakdown = buildSimulatedPlacementInsights(campaign);
  }

  if (!breakdown) return undefined;

  const ig = breakdown.byPublisher.instagram;
  const fb = breakdown.byPublisher.facebook;
  const google = breakdown.byPublisher.google;
  const simulated = breakdown.simulated || isMockMode();

  let instagramVsFacebook: string | undefined;
  if (ig && fb) {
    instagramVsFacebook = `Instagram lidera conversión (CPL ${formatARS(ig.cpl)}) vs Facebook de apoyo (CPL ${formatARS(fb.cpl)}, CTR ${fb.ctr.toFixed(2)}%).`;
  } else if (ig) {
    instagramVsFacebook = `Instagram: CTR ${ig.ctr.toFixed(2)}%, ${ig.leads} leads, CPL ${formatARS(ig.cpl)}.`;
  }

  const reels = breakdown.byInstagramPosition.reels;
  const stories = breakdown.byInstagramPosition.story;
  const feed = breakdown.byInstagramPosition.stream;

  let reelsVsStoriesVsFeed: string | undefined;
  const parts: string[] = [];
  if (reels) {
    parts.push(
      `Reels: mejor alcance (${reels.impressions.toLocaleString("es-AR")} impr.), CTR ${reels.ctr.toFixed(2)}%`
    );
  }
  if (stories) {
    parts.push(`Stories: mejor CTR (${stories.ctr.toFixed(2)}%)`);
  }
  if (feed) {
    parts.push(
      `Feed: mejor conversión a WhatsApp (${feed.leads} leads, CPL ${formatARS(feed.cpl)})`
    );
  }
  if (parts.length) reelsVsStoriesVsFeed = parts.join(" · ");

  const channelInsights: string[] = [];
  if (reels) {
    channelInsights.push(
      "Instagram Reels tiene mejor alcance — ideal para calentamiento visual premium."
    );
  }
  if (stories) {
    channelInsights.push(
      "Instagram Stories tiene mejor CTR — útil para engagement y consultas rápidas."
    );
  }
  if (feed) {
    channelInsights.push(
      "Instagram Feed convierte mejor a WhatsApp — priorizar para leads calificados."
    );
  }
  if (fb) {
    channelInsights.push(
      "Facebook funciona como apoyo — mantener presupuesto complementario bajo."
    );
  }
  if (google) {
    channelInsights.push(
      `Google Search trae menor volumen (${google.clicks} clics) pero mayor intención (CTR ${google.ctr.toFixed(2)}%).`
    );
  }

  const topPlacement = Object.entries(breakdown.byInstagramPosition).sort(
    (a, b) => b[1].leads - a[1].leads
  )[0];

  return {
    simulated,
    instagramVsFacebook,
    reelsVsStoriesVsFeed,
    topPlacement: topPlacement
      ? `${instagramPositionLabel(topPlacement[0] as InstagramPosition)} (${topPlacement[1].leads} leads)`
      : undefined,
    channelInsights,
  };
}

export function analyzePlacementRecommendations(
  campaign: CampaignPlan,
  breakdown: MetaInsightsResult
): Omit<Recommendation, "id" | "campaign_plan_id" | "status" | "created_at">[] {
  const recs: Omit<
    Recommendation,
    "id" | "campaign_plan_id" | "status" | "created_at"
  >[] = [];

  for (const row of breakdown.rows) {
    if (row.leads === 0 && row.spend > 12000) {
      const isActiveCampaign = campaign.status === "ACTIVE";
      recs.push({
        type: "PAUSE_AD",
        title: `Pausar ${row.channel} ${row.placement}`,
        description: `${row.channel} ${row.placement} consume presupuesto sin generar leads.`,
        reason: `Gasto ${formatARS(row.spend)} con 0 leads en modo demo.`,
        supporting_metrics_json: {
          channel: row.channel,
          placement: row.placement,
          spend: row.spend,
        },
        expected_impact: "MEDIUM",
        risk_level: isActiveCampaign ? "MEDIUM" : "LOW",
        requires_approval: isActiveCampaign,
      });
    }

    if (
      row.leads >= 3 &&
      row.recommendation?.includes("aumentar presupuesto")
    ) {
      recs.push({
        type: "CHANGE_BUDGET",
        title: `Aumentar presupuesto en ${row.channel} ${row.placement}`,
        description: row.recommendation ?? "Placement con buen rendimiento.",
        reason: `${row.leads} leads con CPL ${formatARS(row.cpl)}.`,
        supporting_metrics_json: {
          channel: row.channel,
          placement: row.placement,
          leads: row.leads,
          cpl: row.cpl,
        },
        expected_impact: "HIGH",
        risk_level: "MEDIUM",
        requires_approval: true,
      });
    }
  }

  if (
    campaign.platform === "META" &&
    campaign.primaryChannel === "INSTAGRAM" &&
    campaign.status === "PAUSED"
  ) {
    recs.push({
      type: "CREATE_WARMUP",
      title: "Activar campaña Instagram (requiere aprobación)",
      description:
        "La estrategia prioriza Instagram. Activar solo tras revisar creatividades premium.",
      reason: `Campaña ${campaign.campaignName} en DRAFT/PAUSED con foco Instagram.`,
      supporting_metrics_json: {
        primaryChannel: campaign.primaryChannel,
        placementStrategy: campaign.placementStrategy,
      },
      expected_impact: "HIGH",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  return recs;
}

export type MetricsAnalyzeScope = "campaign" | "objective" | "all";

export function analyzeAggregatedMetrics(
  campaigns: CampaignPlan[],
  allMetrics: CampaignMetrics[],
  aggregatedRows: AggregatedPlacementRow[],
  simulated: boolean
): MetricsAnalysis {
  const insights: MetricsAnalysis["insights"] = [];
  const recommendations: MetricsAnalysis["recommendations"] = [];

  const totals = aggregateMetrics(allMetrics);
  const summary = `Análisis agregado de ${campaigns.length} campaña(s): gasto ${formatARS(totals.spend)}, ${totals.leads} leads, CPL ${formatARS(totals.cpl)}.${simulated ? " (métricas simuladas)" : ""}`;

  const reels = aggregatedRows.find(
    (r) => r.channel === "Instagram" && r.placement === "Reels"
  );
  const stories = aggregatedRows.find(
    (r) => r.channel === "Instagram" && r.placement === "Stories"
  );
  const feed = aggregatedRows.find(
    (r) => r.channel === "Instagram" && r.placement === "Feed"
  );
  const fb = aggregatedRows.find((r) => r.channel === "Facebook");
  const google = aggregatedRows.find((r) => r.channel === "Google");

  const channelInsights: string[] = [];
  if (reels) {
    channelInsights.push(
      `Instagram Reels tiene mejor alcance (${reels.impressions.toLocaleString("es-AR")} impresiones agregadas).`
    );
  }
  if (stories) {
    channelInsights.push(
      `Instagram Stories tiene mejor CTR (${stories.ctr.toFixed(2)}% agregado).`
    );
  }
  if (feed) {
    channelInsights.push(
      `Instagram Feed convierte mejor a WhatsApp (${feed.leads} leads, CPL ${formatARS(feed.cpl)}).`
    );
  }
  if (fb) {
    channelInsights.push(
      "Facebook Feed funciona como apoyo — mantener presupuesto complementario bajo."
    );
  }
  if (google) {
    channelInsights.push(
      `Google Search tiene menor volumen (${google.clicks} clics) pero mayor intención (CTR ${google.ctr.toFixed(2)}%).`
    );
  }

  for (const insight of channelInsights) {
    insights.push({ metric: "Canal agregado", diagnosis: insight, severity: "LOW" });
  }

  for (const row of aggregatedRows) {
    if (row.leads === 0 && row.spend > 12000) {
      const hasActive = campaigns.some(
        (c) => row.campaignIds.includes(c.id) && c.status === "ACTIVE"
      );
      recommendations.push({
        type: "PAUSE_AD",
        title: `Pausar o reducir ${row.channel} ${row.placement}`,
        description: row.recommendation ?? "Placement sin leads con gasto significativo.",
        reason: `Gasto agregado ${formatARS(row.spend)} en ${row.campaignNames.length} campaña(s).`,
        supporting_metrics_json: {
          channel: row.channel,
          placement: row.placement,
          spend: row.spend,
          campaignIds: row.campaignIds,
        },
        expected_impact: "MEDIUM",
        risk_level: hasActive ? "MEDIUM" : "LOW",
        requires_approval: hasActive,
      });
    }

    if (
      row.recommendation?.includes("aumento") ||
      row.recommendation?.includes("escalar")
    ) {
      recommendations.push({
        type: "CHANGE_BUDGET",
        title: `Aumentar presupuesto en ${row.channel} ${row.placement}`,
        description: row.recommendation,
        reason: `${row.leads} leads agregados, CPL ${formatARS(row.cpl)}.`,
        supporting_metrics_json: {
          channel: row.channel,
          placement: row.placement,
          leads: row.leads,
          cpl: row.cpl,
          campaignIds: row.campaignIds,
        },
        expected_impact: "HIGH",
        risk_level: "MEDIUM",
        requires_approval: true,
      });
    }
  }

  const hasPausedInstagram = campaigns.some(
    (c) =>
      c.platform === "META" &&
      c.primaryChannel === "INSTAGRAM" &&
      (c.status === "PAUSED" || c.status === "DRAFT")
  );
  if (hasPausedInstagram) {
    recommendations.push({
      type: "CREATE_WARMUP",
      title: "Activar campaña(s) Instagram pausadas",
      description:
        "La estrategia prioriza Instagram. Activar solo tras revisar creatividades.",
      reason: `${campaigns.filter((c) => c.primaryChannel === "INSTAGRAM" && c.status === "PAUSED").length} campaña(s) Instagram en PAUSED.`,
      supporting_metrics_json: { scope: "aggregated", campaignCount: campaigns.length },
      expected_impact: "HIGH",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  const placementInsights: MetricsAnalysis["placementInsights"] = {
    simulated,
    aggregated: true,
    campaignCount: campaigns.length,
    channelInsights,
    reelsVsStoriesVsFeed: [reels, stories, feed]
      .filter(Boolean)
      .map((r) => `${r!.channel} ${r!.placement}: CTR ${r!.ctr.toFixed(2)}%`)
      .join(" · "),
  };

  return {
    summary,
    insights,
    recommendations,
    placementInsights,
    aggregatedPlacementRows: aggregatedRows,
  };
}

function aggregateMetrics(metrics: CampaignMetrics[]) {
  const n = metrics.length;
  return {
    spend: metrics.reduce((s, m) => s + m.spend, 0),
    impressions: metrics.reduce((s, m) => s + m.impressions, 0),
    clicks: metrics.reduce((s, m) => s + m.clicks, 0),
    leads: metrics.reduce((s, m) => s + m.leads, 0),
    cpc: metrics.reduce((s, m) => s + m.cpc, 0) / n,
    ctr: metrics.reduce((s, m) => s + m.ctr, 0) / n,
    cpl: metrics.reduce((s, m) => s + m.cpl, 0) / n,
    lead_quality_score:
      metrics.reduce((s, m) => s + m.lead_quality_score, 0) / n,
  };
}

export function generateMockMetrics(
  campaignPlanId: string,
  days: number = 14,
  plan?: CampaignPlan
): Omit<CampaignMetrics, "id" | "created_at">[] {
  const results: Omit<CampaignMetrics, "id" | "created_at">[] = [];
  const now = new Date();

  const placementBreakdown = plan
    ? buildSimulatedPlacementInsights(plan).rows
    : undefined;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const spend = 50000 + Math.random() * 100000;
    const impressions = 2000 + Math.random() * 5000;
    const clicks = Math.floor(impressions * (0.008 + Math.random() * 0.02));
    const leads = Math.floor(clicks * (0.02 + Math.random() * 0.08));
    const cpc = clicks > 0 ? spend / clicks : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpl = leads > 0 ? spend / leads : 0;

    const dayFactor = 0.7 + Math.random() * 0.6;
    const scaledBreakdown = placementBreakdown?.map((row) => ({
      ...row,
      spend: Math.round(row.spend * dayFactor),
      impressions: Math.floor(row.impressions * dayFactor),
      clicks: Math.floor(row.clicks * dayFactor),
      leads: Math.floor(row.leads * dayFactor),
    }));

    results.push({
      campaign_plan_id: campaignPlanId,
      date: date.toISOString().split("T")[0],
      spend: Math.round(spend * 100) / 100,
      impressions: Math.floor(impressions),
      reach: Math.floor(impressions * 0.7),
      clicks,
      cpc: Math.round(cpc * 100) / 100,
      ctr: Math.round(ctr * 100) / 100,
      cpm: Math.round((spend / impressions) * 1000 * 100) / 100,
      leads,
      cpl: Math.round(cpl * 100) / 100,
      conversions: Math.floor(leads * 0.3),
      conversion_rate: clicks > 0 ? Math.round((leads / clicks) * 10000) / 100 : 0,
      lead_quality_score: Math.round((5 + Math.random() * 4) * 10) / 10,
      raw_metrics_json: {
        mock: true,
        simulated: true,
        placement_breakdown: scaledBreakdown,
      },
    });
  }

  return results;
}
