import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/apiError";
import { getLatestObjectiveId } from "@/lib/campaigns/legacyCampaigns";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET(request: Request) {
  try {
    const { repo } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const campaignPlanId = searchParams.get("campaignPlanId") ?? undefined;
    const period = searchParams.get("period") ?? "30";

    let metrics = await repo.getMetrics(campaignPlanId);

    const days = parseInt(period, 10);
    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      metrics = metrics.filter((m) => new Date(m.date) >= cutoff);
    }

    const campaigns = await repo.getCampaignPlans();
    const objectives = await repo.getObjectives();
    const latestObjectiveId = getLatestObjectiveId(objectives);

    return NextResponse.json({
      metrics,
      campaigns,
      objectives,
      latestObjectiveId,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "METRICS_GET_FAILED");
  }
}
