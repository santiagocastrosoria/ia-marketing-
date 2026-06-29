import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET() {
  try {
    const { repo } = await getAuthContext();
    const approvals = await repo.getApprovalRequests("PENDING");

    const enriched = await Promise.all(
      approvals.map(async (approval) => {
        const campaign = await repo.getCampaignPlan(approval.campaign_plan_id);
        return { ...approval, campaign_plan: campaign };
      })
    );

    return NextResponse.json({ approvals: enriched });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "APPROVALS_GET_FAILED");
  }
}
