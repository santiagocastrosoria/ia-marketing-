import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET() {
  try {
    const { repo } = await getAuthContext();
    const stats = await repo.getDashboardStats();
    const campaigns = await repo.getCampaignPlans();
    const objectives = await repo.getObjectives();

    return NextResponse.json({ stats, campaigns, objectives });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "DASHBOARD_GET_FAILED");
  }
}
