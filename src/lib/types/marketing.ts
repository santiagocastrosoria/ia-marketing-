// Campaign & entity statuses
export type EntityStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "ACTIVE"
  | "ARCHIVED";

export type Platform = "META" | "GOOGLE";
export type Platforms = Platform | "BOTH";

export type FunnelStage =
  | "AWARENESS"
  | "TRAFFIC"
  | "LEADS"
  | "SALES"
  | "REMARKETING";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type BrandAwarenessLevel = "new" | "medium" | "strong";

export type ActionType =
  | "ACTIVATE_CAMPAIGN"
  | "ACTIVATE_AD_SET"
  | "ACTIVATE_AD"
  | "INCREASE_BUDGET"
  | "CREATE_ACTIVE_CAMPAIGN"
  | "CHANGE_STATUS_TO_ACTIVE"
  | "CHANGE_BID_AGGRESSIVE"
  | "CHANGE_CONVERSION_GOAL"
  | "CHANGE_LANDING_URL"
  | "ADD_SPENDING_CAMPAIGN"
  | "APPLY_RECOMMENDATION";

export type RecommendationType =
  | "PAUSE_AD"
  | "DUPLICATE_WINNER"
  | "NEW_COPY_VARIANT"
  | "CHANGE_AUDIENCE"
  | "ADD_NEGATIVE_KEYWORDS"
  | "SPLIT_BY_ZONE"
  | "CHANGE_BUDGET"
  | "CREATE_REMARKETING"
  | "CREATE_SEARCH"
  | "CREATE_WARMUP"
  | "IMPROVE_LANDING"
  | "CHANGE_CTA"
  | "FILTER_LEADS"
  | "IMPROVE_TRACKING";

export type CreativeType =
  | "image"
  | "video"
  | "catalog"
  | "web"
  | "instagram";

/** Preferencia de canal dentro de Meta Ads */
export type MetaChannelPreference =
  | "META_FULL"
  | "INSTAGRAM_PRIORITY"
  | "FACEBOOK_PRIORITY"
  | "INSTAGRAM_ONLY";

/** Estrategia de placements en Meta */
export type PlacementStrategy =
  | "ADVANTAGE_PLUS"
  | "MANUAL_INSTAGRAM_FOCUS"
  | "MANUAL_ALL_META";

export type MetaPublisherPlatform =
  | "facebook"
  | "instagram"
  | "audience_network"
  | "messenger";

/** Valores API de instagram_positions */
export type InstagramPosition =
  | "stream"
  | "story"
  | "reels"
  | "explore"
  | "profile_feed";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  website_url?: string;
  whatsapp_number?: string;
  instagram_url?: string;
  default_location?: string;
  created_at: string;
}

export interface MarketingObjective {
  id: string;
  business_id: string;
  goal: string;
  product: string;
  daily_budget: number;
  monthly_budget?: number;
  locations: string[];
  platforms: Platforms;
  ideal_customer: string;
  average_ticket?: number;
  brand_awareness_level: BrandAwarenessLevel;
  landing_url?: string;
  whatsapp_url?: string;
  creative_types?: CreativeType[];
  restrictions?: string;
  industry?: string;
  meta_channel_preference?: MetaChannelPreference;
  placement_strategy?: PlacementStrategy;
  status: EntityStatus;
  created_at: string;
}

export interface UTMParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
}

export interface AdCopy {
  headlines: string[];
  descriptions: string[];
  primaryText?: string;
  cta: string;
  variants?: { headline: string; description: string; primaryText?: string }[];
}

export interface AdGroup {
  id: string;
  name: string;
  audience?: AudienceTargeting;
  keywords?: Keyword[];
  negativeKeywords?: string[];
  matchTypes?: string[];
  ads: Ad[];
  dailyBudget?: number;
  status: EntityStatus;
}

export interface Ad {
  id: string;
  name: string;
  copy: AdCopy;
  landingUrl: string;
  whatsappUrl?: string;
  utm: UTMParams;
  status: EntityStatus;
  creativeType?: CreativeType;
}

export interface AudienceTargeting {
  locations: string[];
  ageMin?: number;
  ageMax?: number;
  interests: string[];
  behaviors?: string[];
  customAudiences?: string[];
  lookalikes?: string[];
  exclusions: string[];
  placements?: string[];
}

export interface Keyword {
  text: string;
  matchType: "EXACT" | "PHRASE" | "BROAD";
  intent?: "high" | "medium" | "low";
}

