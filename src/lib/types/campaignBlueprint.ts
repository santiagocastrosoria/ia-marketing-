export type CampaignBlueprintStatus =
  | "INTERNAL_DRAFT"
  | "READY_FOR_META_DRAFT"
  | "NEEDS_ASSETS"
  | "NEEDS_REVIEW"
  | "APPROVAL_REQUIRED";

/** Estados posibles tras una revisión profesional */
export type CampaignReviewStatus =
  | "READY_FOR_META_DRAFT"
  | "NEEDS_ASSETS"
  | "NEEDS_REVIEW"
  | "APPROVAL_REQUIRED";

export type CampaignGeneratorChannel =
  | "INSTAGRAM_PRIORITY"
  | "META_FULL"
  | "GOOGLE_FUTURE";

export type CampaignGeneratorGoal =
  | "WHATSAPP_LEADS"
  | "WEB_TRAFFIC"
  | "AWARENESS"
  | "REMARKETING";

export type LuxuryLevel = "premium" | "ultra_premium";

export interface CampaignGeneratorInput {
  productOffer: string;
  targetZone: string;
  dailyBudget: number;
  suggestedDurationDays: number;
  channelPreference: CampaignGeneratorChannel;
  campaignGoal: CampaignGeneratorGoal;
  luxuryLevel: LuxuryLevel;
  additionalNotes?: string;
  businessId?: string;
}

export interface BlueprintAdSet {
  name: string;
  placementFocus: string;
  optimizationGoal: string;
  dailyBudgetShare: number;
  placements: string[];
  audienceSummary: string;
}

export interface BlueprintAssetItem {
  item: string;
  format?: string;
  required: boolean;
  ready: boolean;
}

export interface MetaInsightsSnapshot {
  used: boolean;
  campaignCount: number;
  insightRowCount: number;
  topPlacements: Array<{
    channel: string;
    placement: string;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
  }>;
  priorCampaignNames: string[];
  note?: string;
}

export interface CampaignBlueprintProposal {
  campaignName: string;
  objective: string;
  metaObjective: string;
  funnelStage: string;
  structure: {
    platform: "META" | "GOOGLE_FUTURE";
    campaignType: string;
    budgetType: string;
    durationDays: number;
    totalBudgetEstimate: number;
  };
  adSets: BlueprintAdSet[];
  audiences: string[];
  locations: string[];
  placements: {
    instagramPositions: string[];
    facebookPositions: string[];
    placementStrategy: string;
    formats: string[];
  };
  budget: {
    dailyBudget: number;
    monthlyEstimate: number;
    allocationNotes: string;
  };
  calendar: {
    suggestedStart: string;
    suggestedEnd: string;
    phases: Array<{ label: string; focus: string }>;
  };
  creativeAngles: string[];
  copies: {
    headlines: string[];
    descriptions: string[];
    primaryText: string;
    stories: string[];
    reels: string[];
    feed: string[];
    cta: string;
  };
  visualRecommendations: string[];
  assetsChecklist: BlueprintAssetItem[];
  metaInsightsUsed: MetaInsightsSnapshot;
  brandContextUsed: boolean;
  brandVoice: string;
  recommendationSummary: string;
  readOnlyNotice: string;
}

export interface ReviewChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  note?: string;
}

export interface ReviewCriterionScore {
  id: string;
  label: string;
  score: number;
  summary: string;
}

export interface CampaignBlueprintReview {
  preparationScore: number;
  suggestedStatus: CampaignReviewStatus;
  checklist: ReviewChecklistItem[];
  criteria: ReviewCriterionScore[];
  recommendations: string[];
  reviewedAt: string;
}

export interface CampaignBlueprint {
  id: string;
  user_id: string;
  business_id: string;
  business_name?: string;
  input: CampaignGeneratorInput;
  proposal: CampaignBlueprintProposal;
  status: CampaignBlueprintStatus;
  review?: CampaignBlueprintReview;
  created_at: string;
}
