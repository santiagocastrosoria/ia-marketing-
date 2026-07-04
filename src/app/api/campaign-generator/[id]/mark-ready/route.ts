import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { auditLog } from "@/lib/security/auditLogger";

/** Marca internamente como lista para Meta Draft — no escribe en Meta. */
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

    const updated = await repo.updateCampaignBlueprint(id, {
      status: "READY_FOR_META_DRAFT",
    });

    if (!updated) {
      return apiFail("No se pudo actualizar el estado", "STATUS_UPDATE_FAILED", 500);
    }

    const business = await repo.getBusiness(updated.business_id);

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_BLUEPRINT_MARKED_READY",
      entityType: "campaign_blueprint",
      entityId: id,
      payload: { status: "READY_FOR_META_DRAFT", manual: true },
    });

    return NextResponse.json({
      blueprint: {
        ...updated,
        business_name: business?.name,
      },
      message:
        "Estado interno actualizado a READY_FOR_META_DRAFT. Sin escritura en Meta.",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_MARK_READY_FAILED");
  }
}
