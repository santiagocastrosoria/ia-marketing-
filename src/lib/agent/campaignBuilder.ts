import { generateCopy } from "@/lib/agent/copywritingAgent";
import { generateSegmentation } from "@/lib/agent/segmentationAgent";
import {
  isMaldivasBrand,
  resolveMetaPlacements,
} from "@/lib/ads/metaPlacements";
import { buildCampaignUTM, appendUTM } from "@/lib/tracking/utmBuilder";
import type {
  Ad,
  AdGroup,
  AudienceTargeting,
  CampaignPlan,
  Keyword,
  MarketingObjective,
  Platform,
  StrategyPlan,
} from "@/lib/types/marketing";
import type { BrandKnowledgeContext } from "@/lib/types/brand";
import { v4 as uuidv4 } from "uuid";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function buildKeywords(
  strategy: StrategyPlan,
  platform: Platform
): Keyword[] {
  if (platform !== "GOOGLE") return [];

  return strategy.recommendedKeywords.map((text, i) => ({
    text,
    matchType: i < 5 ? "EXACT" as const : "PHRASE" as const,
    intent: i < 5 ? "high" as const : "medium" as const,
  }));
}

function buildAdGroups(
  objective: MarketingObjective,
  platform: Platform,
  campaignName: string,
  dailyBudget: number,
  strategy: StrategyPlan,
  brand?: BrandKnowledgeContext,
  prebuiltAudience?: AudienceTargeting
): AdGroup[] {
  const audience =
    prebuiltAudience ?? generateSegmentation(objective, platform, brand);
  const copy = generateCopy(objective, platform, brand);
  const landingUrl = objective.landing_url ?? "https://example.com";
  const whatsappUrl = objective.whatsapp_url;

  const utm = buildCampaignUTM(
    platform === "META" ? "meta" : "google",
    slugify(campaignName),
    "ad_v1"
  );

  const ad: Ad = {
    id: uuidv4(),
    name: `${campaignName} - Ad 1`,
    copy,
    landingUrl: appendUTM(landingUrl, utm),
    whatsappUrl,
    utm,
    status: "PAUSED",
    creativeType: objective.creative_types?.[0] ?? "image",
  };

  if (platform === "GOOGLE") {
    const keywords = buildKeywords(strategy, platform);
    const highIntent = keywords.filter((k) => k.intent === "high");
    const mediumIntent = keywords.filter((k) => k.intent !== "high");

    const groups: AdGroup[] = [];

    if (highIntent.length > 0) {
      groups.push({
        id: uuidv4(),
        name: "Alta intención",
        keywords: highIntent,
        negativeKeywords: strategy.negativeKeywords,
        matchTypes: ["EXACT", "PHRASE"],
        ads: [{ ...ad, id: uuidv4(), name: `${campaignName} - Alta intención` }],
        dailyBudget: Math.round(dailyBudget * 0.6),
        status: "PAUSED",
      });
    }

    if (mediumIntent.length > 0) {
      groups.push({
        id: uuidv4(),
        name: "Intención media",
        keywords: mediumIntent,
        negativeKeywords: strategy.negativeKeywords,
        matchTypes: ["PHRASE", "BROAD"],
        ads: [{ ...ad, id: uuidv4(), name: `${campaignName} - Media intención` }],
        dailyBudget: Math.round(dailyBudget * 0.4),
        status: "PAUSED",
      });
    }

    return groups.length > 0
      ? groups
      : [
          {
            id: uuidv4(),
            name: "Grupo principal",
            keywords,
            negativeKeywords: strategy.negativeKeywords,
            ads: [ad],
            dailyBudget,
            status: "PAUSED",
          },
        ];
  }

  return [
    {
      id: uuidv4(),
      name: "Ad Set Principal",
      audience,
      ads: [
        ad,
        {
          ...ad,
          id: uuidv4(),
          name: `${campaignName} - Ad 2`,
          copy: {
            ...copy,
            variants: copy.variants?.slice(1, 2),
          },
        },
      ],
      dailyBudget,
      status: "PAUSED",
    },
  ];
}

