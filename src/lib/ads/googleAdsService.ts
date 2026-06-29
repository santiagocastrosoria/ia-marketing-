import { checkApprovalGate, ApprovalGateError } from "@/lib/approvals/approvalGate";
import { assertReadOnlyModeAllows } from "@/lib/ads/adsModeGuard";
import { isMockMode } from "@/lib/utils/config";
import type { CampaignPlan, ProposedAction } from "@/lib/types/marketing";
import { v4 as uuidv4 } from "uuid";

export interface GoogleCampaignResult {
  platformCampaignId: string;
  status: "PAUSED" | "DRAFT";
  mock: boolean;
}

export async function createGoogleCampaignPaused(
  plan: CampaignPlan,
  userId: string
): Promise<GoogleCampaignResult> {
  assertReadOnlyModeAllows("CREATE_CAMPAIGN");

  const action: ProposedAction = {
    type: "CREATE_ACTIVE_CAMPAIGN",
    entityType: "campaign_plan",
    entityId: plan.id,
    payload: { platform: "GOOGLE", plan },
    proposedBudget: plan.dailyBudget,
    platform: "GOOGLE",
  };

  if (plan.status === "ACTIVE") {
    const gate = await checkApprovalGate(action, userId);
    if (!gate.allowed) {
      throw new ApprovalGateError(
        "No se puede crear campaña ENABLED sin aprobación.",
        "APPROVAL_REQUIRED"
      );
    }
  }

  if (isMockMode()) {
    return {
      platformCampaignId: `google_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
    };
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!developerToken || !customerId) {
    return {
      platformCampaignId: `google_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
    };
  }

  // Future: Google Ads API integration
  // Create campaign with status: PAUSED
  // NEVER set status: ENABLED without approval

  return {
    platformCampaignId: `google_live_${uuidv4().slice(0, 8)}`,
    status: "PAUSED",
    mock: false,
  };
}

export async function activateGoogleCampaign(
  plan: CampaignPlan,
  userId: string,
  approvalRequestId: string
): Promise<GoogleCampaignResult> {
  assertReadOnlyModeAllows("ACTIVATE_CAMPAIGN");

  const action: ProposedAction = {
    type: "ACTIVATE_CAMPAIGN",
    entityType: "campaign_plan",
    entityId: plan.id,
    payload: {
      platform: "GOOGLE",
      platformCampaignId: plan.platform_campaign_id,
      newStatus: "ENABLED",
    },
    proposedBudget: plan.dailyBudget,
    platform: "GOOGLE",
  };

  const gate = await checkApprovalGate(action, userId, { approvalRequestId });
  if (!gate.allowed) {
    throw new ApprovalGateError(gate.reason, "NOT_APPROVED");
  }

  if (isMockMode() || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return {
      platformCampaignId: plan.platform_campaign_id ?? `google_mock_${uuidv4().slice(0, 8)}`,
      status: "PAUSED",
      mock: true,
    };
  }

  // Future: Google Ads API enable campaign only after approval
  return {
    platformCampaignId: plan.platform_campaign_id!,
    status: "PAUSED",
    mock: false,
  };
}

export async function pauseGoogleCampaign(
  platformCampaignId: string
): Promise<void> {
  assertReadOnlyModeAllows("PAUSE_CAMPAIGN");
  if (isMockMode()) return;
  // Future: Google Ads API pause
}
