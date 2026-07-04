import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { reviewCampaignBlueprint } from "@/lib/agent/campaignBlueprintReviewAgent";
import { auditLog } from "@/lib/security/auditLogger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, repo } = await getAuthContext();

    const blueprint = await repo.getCampaignBlueprint(id);
    if (!blueprint) {
      return apiFail("Propuesta no encontrada", "BLUEPRINT_NOT_FOUND", 404);
    }

    const review = reviewCampaignBlueprint(blueprint);

    const updated = await repo.updateCampaignBlueprint(id, {
      review,
      status: review.suggestedStatus,
    });

    if (!updated) {
      return apiFail("No se pudo guardar la revisión", "REVIEW_SAVE_FAILED", 500);
    }

    const business = await repo.getBusiness(updated.business_id);

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_BLUEPRINT_REVIEWED",
      entityType: "campaign_blueprint",
      entityId: id,
      payload: {
        preparationScore: review.preparationScore,
        suggestedStatus: review.suggestedStatus,
      },
    });

    return NextResponse.json({
      blueprint: {
        ...updated,
        business_name: business?.name,
      },
      review,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_REVIEW_FAILED");
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { repo } = await getAuthContext();

    const blueprint = await repo.getCampaignBlueprint(id);
    if (!blueprint) {
      return apiFail("Propuesta no encontrada", "BLUEPRINT_NOT_FOUND", 404);
    }

    const business = await repo.getBusiness(blueprint.business_id);

    return NextResponse.json({
      blueprint: {
        ...blueprint,
        business_name: business?.name,
      },
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_REVIEW_GET_FAILED");
  }
}
