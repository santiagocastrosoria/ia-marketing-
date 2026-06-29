import type {
  BrandAwarenessLevel,
  FunnelStage,
  MarketingObjective,
  Platform,
  Platforms,
  StrategyPlan,
} from "@/lib/types/marketing";
import type { BrandKnowledgeContext } from "@/lib/types/brand";
import {
  MALDIVAS_KEYWORDS,
  MALDIVAS_NEGATIVE_KEYWORDS,
} from "@/lib/utils/presets";
import { formatARS } from "@/lib/utils/formatARS";
import {
  isMaldivasBrand,
  defaultMetaChannelForBusiness,
} from "@/lib/ads/metaPlacements";

/** Umbrales de presupuesto diario en ARS */
const ARS_THRESHOLDS = {
  DEMO_MAX: 1000,
  LIMITED_MAX: 10000,
  MODERATE_MAX: 50000,
  STRONG_MAX: 150000,
} as const;

function getBudgetTier(dailyBudgetARS: number) {
  if (dailyBudgetARS < ARS_THRESHOLDS.DEMO_MAX) return "demo" as const;
  if (dailyBudgetARS < ARS_THRESHOLDS.LIMITED_MAX) return "limited" as const;
  if (dailyBudgetARS < ARS_THRESHOLDS.MODERATE_MAX) return "moderate" as const;
  if (dailyBudgetARS < ARS_THRESHOLDS.STRONG_MAX) return "strong" as const;
  return "premium" as const;
}

function isPremiumProduct(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext
): boolean {
  const text = `${brand?.positioning ?? ""} ${objective.product} ${objective.goal} ${brand?.idealCustomer ?? objective.ideal_customer}`.toLowerCase();
  return (
    text.includes("premium") ||
    text.includes("lujo") ||
    text.includes("alta gama") ||
    (objective.average_ticket ?? 0) > 500000
  );
}

function isWhatsAppGoal(objective: MarketingObjective): boolean {
  return objective.goal.toLowerCase().includes("whatsapp");
}

function shouldWarmup(brandLevel: BrandAwarenessLevel): boolean {
  return brandLevel === "new" || brandLevel === "medium";
}

function getBudgetSplit(
  platforms: Platforms,
  dailyBudgetARS: number,
  isPremium: boolean,
  tier: ReturnType<typeof getBudgetTier>
): StrategyPlan["budgetDistribution"] {
  if (platforms === "META") {
    return [{ platform: "META", percentage: 100, dailyAmount: dailyBudgetARS }];
  }
  if (platforms === "GOOGLE") {
    return [{ platform: "GOOGLE", percentage: 100, dailyAmount: dailyBudgetARS }];
  }

  if (tier === "demo" || tier === "limited") {
    return [
      {
        platform: "GOOGLE",
        percentage: 100,
        dailyAmount: dailyBudgetARS,
      },
    ];
  }

  if (isPremium || tier === "strong" || tier === "premium") {
    return [
      { platform: "GOOGLE", percentage: 55, dailyAmount: Math.round(dailyBudgetARS * 0.55) },
      { platform: "META", percentage: 45, dailyAmount: Math.round(dailyBudgetARS * 0.45) },
    ];
  }

  return [
    { platform: "META", percentage: 50, dailyAmount: Math.round(dailyBudgetARS * 0.5) },
    { platform: "GOOGLE", percentage: 50, dailyAmount: Math.round(dailyBudgetARS * 0.5) },
  ];
}

