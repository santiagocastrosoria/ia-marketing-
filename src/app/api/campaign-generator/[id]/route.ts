import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

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
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_GET_FAILED");
  }
}
