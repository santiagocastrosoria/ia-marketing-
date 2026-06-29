import { checkApprovalGate, ApprovalGateError } from "@/lib/approvals/approvalGate";
import { toMetaApiTargeting } from "@/lib/ads/metaPlacements";
import { isMockMode, canUseMetaInsights } from "@/lib/utils/config";
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

  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return {
      platformCampaignId: `meta_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
      targeting,
    };
  }

  // Future: Meta Marketing API
  // POST /{ad_account_id}/campaigns status=PAUSED
  // Ad set targeting: publisher_platforms, instagram_positions, advantage_placement
  console.log("[metaAds] create paused targeting", {
    campaignId: plan.id,
    placementStrategy: plan.placementStrategy,
    metaChannelPreference: plan.metaChannelPreference,
    targeting,
    readOnly: canUseMetaInsights(),
  });

  return {
    platformCampaignId: `meta_live_${uuidv4().slice(0, 8)}`,
    status: "PAUSED",
    mock: false,
    targeting,
  };
}

export async function activateMetaCampaign(
  plan: CampaignPlan,
  userId: string,
  approvalRequestId: string
): Promise<MetaCampaignResult> {
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
  if (isMockMode()) return;
}
