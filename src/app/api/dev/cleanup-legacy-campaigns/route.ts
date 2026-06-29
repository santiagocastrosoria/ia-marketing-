import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import {
  detectLegacyCampaigns,
  pauseLegacyActiveCampaigns,
} from "@/lib/campaigns/legacyCampaigns";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { auditLog } from "@/lib/security/auditLogger";
import { isDevToolsEnabled } from "@/lib/utils/config";

export async function POST(request: Request) {
  try {
    if (!isDevToolsEnabled()) {
      return apiFail(
        "Herramientas de desarrollo no disponibles en producción",
        "DEV_TOOLS_DISABLED",
        403
      );
    }

    const { userId, repo } = await getAuthContext();
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const targetStatus =
      body.targetStatus === "ARCHIVED" ? "ARCHIVED" : "PAUSED";
    const campaignIds = Array.isArray(body.campaignIds)
      ? (body.campaignIds as string[])
      : undefined;

    const detection = await detectLegacyCampaigns(repo);

    if (dryRun) {
      return NextResponse.json({
        error: false,
        dryRun: true,
        latestObjectiveId: detection.latestObjectiveId,
        legacyCampaigns: detection.records.filter((r) => r.isLegacy),
        wouldPause: detection.toPause,
        message:
          "Modo dryRun — no se aplicaron cambios. Enviá dryRun=false para pausar campañas ACTIVE legacy.",
      });
    }

    const { paused, skipped } = await pauseLegacyActiveCampaigns(
      repo,
      userId,
      { targetStatus, campaignIds }
    );

    await auditLog({
      userId,
      repo,
      action: "LEGACY_CAMPAIGNS_CLEANUP",
      entityType: "campaign_plan",
      entityId: userId,
      payload: {
        dryRun: false,
        targetStatus,
        pausedCount: paused.length,
        paused: paused.map((p) => ({
          campaignId: p.campaignId,
          campaignName: p.campaignName,
          previousStatus: "ACTIVE",
          newStatus: targetStatus,
          reason: p.reason,
        })),
        skippedCount: skipped.length,
      },
    });

    return NextResponse.json({
      error: false,
      dryRun: false,
      latestObjectiveId: detection.latestObjectiveId,
      paused,
      skipped,
      message: `${paused.length} campaña(s) ACTIVE legacy pasaron a ${targetStatus}.`,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "LEGACY_CLEANUP_FAILED");
  }
}

export async function GET() {
  try {
    if (!isDevToolsEnabled()) {
      return apiFail(
        "Herramientas de desarrollo no disponibles en producción",
        "DEV_TOOLS_DISABLED",
        403
      );
    }

    const { repo } = await getAuthContext();
    const detection = await detectLegacyCampaigns(repo);

    return NextResponse.json({
      error: false,
      latestObjectiveId: detection.latestObjectiveId,
      legacyCampaigns: detection.records.filter((r) => r.isLegacy),
      wouldPause: detection.toPause,
      allCampaigns: detection.records,
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "LEGACY_DETECT_FAILED");
  }
}
