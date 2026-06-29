import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { analyzeMetrics, generateMockMetrics } from "@/lib/agent/metricsAnalyzer";
import { generateRecommendations } from "@/lib/agent/recommendationEngine";
import { getBrandKnowledgeContext } from "@/lib/brand/brandKnowledgeService";
import { fetchMetaPlacementInsights } from "@/lib/ads/metaInsightsService";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { auditLog } from "@/lib/security/auditLogger";

export async function POST(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const { campaignPlanId, generateMock } = await request.json();

    if (campaignPlanId) {
      const campaign = await repo.getCampaignPlan(campaignPlanId);
      if (!campaign) {
        return apiFail("Campaña no encontrada", "CAMPAIGN_NOT_FOUND", 404);
      }

      let metrics = await repo.getMetrics(campaignPlanId);

      if (generateMock || metrics.length === 0) {
        const mockData = generateMockMetrics(campaignPlanId, 14, campaign);
        for (const m of mockData) {
          const created = await repo.createMetrics(m);
          metrics.push(created);
        }
      }

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
          campaign_plan_id: campaignPlanId,
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
        entityId: campaignPlanId,
        payload: { recommendationCount: savedRecs.length },
      });

      return NextResponse.json({
        analysis,
        metrics,
        recommendations: savedRecs,
        placementBreakdown,
      });
    }

    const campaigns = await repo.getCampaignPlans();
    const allAnalysis = [];

    for (const campaign of campaigns) {
      let metrics = await repo.getMetrics(campaign.id);
      if (metrics.length === 0) {
        const mockData = generateMockMetrics(campaign.id, 14, campaign);
        for (const m of mockData) {
          metrics.push(await repo.createMetrics(m));
        }
      }
      allAnalysis.push({
        campaign,
        analysis: analyzeMetrics(metrics, campaign),
        metrics,
      });
    }

    return NextResponse.json({ analyses: allAnalysis });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "METRICS_ANALYZE_FAILED");
  }
}
