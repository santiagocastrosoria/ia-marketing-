import { NextResponse } from "next/server";
import { adsModeErrorResponse, apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { metaApiErrorResponse } from "@/lib/ads/metaApiRouteHelper";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { getMetaIntegrationStatus } from "@/lib/ads/metaConfig";
import { getMetaInsights } from "@/lib/ads/metaRealService";
import { isReadOnlyMode } from "@/lib/utils/config";
import { auditLog } from "@/lib/security/auditLogger";

export async function GET(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();

    if (!isReadOnlyMode()) {
      return apiFail(
        "Leer insights Meta requiere ADS_MODE=read_only",
        "META_READ_ONLY_REQUIRED",
        400
      );
    }

    const { searchParams } = new URL(request.url);
    const level = (searchParams.get("level") ?? "account") as
      | "account"
      | "campaign"
      | "adset"
      | "ad";
    const campaignId = searchParams.get("campaignId") ?? undefined;
    const objectId = searchParams.get("objectId") ?? undefined;
    const datePreset = searchParams.get("datePreset") ?? "last_30d";
    const since = searchParams.get("since") ?? undefined;
    const until = searchParams.get("until") ?? undefined;

    const result = await getMetaInsights({
      level,
      objectId,
      campaignId,
      datePreset: since && until ? undefined : datePreset,
      since,
      until,
      breakdowns: ["publisher_platform", "platform_position"],
    });

    await auditLog({
      userId,
      repo,
      action: "META_INSIGHTS_READ",
      entityType: "integration",
      entityId: campaignId ?? objectId ?? "account",
      payload: { level, rowCount: result.rows.length, readOnly: true },
    });

    return NextResponse.json({
      error: false,
      readOnly: true,
      source: "meta_api",
      simulated: false,
      rows: result.rows,
      rawCount: result.rawCount,
      meta: getMetaIntegrationStatus(true),
      message:
        result.rows.length === 0
          ? "No hay datos de insights para el período seleccionado."
          : undefined,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    const modeErr = adsModeErrorResponse(error);
    if (modeErr) return modeErr;

    const metaErr = metaApiErrorResponse(error);
    if (metaErr) return metaErr;

    return apiErrorResponse(error, "META_INSIGHTS_FAILED");
  }
}
