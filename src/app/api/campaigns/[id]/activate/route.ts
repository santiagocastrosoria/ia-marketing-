import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { activateMetaCampaign } from "@/lib/ads/metaAdsService";
import { activateGoogleCampaign } from "@/lib/ads/googleAdsService";
import { ApprovalGateError } from "@/lib/approvals/approvalGate";
import { auditLog } from "@/lib/security/auditLogger";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, repo } = await getAuthContext();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const approvalRequestId = body.approvalRequestId as string | undefined;

    const plan = await repo.getCampaignPlan(id);

    if (!plan) {
      return apiFail("Campaña no encontrada", "CAMPAIGN_NOT_FOUND", 404);
    }

    if (!approvalRequestId) {
      const approvals = await repo.getApprovalRequests("APPROVED");
      const approved = approvals.find(
        (a) => a.campaign_plan_id === id && a.status === "APPROVED"
      );
      if (!approved) {
        return apiFail(
          "Activación bloqueada: se requiere aprobación humana explícita.",
          "APPROVAL_REQUIRED",
          403
        );
      }
    }

    const approvalId =
      approvalRequestId ??
      (
        await repo.getApprovalRequests("APPROVED")
      ).find((a) => a.campaign_plan_id === id)?.id;

    if (!approvalId) {
      return apiFail(
        "No hay aprobación válida para esta campaña.",
        "NOT_APPROVED",
        403
      );
    }

    const approval = await repo.getApprovalRequest(approvalId);
    if (!approval || approval.status !== "APPROVED") {
      return apiFail("Aprobación no válida o pendiente.", "NOT_APPROVED", 403);
    }

    let result;
    if (plan.platform === "META") {
      result = await activateMetaCampaign(plan, userId, approvalId);
    } else {
      result = await activateGoogleCampaign(plan, userId, approvalId);
    }

    const updated = await repo.updateCampaignPlan(id, {
      status: "ACTIVE",
      platform_campaign_id: result.platformCampaignId,
    });

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_ACTIVATED",
      entityType: "campaign_plan",
      entityId: id,
      payload: { approvalRequestId: approvalId, result, mock: result.mock },
    });

    return NextResponse.json({
      campaign: updated,
      result,
      message: result.mock
        ? "Campaña activada en modo mock (simulación)"
        : "Campaña activada en plataforma",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    if (error instanceof ApprovalGateError) {
      return apiFail(error.message, error.code, 403);
    }
    return apiErrorResponse(error, "CAMPAIGN_ACTIVATE_FAILED");
  }
}