export function generateStrategy(
  objective: MarketingObjective,
  brandKnowledge?: BrandKnowledgeContext
): Omit<StrategyPlan, "id" | "created_at"> {
  const isPremium = isPremiumProduct(objective, brandKnowledge);
  const whatsapp = isWhatsAppGoal(objective);
  const warmup = shouldWarmup(objective.brand_awareness_level);
  const dailyBudgetARS = objective.daily_budget;
  const budgetTier = getBudgetTier(dailyBudgetARS);
  const lowBudget = budgetTier === "demo" || budgetTier === "limited";

  const warmupVsConversion: StrategyPlan["warmupVsConversion"] = warmup
    ? objective.brand_awareness_level === "new"
      ? "warmup"
      : "hybrid"
    : "conversion";

  const recommendedFunnelStage: FunnelStage = whatsapp
    ? "LEADS"
    : warmup
      ? "AWARENESS"
      : "SALES";

  const diagnosis = buildDiagnosis(
    objective,
    isPremium,
    warmup,
    budgetTier,
    whatsapp,
    brandKnowledge
  );
  const instagramStrategyNotes = buildInstagramStrategyNotes(
    objective,
    isPremium,
    warmup,
    whatsapp,
    brandKnowledge
  );
  const budgetDistribution = getBudgetSplit(
    objective.platforms,
    dailyBudgetARS,
    isPremium,
    budgetTier
  );

  const recommendedCampaigns = buildRecommendedCampaigns(
    objective,
    isPremium,
    warmup,
    whatsapp,
    budgetTier
  );

  const keywords =
    brandKnowledge?.suggestedKeywords?.length
      ? brandKnowledge.suggestedKeywords.slice(0, 20)
      : objective.industry?.toLowerCase().includes("exterior")
        ? MALDIVAS_KEYWORDS
        : generateGenericKeywords(objective);

  const negativeKeywords =
    brandKnowledge?.negativeKeywords?.length
      ? brandKnowledge.negativeKeywords
      : objective.industry?.toLowerCase().includes("exterior")
        ? MALDIVAS_NEGATIVE_KEYWORDS
        : generateGenericNegativeKeywords(objective, brandKnowledge);

  return {
    objective_id: objective.id,
    diagnosis,
    recommendedFunnelStage,
    warmupVsConversion,
    budgetDistribution,
    recommendedCampaigns,
    recommendedAudiences: buildAudiences(objective, isPremium, brandKnowledge),
    recommendedKeywords: keywords,
    negativeKeywords,
    requiredCreatives: objective.creative_types ?? ["image", "video"],
    mainMessages: buildMainMessages(objective, isPremium, whatsapp, brandKnowledge),
    ctas: buildCtas(whatsapp, brandKnowledge),
    keyMetrics: [
      "CPL (costo por lead)",
      "Calidad de lead",
      "CTR",
      "Tasa de conversión",
      "CPC",
      isPremium ? "Ticket promedio estimado" : "Volumen de leads",
    ],
    successCriteria: buildSuccessCriteria(objective, isPremium),
    optimizationPlan: {
      day7: [
        "Revisar CTR y relevancia de anuncios",
        "Verificar tracking de UTMs y conversiones",
        "Pausar variantes con CTR < 0.8%",
        "Validar calidad inicial de leads",
        "Comparar rendimiento Instagram Reels vs Stories vs Feed",
      ],
      day14: [
        "Separar rendimiento por zona geográfica",
        "Agregar keywords negativas según búsquedas irrelevantes",
        "Duplicar anuncios ganadores en nuevas variantes pausadas",
        warmup ? "Evaluar si hay datos suficientes para remarketing" : "Escalar campañas ganadoras (con aprobación)",
        "Priorizar placements Instagram que convierten a WhatsApp",
      ],
      day30: [
        "Optimizar distribución de presupuesto por plataforma",
        "Crear campañas de remarketing si hay audiencia suficiente",
        "Refinar mensajes filtradores para mejorar calidad de lead",
        "Documentar CPL por zona y ajustar segmentación",
        "Evaluar Facebook solo como complemento si Instagram supera CPL objetivo",
      ],
    },
    instagramStrategyNotes,
  };
}

