import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { createMetaCampaignPaused } from "@/lib/ads/metaAdsService";
import { createGoogleCampaignPaused } from "@/lib/ads/googleAdsService";
import { createApprovalRequestForAction } from "@/lib/approvals/approvalGate";
import { validateForCampaignCreation } from "@/lib/brand/brandKnowledgeService";
import { auditLog } from "@/lib/security/auditLogger";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { ProposedAction } from "@/lib/types/marketing";

export async function POST(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const { campaignPlanId } = await request.json();
    if (!campaignPlanId) {
      return apiFail("campaignPlanId es requerido", "MISSING_CAMPAIGN_PLAN_ID", 400);
    }

    const plan = await repo.getCampaignPlan(campaignPlanId);
    if (!plan) {
      return apiFail("Plan de campaña no encontrado", "CAMPAIGN_PLAN_NOT_FOUND", 404);
    }

    const objective = await repo.getObjective(plan.objective_id);
    if (objective) {
      const { allowed, validation } = await validateForCampaignCreation(
        repo,
        objective.business_id
      );
      if (!allowed) {
        return apiFail(
          validation.message,
          "BRAND_KNOWLEDGE_INCOMPLETE",
          422,
          {
            missingFields: validation.missingFields,
            completenessScore: validation.completenessScore,
            redirectTo: "/brand-knowledge",
          }
        );
      }
    }

    let result;
    if (plan.platform === "META") {
      result = await createMetaCampaignPaused(plan, userId);
    } else {
      result = await createGoogleCampaignPaused(plan, userId);
    }

    const updated = await repo.updateCampaignPlan(campaignPlanId, {
      status: "PAUSED",
      platform_campaign_id: result.platformCampaignId,
    });

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_CREATED_PAUSED",
      entityType: "campaign_plan",
      entityId: campaignPlanId,
      payload: { result, mock: result.mock },
    });

    return NextResponse.json({
      campaign: updated,
      platformResult: result,
      message: result.mock
        ? "Campaña creada en modo mock (PAUSED)"
        : "Campaña creada en plataforma (PAUSED)",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_CREATE_PAUSED_FAILED");
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const { campaignPlanId } = await request.json();
    const plan = await repo.getCampaignPlan(campaignPlanId);
    if (!plan) {
      return apiFail("No encontrado", "CAMPAIGN_PLAN_NOT_FOUND", 404);
    }

    const action: ProposedAction = {
      type: "ACTIVATE_CAMPAIGN",
      entityType: "campaign_plan",
      entityId: campaignPlanId,
      payload: { plan },
      proposedBudget: plan.dailyBudget,
      platform: plan.platform,
    };

    const approval = await createApprovalRequestForAction(
      action,
      userId,
      `Solicitud de activación para campaña "${plan.campaignName}"`
    );

    await repo.updateCampaignPlan(campaignPlanId, {
      status: "PENDING_APPROVAL",
    });

    return NextResponse.json({
      approvalRequestId: approval.id,
      message: "Solicitud de aprobación creada. La campaña no se activará hasta su aprobación.",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "APPROVAL_REQUEST_FAILED");
  }
}