function buildMetaCampaign(
  objective: MarketingObjective,
  strategy: StrategyPlan,
  rec: StrategyPlan["recommendedCampaigns"][0],
  dailyBudget: number,
  brand?: BrandKnowledgeContext
): Omit<CampaignPlan, "id" | "created_at"> {
  const maldivas = isMaldivasBrand(
    objective.industry,
    objective.product,
    objective.goal
  );

  const channelPreference =
    objective.meta_channel_preference ??
    (maldivas ? "INSTAGRAM_PRIORITY" : "META_FULL");

  const resolved = resolveMetaPlacements({
    funnelStage: rec.funnelStage,
    channelPreference,
    placementStrategy: objective.placement_strategy,
    isMaldivas: maldivas,
  });

  const audience = generateSegmentation(objective, "META", brand, {
    funnelStage: rec.funnelStage,
    channelPreference,
    placementStrategy: resolved.placementStrategy,
    isMaldivas: maldivas,
  });

  const adGroups = buildAdGroups(
    objective,
    "META",
    rec.name,
    dailyBudget,
    strategy,
    brand,
    audience
  );
  const utm = buildCampaignUTM("meta", slugify(rec.name));

  const instagramNote = maldivas
    ? " Instagram prioritario: Reels/Stories para calentamiento visual; Feed/Stories para consultas WhatsApp; Facebook solo como apoyo."
    : channelPreference === "INSTAGRAM_PRIORITY" || channelPreference === "INSTAGRAM_ONLY"
      ? " Canal Instagram priorizado dentro de Meta Ads."
      : "";

  const premiumNote = maldivas
    ? " Mensajes aspiracionales premium — evitar campañas genéricas de muebles."
    : "";

  return {
    objective_id: objective.id,
    platform: "META",
    campaignName: rec.name,
    objective: rec.funnelStage === "LEADS" ? "OUTCOME_LEADS" : rec.funnelStage === "AWARENESS" ? "OUTCOME_AWARENESS" : "OUTCOME_TRAFFIC",
    funnelStage: rec.funnelStage,
    dailyBudget,
    monthlyBudgetEstimate: dailyBudget * 30,
    locationTargeting: objective.locations,
    audience,
    exclusions: audience.exclusions,
    placements: resolved.placements,
    publisherPlatforms: resolved.publisherPlatforms,
    instagramPositions: resolved.instagramPositions,
    facebookPositions: resolved.facebookPositions,
    placementStrategy: resolved.placementStrategy,
    metaChannelPreference: channelPreference,
    primaryChannel: resolved.primaryChannel,
    primaryPlacement: resolved.primaryPlacement,
    adGroups,
    ads: adGroups.flatMap((g) => g.ads),
    keywords: [],
    negativeKeywords: [],
    landingUrl: objective.landing_url ?? "",
    whatsappUrl: objective.whatsapp_url,
    trackingUTM: utm,
    status: "PAUSED",
    requiresApproval: true,
    riskLevel: dailyBudget > 200000 ? "MEDIUM" : "LOW",
    strategy_summary: `${rec.rationale}${instagramNote}${premiumNote}`,
  };
}

function buildGoogleCampaign(
  objective: MarketingObjective,
  strategy: StrategyPlan,
  rec: StrategyPlan["recommendedCampaigns"][0],
  dailyBudget: number,
  brand?: BrandKnowledgeContext
): Omit<CampaignPlan, "id" | "created_at"> {
  const audience = generateSegmentation(objective, "GOOGLE", brand);
  const adGroups = buildAdGroups(objective, "GOOGLE", rec.name, dailyBudget, strategy, brand);
  const keywords = buildKeywords(strategy, "GOOGLE");
  const utm = buildCampaignUTM("google", slugify(rec.name));

  return {
    objective_id: objective.id,
    platform: "GOOGLE",
    campaignName: rec.name,
    objective: rec.name.includes("Performance") ? "PERFORMANCE_MAX" : "SEARCH",
    funnelStage: rec.funnelStage,
    dailyBudget,
    monthlyBudgetEstimate: dailyBudget * 30,
    locationTargeting: objective.locations,
    audience,
    exclusions: audience.exclusions,
    placements: ["Google Search"],
    primaryChannel: "GOOGLE",
    primaryPlacement: "SEARCH",
    adGroups,
    ads: adGroups.flatMap((g) => g.ads),
    keywords,
    negativeKeywords: strategy.negativeKeywords,
    landingUrl: objective.landing_url ?? "",
    whatsappUrl: objective.whatsapp_url,
    trackingUTM: utm,
    status: "PAUSED",
    requiresApproval: true,
    riskLevel: dailyBudget > 200000 ? "MEDIUM" : "LOW",
    strategy_summary: rec.rationale,
  };
}

export function buildCampaignPlans(
  objective: MarketingObjective,
  strategy: StrategyPlan,
  brand?: BrandKnowledgeContext
): Omit<CampaignPlan, "id" | "created_at">[] {
  const plans: Omit<CampaignPlan, "id" | "created_at">[] = [];

  for (const rec of strategy.recommendedCampaigns) {
    const budgetEntry = strategy.budgetDistribution.find(
      (b) => b.platform === rec.platform
    );
    const platformBudget = budgetEntry?.dailyAmount ?? objective.daily_budget;
    const campaignCount = strategy.recommendedCampaigns.filter(
      (c) => c.platform === rec.platform
    ).length;
    const dailyBudget = Math.round(platformBudget / campaignCount);

    if (rec.platform === "META") {
      plans.push(buildMetaCampaign(objective, strategy, rec, dailyBudget, brand));
    } else {
      plans.push(buildGoogleCampaign(objective, strategy, rec, dailyBudget, brand));
    }
  }

  return plans;
}
