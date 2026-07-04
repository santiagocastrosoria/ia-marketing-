import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { metaApiErrorResponse } from "@/lib/ads/metaApiRouteHelper";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { getMetaIntegrationStatus } from "@/lib/ads/metaConfig";
import { testMetaConnection } from "@/lib/ads/metaRealService";
import { isReadOnlyMode } from "@/lib/utils/config";
import { auditLog } from "@/lib/security/auditLogger";

export async function GET() {
  try {
    await getAuthContext();
    const meta = getMetaIntegrationStatus();
    return NextResponse.json({ error: false, meta });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "META_STATUS_FAILED");
  }
}

export async function POST() {
  try {
    const { userId, repo } = await getAuthContext();

    if (!isReadOnlyMode()) {
      return apiFail(
        "Probar conexión Meta requiere ADS_MODE=read_only",
        "META_READ_ONLY_REQUIRED",
        400
      );
    }

    const result = await testMetaConnection();
    const meta = getMetaIntegrationStatus(true);

    await auditLog({
      userId,
      repo,
      action: "META_CONNECTION_TESTED",
      entityType: "integration",
      entityId: "meta",
      payload: {
        ok: result.ok,
        adAccountId: meta.adAccountIdMasked,
        userId: result.user?.id,
      },
    });

    return NextResponse.json({
      error: false,
      ok: true,
      user: result.user,
      adAccount: result.adAccount,
      meta,
      message: "Conexión Meta verificada (solo lectura).",
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;

    const metaErr = metaApiErrorResponse(error);
    if (metaErr) return metaErr;

    return apiErrorResponse(error, "META_TEST_FAILED");
  }
}
