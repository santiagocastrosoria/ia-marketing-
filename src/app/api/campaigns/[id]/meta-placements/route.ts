import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { CampaignPlan } from "@/lib/types/marketing";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { repo } = await getAuthContext();
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

    const updated = await repo.updateCampaignPlan(id, {
      publisherPlatforms: body.publisherPlatforms,
      instagramPositions: body.instagramPositions,
      placementStrategy: body.placementStrategy,
      metaChannelPreference: body.metaChannelPreference,
      placements: body.placements,
    });

    return NextResponse.json({ error: false, campaign: updated });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "META_PLACEMENTS_UPDATE_FAILED");
  }
}
