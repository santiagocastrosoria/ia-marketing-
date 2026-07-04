import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail, adsModeErrorResponse } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertReadOnlyModeAllows("CREATE_CAMPAIGN");

    const { id } = await params;
    const { repo } = await getAuthContext();
    const blueprint = await repo.getCampaignBlueprint(id);

    if (!blueprint) {
      return apiFail("Propuesta no encontrada", "BLUEPRINT_NOT_FOUND", 404);
    }

    return NextResponse.json({ blueprint, message: "Listo para crear en Meta." });
  } catch (error) {
    const adsErr = adsModeErrorResponse(error);
    if (adsErr) return adsErr;
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "META_CREATE_BLOCKED");
  }
}