function buildDiagnosis(
  objective: MarketingObjective,
  isPremium: boolean,
  warmup: boolean,
  tier: ReturnType<typeof getBudgetTier>,
  whatsapp: boolean,
  brand?: BrandKnowledgeContext
): string {
  const parts: string[] = [];
  const dailyBudgetARS = objective.daily_budget;

  if (brand?.positioning) {
    parts.push(`Posicionamiento de marca: ${brand.positioning}`);
  }

  parts.push(
    `Con un presupuesto diario de ${formatARS(dailyBudgetARS)}, recomendamos una estrategia acorde al mercado argentino.`
  );

  if (tier === "demo") {
    parts.push(
      `⚠ Presupuesto muy bajo (${formatARS(dailyBudgetARS)}). Recomendamos modo aprendizaje/demo — no alcanza para campañas reales en Argentina. Si quisiste cargar ${formatARS(150000)}, escribí 150000.`
    );
  } else if (tier === "limited") {
    parts.push(
      `Presupuesto limitado (${formatARS(dailyBudgetARS)}). Recomendamos 1 campaña simple sin fragmentar el gasto.`
    );
  } else if (tier === "moderate") {
    parts.push(
      `Presupuesto moderado (${formatARS(dailyBudgetARS)}). Recomendamos 1 o 2 campañas enfocadas.`
    );
  } else if (tier === "strong") {
    parts.push(
      `Con ${formatARS(dailyBudgetARS)} por día, recomendamos dividir entre Google Search de alta intención y Meta Ads para calentamiento/remarketing.`
    );
  } else {
    parts.push(
      `Presupuesto sólido (${formatARS(dailyBudgetARS)}). Podemos activar estrategia completa: calentamiento, búsqueda, WhatsApp y remarketing.`
    );
  }

  if (isPremium) {
    parts.push(
      "Producto premium detectado: priorizar calidad de lead sobre volumen. No competir por precio."
    );
  }

  if (warmup) {
    parts.push(
      "La marca requiere calentamiento antes de conversión agresiva. Recomendamos contenido visual y awareness."
    );
  } else {
    parts.push(
      "Marca con reconocimiento suficiente para campañas de conversión directa y remarketing."
    );
  }

  if (tier === "demo" || tier === "limited") {
    parts.push(
      "Presupuesto acotado: evitar fragmentar en demasiadas campañas. Máximo 1-2 campañas activas."
    );
  }

  if (whatsapp) {
    parts.push(
      "Objetivo WhatsApp: usar mensajes filtradores ('premium', 'a medida', 'proyectos exclusivos') para evitar leads de bajo valor."
    );
  }

  const metaChannel =
    objective.meta_channel_preference ??
    defaultMetaChannelForBusiness(objective.industry, objective.industry, objective.product);

  if (
    metaChannel === "INSTAGRAM_PRIORITY" ||
    metaChannel === "INSTAGRAM_ONLY" ||
    isMaldivasBrand(objective.industry, objective.product, objective.goal)
  ) {
    parts.push(
      "Instagram es el canal prioritario dentro de Meta Ads: contenido visual aspiracional, Reels y Stories para calentamiento, Feed y Stories para consultas por WhatsApp."
    );
    parts.push(
      "Facebook cumple rol complementario (Feed de apoyo). Google Search captura búsquedas de alta intención cuando el presupuesto lo permite."
    );
  }

  if (objective.locations.length > 1) {
    parts.push(
      "Múltiples zonas detectadas: diferenciar estrategia entre Córdoba (menor CPL) y Buenos Aires (mayor CPL pero mejor ticket en productos premium)."
    );
  }

  if (brand?.differentiators) {
    parts.push(`Diferenciales clave: ${brand.differentiators}`);
  }

  if (brand && !brand.isComplete) {
    parts.push(
      "Nota: la base de conocimiento de marca está incompleta. Completala para mejorar copies y segmentación."
    );
  }

  return parts.join(" ");
}

function buildInstagramStrategyNotes(
  objective: MarketingObjective,
  isPremium: boolean,
  warmup: boolean,
  whatsapp: boolean,
  brand?: BrandKnowledgeContext
): string[] {
  const maldivas = isMaldivasBrand(
    objective.industry,
    objective.product,
    objective.goal
  );
  const usesInstagram =
    maldivas ||
    objective.meta_channel_preference === "INSTAGRAM_PRIORITY" ||
    objective.meta_channel_preference === "INSTAGRAM_ONLY" ||
    objective.meta_channel_preference === "FACEBOOK_COMPLEMENT" ||
    objective.platforms !== "GOOGLE";

  if (!usesInstagram) return [];

  const notes: string[] = [
    "Instagram es prioritario porque el producto es visual, aspiracional y se decide con inspiración (Reels, Stories, galerías, lifestyle outdoor).",
  ];

  if (warmup || maldivas) {
    notes.push(
      "Calentamiento en Instagram: Reels y Stories con lifestyle, exteriores, piletas y casas premium — sin mensajes genéricos de muebles."
    );
  }

  if (whatsapp) {
    notes.push(
      "Consultas por WhatsApp: Instagram Feed y Stories con CTA directo a WhatsApp y copy filtrador premium (presupuesto, a medida, proyectos exclusivos)."
    );
  }

  notes.push(
    "Remarketing en Instagram: reimpactar interacciones de Instagram, visitantes web y personas que abrieron WhatsApp — solo con datos suficientes."
  );
  notes.push(
    "Facebook complementario: usar Feed de apoyo cuando Instagram ya validó creatividades; no como canal principal."
  );

  if (objective.platforms === "BOTH" || objective.platforms === "GOOGLE") {
    notes.push(
      "Google Search: menor volumen pero mayor intención directa — ideal para captar búsquedas como 'muebles exterior premium' o 'reposeras pileta'."
    );
  }

  if (maldivas) {
    notes.push(
      "Maldivas Outdoor: Reels para lifestyle premium; Feed/Stories para leads WhatsApp; remarketing sobre web + Instagram; Facebook solo de apoyo."
    );
  }

  if (isPremium && brand?.positioning) {
    notes.push(`Posicionamiento visual en Instagram: ${brand.positioning}`);
  }

  return notes;
}

