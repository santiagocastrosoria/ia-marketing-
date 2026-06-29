import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { getMetaIntegrationStatus } from "@/lib/ads/metaConfig";

/** Estado público de integraciones (sin secretos). */
export async function GET() {
  try {
    await getAuthContext();
    const meta = getMetaIntegrationStatus();

    return NextResponse.json({
      error: false,
      adsMode: meta.adsMode,
      meta,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "INTEGRATIONS_STATUS_FAILED");
  }
}
