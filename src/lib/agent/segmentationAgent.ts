import type {
  AudienceTargeting,
  FunnelStage,
  MarketingObjective,
  MetaChannelPreference,
  PlacementStrategy,
  Platform,
} from "@/lib/types/marketing";
import type { BrandKnowledgeContext } from "@/lib/types/brand";
import {
  isMaldivasBrand,
  resolveMetaPlacements,
} from "@/lib/ads/metaPlacements";

export function generateMetaSegmentation(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext,
  options?: {
    funnelStage?: FunnelStage;
    channelPreference?: MetaChannelPreference;
    placementStrategy?: PlacementStrategy;
    isMaldivas?: boolean;
  }
): AudienceTargeting {
  const isPremium =
    (objective.average_ticket ?? 0) > 500000 ||
    objective.product.toLowerCase().includes("premium") ||
    (brand?.positioning?.toLowerCase().includes("premium") ?? false);

  const maldivas =
    options?.isMaldivas ??
    isMaldivasBrand(objective.industry, objective.product);

  const channelPreference =
    options?.channelPreference ??
    objective.meta_channel_preference ??
    (maldivas ? "INSTAGRAM_PRIORITY" : "META_FULL");

  const funnelStage = options?.funnelStage ?? "LEADS";

  const resolved = resolveMetaPlacements({
    funnelStage,
    channelPreference,
    placementStrategy: options?.placementStrategy ?? objective.placement_strategy,
    isMaldivas: maldivas,
  });

  const interests = isPremium
    ? [
        "Diseño de interiores",
        "Arquitectura",
        "Jardinería y paisajismo",
        "Outdoor living",
        "Piscinas y spas",
        "Decoración de lujo",
        "Mobiliario de diseño",
        ...(maldivas ? ["Instagram — lifestyle premium", "Terrazas y exteriores"] : []),
      ]
    : ["Muebles", "Hogar y jardín", "Decoración"];

  const behaviors = isPremium
    ? [
        "Compradores de alto valor",
        "Propietarios de viviendas",
        "Viajeros frecuentes",
      ]
    : ["Compradores online activos"];

  const exclusions = [
    ...(brand?.forbiddenWords.map((w) => `Excluir: ${w}`) ?? []),
    "Interesados en muebles usados",
    "Búsqueda de ofertas y descuentos",
    "DIY y bricolaje low-cost",
    ...(objective.restrictions?.includes("barato") ? ["Compradores de precio bajo"] : []),
  ];

  if (isPremium || maldivas) {
    exclusions.push(
      "Muebles de interior genéricos",
      "Electrodomésticos",
      "Ikea y retail masivo"
    );
  }

  return {
    locations: brand?.locations?.length ? brand.locations : objective.locations,
    ageMin: isPremium ? 30 : 25,
    ageMax: isPremium ? 65 : 60,
    interests,
    behaviors,
    customAudiences: objective.brand_awareness_level !== "new"
      ? ["Visitantes del sitio web (30 días)", "Engagers de Instagram"]
      : [],
    lookalikes:
      objective.brand_awareness_level === "strong"
        ? ["Lookalike 1% - Clientes existentes"]
        : [],
    exclusions,
    placements: resolved.placements,
  };
}

export function generateGoogleSegmentation(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext
): AudienceTargeting {
  return {
    locations: brand?.locations?.length ? brand.locations : objective.locations,
    ageMin: 25,
    ageMax: 65,
    interests: [
      "In-market: Home & Garden",
      "In-market: Furniture",
      ...(objective.average_ticket && objective.average_ticket > 500000
        ? ["Affinity: Luxury Shoppers", "Affinity: Home Design Enthusiasts"]
        : []),
    ],
    behaviors: ["Propietarios de vivienda"],
    customAudiences: [],
    lookalikes: [],
    exclusions: [
      "Búsquedas de empleo",
      "Tutoriales y DIY",
      "Productos usados",
    ],
    placements: ["Google Search", "Google Display (remarketing only)"],
  };
}

export function generateSegmentation(
  objective: MarketingObjective,
  platform: Platform,
  brand?: BrandKnowledgeContext,
  metaOptions?: {
    funnelStage?: FunnelStage;
    channelPreference?: MetaChannelPreference;
    placementStrategy?: PlacementStrategy;
    isMaldivas?: boolean;
  }
): AudienceTargeting {
  return platform === "META"
    ? generateMetaSegmentation(objective, brand, metaOptions)
    : generateGoogleSegmentation(objective, brand);
}
