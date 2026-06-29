import { NextResponse } from "next/server";
import { adsModeErrorResponse, apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { checkApprovalGate } from "@/lib/approvals/approvalGate";
import type { CampaignPlan, ProposedAction } from "@/lib/types/marketing";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, repo } = await getAuthContext();
    assertReadOnlyModeAllows("CHANGE_PLACEMENTS");
    const { id } = await params;
    const body = (await request.json()) as Partial<CampaignPlan>;

    const plan = await repo.getCampaignPlan(id);
    if (!plan) {
      return apiFail("Campaña no encontrada", "CAMPAIGN_NOT_FOUND", 404);
    }
    if (plan.platform !== "META") {
      return apiFail(
        "Solo campañas META admiten placements de Instagram",
        "INVALID_PLATFORM",
        400
      );
    }

    const placementChanged =
      (body.placementStrategy && body.placementStrategy !== plan.placementStrategy) ||
      (body.metaChannelPreference &&
        body.metaChannelPreference !== plan.metaChannelPreference);

    if (
      placementChanged &&
      (plan.status === "ACTIVE" || plan.status === "APPROVED")
    ) {
      const action: ProposedAction = {
        type: "CHANGE_PLACEMENT_STRATEGY",
        entityType: "campaign_plan",
        entityId: id,
        campaignPlanId: id,
        platform: "META",
        payload: {
          previousPlacementStrategy: plan.placementStrategy,
          newPlacementStrategy: body.placementStrategy,
          previousChannelPreference: plan.metaChannelPreference,
          newChannelPreference: body.metaChannelPreference,
        },
      };

      const gate = await checkApprovalGate(action, userId);
      if (!gate.allowed) {
        return apiFail(
          gate.reason,
          "APPROVAL_REQUIRED",
          403,
          { approvalRequestId: gate.approvalRequestId }
        );
      }
    }

    const updated = await repo.updateCampaignPlan(id, {
      publisherPlatforms: body.publisherPlatforms,
      instagramPositions: body.instagramPositions,
      facebookPositions: body.facebookPositions,
      placementStrategy: body.placementStrategy,
      metaChannelPreference: body.metaChannelPreference,
      primaryChannel: body.primaryChannel,
      primaryPlacement: body.primaryPlacement,
      placements: body.placements,
    });

    return NextResponse.json({ error: false, campaign: updated });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    const modeErr = adsModeErrorResponse(error);
    if (modeErr) return modeErr;
    return apiErrorResponse(error, "META_PLACEMENTS_UPDATE_FAILED");
  }
}
