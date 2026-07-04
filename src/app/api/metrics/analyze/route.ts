import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { metaApiErrorResponse } from "@/lib/ads/metaApiRouteHelper";
import {
  analyzeMetrics,
  analyzeAggregatedMetrics,
  generateMockMetrics,
  type MetricsAnalyzeScope,
} from "@/lib/agent/metricsAnalyzer";
import { generateRecommendations } from "@/lib/agent/recommendationEngine";
import { getBrandKnowledgeContext } from "@/lib/brand/brandKnowledgeService";
import {
  fetchMetaPlacementInsights,
  fetchAggregatedPlacementInsights,
} from "@/lib/ads/metaInsightsService";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { auditLog } from "@/lib/security/auditLogger";
import type { CampaignPlan } from "@/lib/types/marketing";

async function ensureMetrics(
  repo: Awaited<ReturnType<typeof getAuthContext>>["repo"],
  campaign: CampaignPlan,
  generateMock: boolean
) {
  let metrics = await repo.getMetrics(campaign.id);
  if (generateMock || metrics.length === 0) {
    const mockData = generateMockMetrics(campaign.id, 14, campaign);
    for (const m of mockData) {
      metrics.push(await repo.createMetrics(m));
    }
  }
  return metrics;
}

function resolveCampaignsForScope(
  allCampaigns: CampaignPlan[],
  scope: MetricsAnalyzeScope,
  campaignPlanId?: string,
  objectiveId?: string
): CampaignPlan[] {
  if (scope === "campaign" && campaignPlanId) {
    const c = allCampaigns.find((x) => x.id === campaignPlanId);
    return c ? [c] : [];
  }
  if (scope === "objective" && objectiveId) {
    return allCampaigns.filter((c) => c.objective_id === objectiveId);
  }
  if (scope === "objective" && !objectiveId) {
    const objectives = new Map<string, string>();
    for (const c of allCampaigns) {
      if (!objectives.has(c.objective_id)) objectives.set(c.objective_id, c.created_at);
    }
    const latestObjectiveId = [...objectives.entries()].sort(
      (a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime()
    )[0]?.[0];
    if (latestObjectiveId) {
      return allCampaigns.filter((c) => c.objective_id === latestObjectiveId);
    }
  }
  return allCampaigns;
}

export async function POST(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const body = await request.json();
    const scope: MetricsAnalyzeScope = body.scope ?? "campaign";
    const campaignPlanId = body.campaignPlanId as string | undefined;
    const objectiveId = body.objectiveId as string | undefined;
    const generateMock = body.generateMock !== false;

    const allCampaigns = await repo.getCampaignPlans();
    const campaigns = resolveCampaignsForScope(
      allCampaigns,
      scope,
      campaignPlanId,
      objectiveId
    );

    if (campaigns.length === 0) {
      return apiFail("No hay campañas para analizar", "NO_CAMPAIGNS", 404);
    }

    if (scope === "campaign" || !body.scope) {
      const campaign = campaigns[0];
      const metrics = await ensureMetrics(repo, campaign, generateMock);
      const analysis = analyzeMetrics(metrics, campaign);

      const placementBreakdown =
        campaign.platform === "META" || campaign.platform === "GOOGLE"
          ? await fetchMetaPlacementInsights(campaign)
          : null;

      const objective = await repo.getObjective(campaign.objective_id);
      const brandKnowledge = objective
        ? await getBrandKnowledgeContext(repo, objective.business_id)
        : undefined;
      const recs = generateRecommendations(campaign, metrics, brandKnowledge);

      const savedRecs = [];
      for (const rec of [...analysis.recommendations, ...recs]) {
        const saved = await repo.createRecommendation({
          campaign_plan_id: campaign.id,
          ...rec,
          status: "PENDING",
        });
        savedRecs.push(saved);
      }

      await auditLog({
        userId,
        repo,
        action: "METRICS_ANALYZED",
        entityType: "campaign_plan",
        entityId: campaign.id,
        payload: { scope: "campaign", recommendationCount: savedRecs.length },
      });

      return NextResponse.json({
        scope: "campaign",
        analysis,
        metrics,
        recommendations: savedRecs,
        placementBreakdown,
        aggregatedPlacementRows: analysis.aggregatedPlacementRows,
      });
    }

    // scope objective | all — agregado
    const allMetrics = [];
    for (const campaign of campaigns) {
      const m = await ensureMetrics(repo, campaign, generateMock);
      allMetrics.push(...m);
    }

    const aggregated = await fetchAggregatedPlacementInsights(campaigns);
    const analysis = analyzeAggregatedMetrics(
      campaigns,
      allMetrics,
      aggregated.rows,
      aggregated.simulated
    );

    const savedRecs = [];
    const primaryCampaignId = campaigns[0].id;
    for (const rec of analysis.recommendations) {
      const targetId =
        (rec.supporting_metrics_json?.campaignIds as string[] | undefined)?.[0] ??
        primaryCampaignId;
      const saved = await repo.createRecommendation({
        campaign_plan_id: targetId,
        ...rec,
        status: "PENDING",
      });
      savedRecs.push(saved);
    }

    await auditLog({
      userId,
      repo,
      action: "METRICS_ANALYZED_AGGREGATED",
      entityType: "campaign_plan",
      entityId: primaryCampaignId,
      payload: {
        scope,
        campaignCount: campaigns.length,
        objectiveId: objectiveId ?? campaigns[0]?.objective_id,
        recommendationCount: savedRecs.length,
      },
    });

    return NextResponse.json({
      scope,
      analysis,
      metrics: allMetrics,
      recommendations: savedRecs,
      placementBreakdown: {
        source: aggregated.source,
        simulated: aggregated.simulated,
        rows: aggregated.rows,
        byPublisher: {},
        byInstagramPosition: {},
      },
      aggregatedPlacementRows: aggregated.rows,
      campaignsIncluded: campaigns.map((c) => ({
        id: c.id,
        name: c.campaignName,
        platform: c.platform,
      })),
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    const metaErr = metaApiErrorResponse(error);
    if (metaErr) return metaErr;
    return apiErrorResponse(error, "METRICS_ANALYZE_FAILED");
  }
}
