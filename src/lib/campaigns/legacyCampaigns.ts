import type { ApprovalRequest, CampaignPlan, MarketingObjective } from "@/lib/types/marketing";
import type { Repository } from "@/lib/db/repository";

const ACTIVATION_ACTIONS = new Set([
  "ACTIVATE_CAMPAIGN",
  "CHANGE_STATUS_TO_ACTIVE",
  "CREATE_ACTIVE_CAMPAIGN",
]);

export interface LegacyCampaignRecord {
  campaignId: string;
  campaignName: string;
  status: CampaignPlan["status"];
  objectiveId: string;
  createdAt: string;
  reason: string;
  isLegacy: boolean;
  /** ACTIVE legacy que se pausaría en cleanup */
  willPause: boolean;
}

export function getLatestObjectiveId(
  objectives: MarketingObjective[]
): string | null {
  if (objectives.length === 0) return null;
  const sorted = [...objectives].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted[0]?.id ?? null;
}

export function getApprovedActivationCampaignIds(
  approvals: ApprovalRequest[]
): Set<string> {
  const ids = new Set<string>();
  for (const a of approvals) {
    if (
      a.status === "APPROVED" &&
      ACTIVATION_ACTIONS.has(a.action_type)
    ) {
      ids.add(a.campaign_plan_id);
    }
  }
  return ids;
}

/** Campaña de prueba anterior (objetivo viejo o ACTIVE sin aprobación válida). */
export function classifyLegacyCampaign(
  campaign: CampaignPlan,
  latestObjectiveId: string | null,
  approvedActivationIds: Set<string>
): { isLegacy: boolean; reason: string; willPause: boolean } {
  const hasApprovedActivation = approvedActivationIds.has(campaign.id);
  const isLatestObjective =
    latestObjectiveId != null && campaign.objective_id === latestObjectiveId;

  if (campaign.status === "ACTIVE") {
    if (isLatestObjective && hasApprovedActivation) {
      return {
        isLegacy: false,
        reason: "Activa con aprobación válida en el objetivo más reciente",
        willPause: false,
      };
    }
    if (!hasApprovedActivation) {
      return {
        isLegacy: true,
        reason: isLatestObjective
          ? "ACTIVE sin solicitud de aprobación aprobada"
          : "ACTIVE de sesión anterior sin aprobación registrada",
        willPause: true,
      };
    }
    return {
      isLegacy: true,
      reason: "ACTIVE de objetivo anterior (fuera del flujo actual)",
      willPause: true,
    };
  }

  if (!isLatestObjective) {
    return {
      isLegacy: true,
      reason: "Campaña de objetivo anterior",
      willPause: false,
    };
  }

  return {
    isLegacy: false,
    reason: "Campaña del objetivo actual",
    willPause: false,
  };
}

export async function detectLegacyCampaigns(repo: Repository): Promise<{
  latestObjectiveId: string | null;
  records: LegacyCampaignRecord[];
  toPause: LegacyCampaignRecord[];
}> {
  const [objectives, campaigns, approvals] = await Promise.all([
    repo.getObjectives(),
    repo.getCampaignPlans(),
    repo.getApprovalRequests(),
  ]);

  const latestObjectiveId = getLatestObjectiveId(objectives);
  const approvedActivationIds = getApprovedActivationCampaignIds(approvals);

  const records: LegacyCampaignRecord[] = campaigns.map((c) => {
    const { isLegacy, reason, willPause } = classifyLegacyCampaign(
      c,
      latestObjectiveId,
      approvedActivationIds
    );
    return {
      campaignId: c.id,
      campaignName: c.campaignName,
      status: c.status,
      objectiveId: c.objective_id,
      createdAt: c.created_at,
      reason,
      isLegacy,
      willPause,
    };
  });

  return {
    latestObjectiveId,
    records,
    toPause: records.filter((r) => r.willPause),
  };
}

export async function pauseLegacyActiveCampaigns(
  repo: Repository,
  userId: string,
  options?: {
    targetStatus?: "PAUSED" | "ARCHIVED";
    campaignIds?: string[];
  }
): Promise<{
  paused: LegacyCampaignRecord[];
  skipped: LegacyCampaignRecord[];
}> {
  const { records, toPause } = await detectLegacyCampaigns(repo);
  const targetStatus = options?.targetStatus ?? "PAUSED";
  const idFilter = options?.campaignIds?.length
    ? new Set(options.campaignIds)
    : null;

  const paused: LegacyCampaignRecord[] = [];
  const skipped: LegacyCampaignRecord[] = [];

  for (const record of toPause) {
    if (idFilter && !idFilter.has(record.campaignId)) {
      skipped.push(record);
      continue;
    }
    await repo.updateCampaignPlan(record.campaignId, { status: targetStatus });
    paused.push({ ...record, status: targetStatus });
  }

  return { paused, skipped };
}