function buildRecommendedCampaigns(
  objective: MarketingObjective,
  isPremium: boolean,
  warmup: boolean,
  whatsapp: boolean,
  tier: ReturnType<typeof getBudgetTier>
) {
  const campaigns: StrategyPlan["recommendedCampaigns"] = [];
  const allowBothPlatforms = tier !== "demo" && tier !== "limited";
  const allowRemarketing = tier === "strong" || tier === "premium";
  const allowPerformanceMax = tier === "premium" && isPremium;

  if (objective.platforms === "GOOGLE" || (objective.platforms === "BOTH" && allowBothPlatforms) || objective.platforms === "BOTH") {
    campaigns.push({
      name: "Search - Alta intención",
      platform: "GOOGLE",
      funnelStage: "LEADS",
      rationale:
        "Capturar demanda existente con keywords de intención directa en Google Search.",
    });
  }

  if (tier === "demo" || tier === "limited") {
    return campaigns.length > 0
      ? campaigns
      : [
          {
            name: "Demo - Campaña única",
            platform: (objective.platforms === "GOOGLE" ? "GOOGLE" : "META") as Platform,
            funnelStage: "LEADS" as FunnelStage,
            rationale: "Una sola campaña por presupuesto limitado en ARS.",
          },
        ];
  }

  if (objective.platforms === "META" || objective.platforms === "BOTH") {
    const maldivas = isMaldivasBrand(
      objective.industry,
      objective.product,
      objective.goal
    );
    const igPriority =
      maldivas ||
      objective.meta_channel_preference === "INSTAGRAM_PRIORITY" ||
      objective.meta_channel_preference === "INSTAGRAM_ONLY";

    if (warmup) {
      campaigns.push({
        name: igPriority
          ? "Instagram - Calentamiento Reels/Stories"
          : "Meta - Calentamiento / Awareness",
        platform: "META",
        funnelStage: "AWARENESS",
        rationale: igPriority
          ? "Awareness visual premium en Instagram Reels y Stories — lifestyle outdoor, piletas y galerías."
          : "Generar reconocimiento de marca con contenido visual premium antes de conversión.",
      });
    }

    campaigns.push({
      name: whatsapp
        ? igPriority
          ? "Instagram - Leads WhatsApp Feed/Stories"
          : "Meta - Leads WhatsApp"
        : igPriority
          ? "Instagram - Tráfico / Conversión"
          : "Meta - Tráfico / Conversión",
      platform: "META",
      funnelStage: whatsapp ? "LEADS" : "TRAFFIC",
      rationale: whatsapp
        ? igPriority
          ? "Consultas calificadas por WhatsApp desde Instagram Feed y Stories con mensajes premium."
          : "Generar consultas calificadas por WhatsApp con segmentación premium."
        : "Dirigir tráfico calificado a landing con contenido visual aspiracional.",
    });

    if (!warmup && allowRemarketing) {
      campaigns.push({
        name: igPriority
          ? "Instagram - Remarketing"
          : "Meta - Remarketing",
        platform: "META",
        funnelStage: "REMARKETING",
        rationale: igPriority
          ? "Remarketing en Instagram sobre interacciones, visitantes web y aperturas de WhatsApp."
          : "Reimpactar visitantes del sitio. Solo activar con datos suficientes (mín. 1000 visitantes/mes).",
      });
    }
  }

  if (
    (objective.platforms === "GOOGLE" || objective.platforms === "BOTH") &&
    allowPerformanceMax
  ) {
    campaigns.push({
      name: "Google - Performance Max (opcional)",
      platform: "GOOGLE",
      funnelStage: "SALES",
      rationale:
        "Ampliar alcance en red Google con creatividades premium. Activar solo tras validar Search.",
    });
  }

  return campaigns;
}

