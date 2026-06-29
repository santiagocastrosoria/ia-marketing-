import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import {
  executeWithApprovalGate,
  ApprovalGateError,
} from "@/lib/approvals/approvalGate";
import { auditLog } from "@/lib/security/auditLogger";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { ProposedAction } from "@/lib/types/marketing";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, repo } = await getAuthContext();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const approvalRequestId = body.approvalRequestId as string | undefined;

    const recommendation = await repo.getRecommendation(id);

    if (!recommendation) {
      return apiFail("Recomendación no encontrada", "RECOMMENDATION_NOT_FOUND", 404);
    }

    if (recommendation.status === "APPLIED") {
      return apiFail("Recomendación ya aplicada", "RECOMMENDATION_ALREADY_APPLIED", 400);
    }

    const campaign = await repo.getCampaignPlan(recommendation.campaign_plan_id);

    const action: ProposedAction = {
      type: "APPLY_RECOMMENDATION",
      entityType: "recommendation",
      entityId: id,
      campaignPlanId: recommendation.campaign_plan_id,
      payload: {
        recommendationType: recommendation.type,
        recommendation,
        direction: recommendation.type === "CHANGE_BUDGET" ? "increase" : undefined,
      },
      currentBudget: campaign?.dailyBudget,
      proposedBudget:
        recommendation.type === "CHANGE_BUDGET" && campaign
          ? campaign.dailyBudget * 1.2
          : undefined,
      platform: campaign?.platform,
    };

    const { result, gate } = await executeWithApprovalGate(
      action,
      userId,
      async () => {
        await repo.updateRecommendation(id, { status: "APPLIED" });
        return { applied: true, recommendation };
      },
      approvalRequestId
    );

    if (!gate.allowed) {
      await auditLog({
        userId,
        repo,
        action: "RECOMMENDATION_BLOCKED_PENDING_APPROVAL",
        entityType: "recommendation",
        entityId: id,
        payload: { gate },
      });

      return apiFail(
        gate.reason,
        "APPROVAL_REQUIRED",
        403,
        {
          requiresApproval: true,
          approvalRequestId: gate.approvalRequestId,
        }
      );
    }

    await auditLog({
      userId,
      repo,
      action: "RECOMMENDATION_APPLIED",
      entityType: "recommendation",
      entityId: id,
      payload: { result },
    });

    return NextResponse.json({
      applied: true,
      result,
      message: "Recomendación aplicada exitosamente.",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    if (error instanceof ApprovalGateError) {
      return apiFail(error.message, error.code, 403);
    }
    return apiErrorResponse(error, "RECOMMENDATION_APPLY_FAILED");
  }
}
