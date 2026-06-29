import type {
  CampaignMetrics,
  CampaignPlan,
  Recommendation,
} from "@/lib/types/marketing";
import type { BrandKnowledgeContext } from "@/lib/types/brand";
import { formatARS } from "@/lib/utils/formatARS";

export function generateRecommendations(
  campaign: CampaignPlan,
  metrics: CampaignMetrics[],
  brand?: BrandKnowledgeContext
): Omit<Recommendation, "id" | "campaign_plan_id" | "status" | "created_at">[] {
  const recommendations: Omit<
    Recommendation,
    "id" | "campaign_plan_id" | "status" | "created_at"
  >[] = [];

  if (metrics.length === 0) return recommendations;

  const avgCtr =
    metrics.reduce((s, m) => s + m.ctr, 0) / metrics.length;
  const avgCpl =
    metrics.reduce((s, m) => s + m.cpl, 0) / metrics.length;
  const totalLeads = metrics.reduce((s, m) => s + m.leads, 0);
  const avgQuality =
    metrics.reduce((s, m) => s + m.lead_quality_score, 0) / metrics.length;

  if (avgCtr < 1) {
    recommendations.push({
      type: "PAUSE_AD",
      title: "Pausar anuncio de bajo rendimiento",
      description: `Pausar variantes con CTR inferior a ${avgCtr.toFixed(2)}%.`,
      reason: "CTR por debajo del benchmark para la industria.",
      supporting_metrics_json: { avgCtr },
      expected_impact: "MEDIUM",
      risk_level: "LOW",
      requires_approval: false,
    });

    recommendations.push({
      type: "NEW_COPY_VARIANT",
      title: "Crear nueva variante de copy premium",
      description: "Generar copy con mensajes filtradores para mejorar relevancia.",
      reason: `CTR promedio ${avgCtr.toFixed(2)}%.`,
      supporting_metrics_json: { avgCtr },
      expected_impact: "HIGH",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (campaign.platform === "GOOGLE" && avgCtr > 2) {
    recommendations.push({
      type: "ADD_NEGATIVE_KEYWORDS",
      title: "Agregar keywords negativas",
      description:
        "Revisar términos de búsqueda y agregar negativas para interior, barato, usado.",
      reason: "Proteger presupuesto de búsquedas irrelevantes.",
      supporting_metrics_json: { avgCtr },
      expected_impact: "MEDIUM",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (campaign.locationTargeting.length > 1) {
    recommendations.push({
      type: "SPLIT_BY_ZONE",
      title: "Separar campaña por zona geográfica",
      description:
        "Crear campañas independientes para Córdoba y Buenos Aires con mensajes diferenciados.",
      reason: "CPL y calidad de lead varían significativamente por zona.",
      supporting_metrics_json: {
        locations: campaign.locationTargeting,
        avgCpl,
      },
      expected_impact: "HIGH",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  if (
    campaign.funnelStage !== "REMARKETING" &&
    totalLeads > 20 &&
    avgQuality >= 6
  ) {
    recommendations.push({
      type: "CREATE_REMARKETING",
      title: "Crear campaña de remarketing",
      description:
        "Hay suficientes datos para remarketing. Crear campaña pausada para revisión.",
      reason: `${totalLeads} leads con calidad ${avgQuality.toFixed(1)}/10.`,
      supporting_metrics_json: { totalLeads, avgQuality },
      expected_impact: "HIGH",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  if (avgCpl > 80 && avgQuality < 5) {
    recommendations.push({
      type: "FILTER_LEADS",
      title: "Filtrar leads con mensaje premium",
      description:
        brand?.preferredWords.length
          ? `Usar palabras de marca: ${brand.preferredWords.slice(0, 5).join(", ")}`
          : "Ajustar copy para atraer consultas de mayor valor. Evitar tono de descuento.",
      reason: `CPL ${formatARS(avgCpl)} con calidad baja (${avgQuality.toFixed(1)}).`,
      supporting_metrics_json: { avgCpl, avgQuality },
      expected_impact: "HIGH",
      risk_level: "LOW",
      requires_approval: false,
    });
  }

  if (avgCtr > 2 && totalLeads > 5) {
    const bestAd = campaign.ads[0];
    if (bestAd) {
      recommendations.push({
        type: "DUPLICATE_WINNER",
        title: "Duplicar anuncio ganador",
        description: `Duplicar "${bestAd.name}" como nueva variante pausada.`,
        reason: "Anuncio con mejor rendimiento identificado.",
        supporting_metrics_json: { avgCtr, totalLeads },
        expected_impact: "MEDIUM",
        risk_level: "LOW",
        requires_approval: false,
      });
    }
  }

  if (campaign.funnelStage === "REMARKETING" && avgCpl < 40) {
    recommendations.push({
      type: "CHANGE_BUDGET",
      title: "Aumentar presupuesto de remarketing",
      description: "Remarketing con CPL favorable. Solicitar aprobación para aumento.",
      reason: `CPL promedio ${formatARS(avgCpl)}.`,
      supporting_metrics_json: { avgCpl },
      expected_impact: "MEDIUM",
      risk_level: "MEDIUM",
      requires_approval: true,
    });
  }

  recommendations.push({
    type: "IMPROVE_TRACKING",
    title: "Verificar tracking UTM",
    description: "Confirmar que todos los UTMs están correctamente configurados.",
    reason: "Tracking correcto es fundamental para optimización.",
    supporting_metrics_json: { utm: campaign.trackingUTM },
    expected_impact: "LOW",
    risk_level: "LOW",
    requires_approval: false,
  });

  return recommendations;
}
