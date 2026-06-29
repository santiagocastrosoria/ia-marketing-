import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { auditLog } from "@/lib/security/auditLogger";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, repo } = await getAuthContext();
    const { id } = await params;
    const approval = await repo.getApprovalRequest(id);

    if (!approval) {
      return apiFail("No encontrado", "APPROVAL_NOT_FOUND", 404);
    }

    if (approval.status !== "PENDING") {
      return apiFail("La solicitud ya fue procesada", "APPROVAL_ALREADY_PROCESSED", 400);
    }

    const updated = await repo.updateApprovalRequest(id, {
      status: "APPROVED",
      approved_by: userId,
      approved_at: new Date().toISOString(),
    });

    await repo.updateCampaignPlan(approval.campaign_plan_id, {
      status: "APPROVED",
    });

    await auditLog({
      userId,
      repo,
      action: "APPROVAL_GRANTED",
      entityType: "approval_request",
      entityId: id,
      payload: { campaignPlanId: approval.campaign_plan_id },
    });

    return NextResponse.json({
      approval: updated,
      message: "Aprobación concedida. Usa POST /api/campaigns/:id/activate para activar.",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "APPROVAL_GRANT_FAILED");
  }
}
