import { NextResponse } from "next/server";
import { adsModeErrorResponse, apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { metaApiErrorResponse } from "@/lib/ads/metaApiRouteHelper";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import {
  listMetaCampaigns,
} from "@/lib/ads/metaRealService";
import { isReadOnlyMode } from "@/lib/utils/config";

export async function GET(request: Request) {
  try {
    await getAuthContext();

    if (!isReadOnlyMode()) {
      return apiFail(
        "Leer campañas Meta requiere ADS_MODE=read_only",
        "META_READ_ONLY_REQUIRED",
        400
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const campaigns = await listMetaCampaigns({ limit });

    return NextResponse.json({
      error: false,
      campaigns,
      readOnly: true,
      source: "meta_api",
      count: campaigns.length,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    const modeErr = adsModeErrorResponse(error);
    if (modeErr) return modeErr;

    const metaErr = metaApiErrorResponse(error);
    if (metaErr) return metaErr;

    return apiErrorResponse(error, "META_CAMPAIGNS_FAILED");
  }
}