export interface CampaignPlan {
  id: string;
  objective_id: string;
  platform: Platform;
  campaignName: string;
  objective: string;
  funnelStage: FunnelStage;
  dailyBudget: number; /** Siempre en ARS (pesos argentinos) */
  monthlyBudgetEstimate: number; /** Siempre en ARS, dailyBudget * 30 */
  locationTargeting: string[];
  audience: AudienceTargeting;
  exclusions: string[];
  placements: string[];
  /** Meta: publisher_platforms para API */
  publisherPlatforms?: MetaPublisherPlatform[];
  /** Meta: instagram_positions para API */
  instagramPositions?: InstagramPosition[];
  /** Meta: estrategia de placement */
  placementStrategy?: PlacementStrategy;
  /** Preferencia de canal UI */
  metaChannelPreference?: MetaChannelPreference;
  adGroups: AdGroup[];
  ads: Ad[];
  keywords: Keyword[];
  negativeKeywords: string[];
  landingUrl: string;
  whatsappUrl?: string;
  trackingUTM: UTMParams;
  status: EntityStatus;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  strategy_summary?: string;
  platform_campaign_id?: string;
  created_at: string;
}

export interface StrategyPlan {
  id: string;
  objective_id: string;
  diagnosis: string;
  recommendedFunnelStage: FunnelStage;
  warmupVsConversion: "warmup" | "conversion" | "hybrid";
  budgetDistribution: { platform: Platform; percentage: number; dailyAmount: number }[];
  recommendedCampaigns: { name: string; platform: Platform; funnelStage: FunnelStage; rationale: string }[];
  recommendedAudiences: string[];
  recommendedKeywords: string[];
  negativeKeywords: string[];
  requiredCreatives: CreativeType[];
  mainMessages: string[];
  ctas: string[];
  keyMetrics: string[];
  successCriteria: string[];
  optimizationPlan: {
    day7: string[];
    day14: string[];
    day30: string[];
  };
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  campaign_plan_id: string;
  action_type: ActionType;
  action_payload: Record<string, unknown>;
  reason: string;
  risk_level: RiskLevel;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approved_by?: string;
  approved_at?: string;
  rejected_at?: string;
  created_at: string;
  campaign_plan?: CampaignPlan;
}

export interface CampaignMetrics {
  id: string;
  campaign_plan_id: string;
  platform_campaign_id?: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cpm: number;
  leads: number;
  cpl: number;
  conversions: number;
  conversion_rate: number;
  lead_quality_score: number;
  raw_metrics_json?: Record<string, unknown>;
  created_at: string;
}

export interface Recommendation {
  id: string;
  campaign_plan_id: string;
  type: RecommendationType;
  title: string;
  description: string;
  reason: string;
  supporting_metrics_json: Record<string, unknown>;
  expected_impact: "LOW" | "MEDIUM" | "HIGH";
  risk_level: RiskLevel;
  requires_approval: boolean;
  status: "PENDING" | "APPLIED" | "DISMISSED";
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ApiConnection {
  id: string;
  business_id: string;
  platform: Platform;
  account_id?: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  status: "connected" | "disconnected" | "mock";
  created_at: string;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  pendingApprovals: number;
  dailySpendConfigured: number;
  totalLeads: number;
  avgCpl: number;
  avgCtr: number;
  avgCpc: number;
  recommendations: Recommendation[];
}

export interface CreateObjectiveInput {
  businessName: string;
  industry: string;
  product: string;
  goal: string;
  dailyBudget: number;
  monthlyBudget?: number;
  locations: string[];
  platforms: Platforms;
  idealCustomer: string;
  averageTicket?: number;
  brandAwarenessLevel: BrandAwarenessLevel;
  landingUrl?: string;
  whatsappUrl?: string;
  creativeTypes?: CreativeType[];
  restrictions?: string;
  metaChannelPreference?: MetaChannelPreference;
  placementStrategy?: PlacementStrategy;
}

export interface ProposedAction {
  type: ActionType;
  entityType: string;
  entityId: string;
  /** ID de campaign_plan para approval_requests (si difiere de entityId) */
  campaignPlanId?: string;
  payload: Record<string, unknown>;
  currentBudget?: number;
  proposedBudget?: number;
  platform?: Platform;
}

export interface MetricsAnalysis {
  summary: string;
  insights: { metric: string; diagnosis: string; severity: RiskLevel }[];
  recommendations: Omit<Recommendation, "id" | "campaign_plan_id" | "status" | "created_at">[];
  placementInsights?: {
    simulated: boolean;
    instagramVsFacebook?: string;
    reelsVsStoriesVsFeed?: string;
    topPlacement?: string;
  };
}
