import { checkApprovalGate, ApprovalGateError } from "@/lib/approvals/approvalGate";
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";
import { toMetaApiTargeting } from "@/lib/ads/metaPlacements";
import { isMockMode } from "@/lib/utils/config";
import type { CampaignPlan, ProposedAction } from "@/lib/types/marketing";
import { v4 as uuidv4 } from "uuid";

export interface MetaCampaignResult {
  platformCampaignId: string;
  status: "PAUSED" | "DRAFT";
  mock: boolean;
  targeting?: Record<string, unknown>;
}

export async function createMetaCampaignPaused(
  plan: CampaignPlan,
  userId: string
): Promise<MetaCampaignResult> {
  assertReadOnlyModeAllows("CREATE_CAMPAIGN");

  const action: ProposedAction = {
    type: "CREATE_ACTIVE_CAMPAIGN",
    entityType: "campaign_plan",
    entityId: plan.id,
    payload: { platform: "META", plan },
    proposedBudget: plan.dailyBudget,
    platform: "META",
  };

  if (plan.status === "ACTIVE") {
    const gate = await checkApprovalGate(action, userId);
    if (!gate.allowed) {
      throw new ApprovalGateError(
        "No se puede crear campaña ACTIVE sin aprobación.",
        "APPROVAL_REQUIRED"
      );
    }
  }

  const targeting = toMetaApiTargeting({
    publisherPlatforms: plan.publisherPlatforms,
    instagramPositions: plan.instagramPositions,
    placementStrategy: plan.placementStrategy,
  });

  if (isMockMode()) {
    return {
      platformCampaignId: `meta_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
      targeting,
    };
  }

  // draft_only / live_approval: escritura real no implementada aún
  return {
    platformCampaignId: `meta_mock_${uuidv4().slice(0, 8)}`,
    status: "PAUSED",
    mock: true,
    targeting,
  };
}

export async function activateMetaCampaign(
  plan: CampaignPlan,
  userId: string,
  approvalRequestId: string
): Promise<MetaCampaignResult> {
  assertReadOnlyModeAllows("ACTIVATE_CAMPAIGN");

  const action: ProposedAction = {
    type: "ACTIVATE_CAMPAIGN",
    entityType: "campaign_plan",
    entityId: plan.id,
    payload: {
      platform: "META",
      platformCampaignId: plan.platform_campaign_id,
      newStatus: "ACTIVE",
    },
    proposedBudget: plan.dailyBudget,
    platform: "META",
  };

  const gate = await checkApprovalGate(action, userId, { approvalRequestId });
  if (!gate.allowed) {
    throw new ApprovalGateError(gate.reason, "NOT_APPROVED");
  }

  if (isMockMode() || !process.env.META_ACCESS_TOKEN) {
    return {
      platformCampaignId: plan.platform_campaign_id ?? `meta_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
    };
  }

  return {
    platformCampaignId: plan.platform_campaign_id!,
    status: "PAUSED",
    mock: false,
  };
}

export async function pauseMetaCampaign(
  platformCampaignId: string
): Promise<void> {
  assertReadOnlyModeAllows("PAUSE_CAMPAIGN");
  if (isMockMode()) return;
}
