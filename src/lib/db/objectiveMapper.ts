import type { MarketingObjective } from "@/lib/types/marketing";
import {
  encodeMetaInRestrictions,
  decodeMetaFromRestrictions,
} from "@/lib/ads/metaObjectiveSettings";

/**
 * Columnas conocidas en marketing_objectives (schema.sql base).
 * meta_channel_preference / placement_strategy requieren migración opcional.
 */
export type ObjectiveDbInsert = {
  business_id: string;
  goal: string;
  product: string;
  daily_budget: number;
  monthly_budget?: number | null;
  locations: string[];
  platforms: string;
  ideal_customer: string;
  average_ticket?: number | null;
  brand_awareness_level: string;
  landing_url?: string | null;
  whatsapp_url?: string | null;
  creative_types?: string[] | null;
  restrictions?: string | null;
  industry?: string | null;
  status?: string;
};

export function toObjectiveDbRow(
  data: Omit<MarketingObjective, "id" | "created_at" | "status">
): ObjectiveDbInsert {
  return {
    business_id: data.business_id,
    goal: data.goal,
    product: data.product ?? "",
    daily_budget: data.daily_budget,
    monthly_budget: data.monthly_budget ?? null,
    locations: Array.isArray(data.locations) ? data.locations : [],
    platforms: data.platforms,
    ideal_customer: data.ideal_customer,
    average_ticket: data.average_ticket ?? null,
    brand_awareness_level: data.brand_awareness_level ?? "medium",
    landing_url: data.landing_url ?? null,
    whatsapp_url: data.whatsapp_url ?? null,
    creative_types: data.creative_types ?? null,
    restrictions: data.restrictions ?? null,
    industry: data.industry ?? null,
    status: "DRAFT",
  };
}

/** Payload API (camelCase) → fila DB (snake_case) */
export function fromCreateObjectiveBody(
  businessId: string,
  body: {
    goal: string;
    product: string;
    dailyBudget: number;
    monthlyBudget?: number;
    locations: string[];
    platforms: string;
    idealCustomer: string;
    averageTicket?: number;
    brandAwarenessLevel: string;
    landingUrl?: string;
    whatsappUrl?: string;
    creativeTypes?: string[];
    restrictions?: string;
    industry?: string;
    metaChannelPreference?: string;
    placementStrategy?: string;
  }
): ObjectiveDbInsert {
  const metaSettings = {
    metaChannelPreference: body.metaChannelPreference as MarketingObjective["meta_channel_preference"],
    placementStrategy: body.placementStrategy as MarketingObjective["placement_strategy"],
  };

  return toObjectiveDbRow({
    business_id: businessId,
    goal: body.goal,
    product: body.product,
    daily_budget: Number(body.dailyBudget),
    monthly_budget: body.monthlyBudget != null ? Number(body.monthlyBudget) : undefined,
    locations: body.locations,
    platforms: body.platforms as MarketingObjective["platforms"],
    ideal_customer: body.idealCustomer,
    average_ticket: body.averageTicket != null ? Number(body.averageTicket) : undefined,
    brand_awareness_level: body.brandAwarenessLevel as MarketingObjective["brand_awareness_level"],
    landing_url: body.landingUrl,
    whatsapp_url: body.whatsappUrl,
    creative_types: body.creativeTypes as MarketingObjective["creative_types"],
    restrictions: encodeMetaInRestrictions(body.restrictions, metaSettings),
    industry: body.industry,
    meta_channel_preference: metaSettings.metaChannelPreference,
    placement_strategy: metaSettings.placementStrategy,
  });
}

export function hydrateObjectiveFromRow(
  row: MarketingObjective
): MarketingObjective {
  const fromRestrictions = decodeMetaFromRestrictions(row.restrictions);
  const restrictions = row.restrictions
    ? row.restrictions.replace(/\[meta_settings:[^\]]+\]/, "").trim()
    : undefined;

  return {
    ...row,
    restrictions: restrictions || undefined,
    meta_channel_preference:
      row.meta_channel_preference ?? fromRestrictions.metaChannelPreference,
    placement_strategy:
      row.placement_strategy ?? fromRestrictions.placementStrategy,
  };
}
