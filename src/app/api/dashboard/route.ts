import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/apiError";
import {
  classifyLegacyCampaign,
  getLatestObjectiveId,
  getApprovedActivationCampaignIds,
} from "@/lib/campaigns/legacyCampaigns";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET() {
  try {
    const { repo } = await getAuthContext();
    const stats = await repo.getDashboardStats();
    const campaigns = await repo.getCampaignPlans();
    const objectives = await repo.getObjectives();
    const approvals = await repo.getApprovalRequests();

    const latestObjectiveId = getLatestObjectiveId(objectives);
    const approvedActivationIds = getApprovedActivationCampaignIds(approvals);

    const campaignsWithMeta = campaigns.map((c) => {
      const { isLegacy, reason } = classifyLegacyCampaign(
        c,
        latestObjectiveId,
        approvedActivationIds
      );
      return { ...c, isLegacy, legacyReason: isLegacy ? reason : undefined };
    });

    return NextResponse.json({
      stats,
      campaigns: campaignsWithMeta,
      objectives,
      latestObjectiveId,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "DASHBOARD_GET_FAILED");
  }
}
