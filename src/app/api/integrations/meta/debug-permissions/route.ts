import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { diagnoseMetaPermissions } from "@/lib/ads/metaDebugService";
import { isReadOnlyMode } from "@/lib/utils/config";

/** Diagnóstico de permisos Meta — solo lecturas GET, sin modificar datos. */
export async function GET() {
  try {
    await getAuthContext();

    if (!isReadOnlyMode()) {
      return apiFail(
        "Diagnóstico Meta requiere ADS_MODE=read_only",
        "META_READ_ONLY_REQUIRED",
        400
      );
    }

    const report = await diagnoseMetaPermissions();

    return NextResponse.json({
      error: false,
      readOnly: true,
      diagnostic: report,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "META_DEBUG_PERMISSIONS_FAILED");
  }
}
