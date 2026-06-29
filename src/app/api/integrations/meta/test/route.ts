import { NextResponse } from "next/server";
import { adsModeErrorResponse, apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { getMetaIntegrationStatus } from "@/lib/ads/metaConfig";
import {
  MetaApiError,
  MetaConfigError,
  testMetaConnection,
} from "@/lib/ads/metaRealService";
import { isReadOnlyMode } from "@/lib/utils/config";
import { auditLog } from "@/lib/security/auditLogger";

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
    const modeErr = adsModeErrorResponse(error);
    if (modeErr) return modeErr;

    if (error instanceof MetaConfigError) {
      return apiFail(error.message, error.code, 400, {
        meta: getMetaIntegrationStatus(false, error.message),
      });
    }

    if (error instanceof MetaApiError) {
      return apiFail(error.message, error.code, 502, {
        details: String(error.details ?? ""),
        meta: getMetaIntegrationStatus(false, error.message),
      });
    }

    return apiErrorResponse(error, "META_TEST_FAILED");
  }
}