function buildAudiences(
  objective: MarketingObjective,
  isPremium: boolean,
  brand?: BrandKnowledgeContext
): string[] {
  const ideal = brand?.idealCustomer || objective.ideal_customer;
  const locations = brand?.locations?.length ? brand.locations : objective.locations;
  const base = [ideal, ...locations.map((l) => `Residentes en ${l}`)];

  if (isPremium) {
    base.push(
      "Arquitectura y diseño de interiores/exteriores",
      "Propiedades con pileta, terraza o jardín",
      "Intereses en diseño premium y outdoor living",
      "Excluir: muebles baratos, segunda mano, DIY"
    );
  }

  if (brand?.differentiators) {
    base.push(brand.differentiators);
  }

  return base;
}

function buildMainMessages(
  objective: MarketingObjective,
  isPremium: boolean,
  whatsapp: boolean,
  brand?: BrandKnowledgeContext
): string[] {
  if (brand?.positioning) {
    const messages = [
      brand.positioning,
      brand.materials ? `Materiales: ${brand.materials}` : "",
      brand.differentiators ?? "",
    ].filter(Boolean);
    if (brand.preferredWords.length > 0) {
      messages.push(`Enfatizar: ${brand.preferredWords.slice(0, 5).join(", ")}`);
    }
    return messages;
  }

  const messages = [
    `Diseño ${isPremium ? "premium" : "de calidad"} para tu espacio exterior`,
    "Materiales duraderos pensados para climas exigentes",
    "Proyectos a medida con terminaciones de alta gama",
  ];

  if (whatsapp) {
    messages.push(
      "Consultá por WhatsApp y recibí asesoramiento personalizado",
      "Presupuestos para proyectos exclusivos — no ofertas masivas"
    );
  }

  if (isPremium) {
    messages.push(
      "No competimos por precio: invertimos en calidad y diseño",
      "Ideal para countries, casas premium y estudios de arquitectura"
    );
  }

  return messages;
}

function buildCtas(whatsapp: boolean, brand?: BrandKnowledgeContext): string[] {
  const ctas: string[] = [];
  if (brand?.primaryCta) ctas.push(brand.primaryCta);
  if (brand?.secondaryCta) ctas.push(brand.secondaryCta);
  if (ctas.length > 0) return ctas;
  return whatsapp
    ? ["Consultar por WhatsApp", "Solicitar presupuesto", "Ver catálogo premium"]
    : ["Solicitar presupuesto", "Conocer más", "Agendar consulta"];
}

function buildSuccessCriteria(
  objective: MarketingObjective,
  isPremium: boolean
): string[] {
  const criteria = [
    "CTR > 1.2% en Meta, > 3% en Google Search",
    "Al menos 10 leads en los primeros 14 días",
    "Tracking UTM funcionando correctamente",
  ];

  if (isPremium) {
    criteria.push(
      "Calidad de lead > 7/10 (consultas con presupuesto real)",
      "CPL aceptable aunque sea mayor que competencia low-cost",
      "Leads de Buenos Aires con ticket estimado superior"
    );
  } else {
    criteria.push("CPL dentro del objetivo definido");
  }

  return criteria;
}

function generateGenericKeywords(objective: MarketingObjective): string[] {
  const product = objective.product.split(",")[0].trim().toLowerCase();
  return [
    product,
    `${product} premium`,
    `comprar ${product}`,
    `${product} precio`,
    `mejor ${product}`,
  ];
}

function generateGenericNegativeKeywords(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext
): string[] {
  const base = [
    ...(brand?.forbiddenWords ?? []),
    "gratis",
    "barato",
    "usado",
    "segunda mano",
    "tutorial",
    "diy",
  ];
  if (objective.restrictions) {
    const words = objective.restrictions
      .toLowerCase()
      .match(/\b(excluir|evitar)\s+([^.,]+)/gi);
    if (words) base.push(...words);
  }
  return base;
}
