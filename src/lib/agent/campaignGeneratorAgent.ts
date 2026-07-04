import type { BrandKnowledgeContext } from "@/lib/types/brand";
import type {
  BlueprintAdSet,
  BlueprintAssetItem,
  CampaignBlueprintProposal,
  CampaignBlueprintStatus,
  CampaignGeneratorChannel,
  CampaignGeneratorGoal,
  CampaignGeneratorInput,
  LuxuryLevel,
  MetaInsightsSnapshot,
} from "@/lib/types/campaignBlueprint";
import { MALDIVAS_OUTDOOR_PRESET } from "@/lib/utils/presets";
import { isReadOnlyMode } from "@/lib/utils/config";

const MALDIVAS_FALLBACK: Partial<BrandKnowledgeContext> = {
  positioning:
    "Muebles de exterior premium con diseño minimalista y terminaciones de lujo. Fabricación en Córdoba para proyectos de alto standing.",
  brandVoice: "Premium, sobrio, profesional. Sin urgencia barata ni descuentos.",
  idealCustomer:
    "Dueños de casas premium, countries, arquitectos y estudios que buscan outdoor living de alta gama en Buenos Aires y Córdoba.",
  mainProducts:
    "Livings, reposeras, camastros, mesas, sillas y barras de exterior en aluminio y telas náuticas.",
  materials: "Aluminio, telas náuticas, piedras premium, diseño a medida.",
  differentiators:
    "Diseño a medida, materiales náuticos, durabilidad y estética minimalista. No competimos por precio.",
  locations: ["Córdoba", "Buenos Aires", "Zona Norte", "Punta del Este"],
  primaryCta: "Enviar mensaje",
  secondaryCta: "Más información",
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function resolveMetaObjective(goal: CampaignGeneratorGoal): {
  objective: string;
  metaObjective: string;
  funnelStage: string;
  cta: string;
} {
  switch (goal) {
    case "WHATSAPP_LEADS":
      return {
        objective: "Generar consultas calificadas por WhatsApp",
        metaObjective: "OUTCOME_LEADS",
        funnelStage: "CONVERSION",
        cta: "Enviar mensaje",
      };
    case "WEB_TRAFFIC":
      return {
        objective: "Tráfico cualificado al sitio web",
        metaObjective: "OUTCOME_TRAFFIC",
        funnelStage: "CONSIDERATION",
        cta: "Más información",
      };
    case "AWARENESS":
      return {
        objective: "Reconocimiento de marca premium en públicos de alto poder adquisitivo",
        metaObjective: "OUTCOME_AWARENESS",
        funnelStage: "AWARENESS",
        cta: "Ver más",
      };
    case "REMARKETING":
      return {
        objective: "Reactivar visitantes e interesados previos",
        metaObjective: "OUTCOME_LEADS",
        funnelStage: "RETARGETING",
        cta: "Consultar ahora",
      };
  }
}

function buildLocations(input: CampaignGeneratorInput, brand: BrandKnowledgeContext): string[] {
  const zone = input.targetZone.trim();
  const base = brand.locations?.length
    ? brand.locations
    : MALDIVAS_OUTDOOR_PRESET.locations ?? [];
  if (!zone) return base;
  if (base.some((l) => l.toLowerCase().includes(zone.toLowerCase()))) return base;
  return [zone, ...base];
}

function buildAudiences(
  goal: CampaignGeneratorGoal,
  brand: BrandKnowledgeContext,
  luxury: LuxuryLevel
): string[] {
  const income = luxury === "ultra_premium" ? "top 10%" : "top 25%";
  const core = [
    `Intereses: arquitectura, diseño de interiores, outdoor living, piletas, countries (${income} poder adquisitivo)`,
    brand.idealCustomer || MALDIVAS_FALLBACK.idealCustomer!,
    "Exclusión: búsquedas baratas, usado, muebles de interior, electrodomésticos",
  ];
  if (goal === "REMARKETING") {
    core.unshift(
      "Custom audience: visitantes web últimos 30–90 días",
      "Engagers Instagram/Facebook últimos 60 días",
      "Lista de clientes / consultas previas (si disponible)"
    );
  }
  if (goal === "WHATSAPP_LEADS") {
    core.push("Lookalike 1–3% de clientes o leads WhatsApp (cuando haya volumen)");
  }
  return core;
}

function buildPlacements(
  channel: CampaignGeneratorChannel,
  metaInsights: MetaInsightsSnapshot
): CampaignBlueprintProposal["placements"] {
  const instagramPositions = [
    "instagram_reels",
    "instagram_stories",
    "instagram_feed",
    "instagram_explore",
  ];
  const facebookPositions =
    channel === "META_FULL"
      ? ["facebook_feed", "facebook_stories", "facebook_reels"]
      : [];

  let strategy =
    "Prioridad manual en Instagram: Reels para alcance, Stories para conversión directa, Feed para consideración.";

  if (metaInsights.topPlacements.length > 0) {
    const top = metaInsights.topPlacements
      .slice(0, 3)
      .map((p) => `${p.channel}/${p.placement} (CTR ${p.ctr.toFixed(2)}%)`)
      .join(", ");
    strategy += ` Histórico Meta sugiere mayor rendimiento en: ${top}.`;
  }

  return {
    instagramPositions,
    facebookPositions,
    placementStrategy: strategy,
    formats: ["9:16 (Reels/Stories)", "4:5 (Feed móvil)", "1:1 (Feed/carrusel)"],
  };
}

function buildAdSets(
  input: CampaignGeneratorInput,
  goal: CampaignGeneratorGoal,
  channel: CampaignGeneratorChannel,
  audiences: string[],
  placements: CampaignBlueprintProposal["placements"]
): BlueprintAdSet[] {
  const igOnly = channel !== "META_FULL";
  const sets: BlueprintAdSet[] = [
    {
      name: "IG Reels — Alcance premium",
      placementFocus: "instagram_reels",
      optimizationGoal:
        goal === "AWARENESS" ? "REACH" : goal === "WEB_TRAFFIC" ? "LINK_CLICKS" : "CONVERSATIONS",
      dailyBudgetShare: igOnly ? 40 : 30,
      placements: ["instagram_reels"],
      audienceSummary: audiences[0] ?? "Público premium outdoor",
    },
    {
      name: "IG Stories — Conversión WhatsApp",
      placementFocus: "instagram_stories",
      optimizationGoal: goal === "WHATSAPP_LEADS" ? "CONVERSATIONS" : "LINK_CLICKS",
      dailyBudgetShare: igOnly ? 35 : 25,
      placements: ["instagram_stories"],
      audienceSummary:
        goal === "REMARKETING"
          ? "Remarketing caliente — visitantes y engagers"
          : "Intereses afines + ubicación objetivo",
    },
    {
      name: "IG Feed — Consideración",
      placementFocus: "instagram_feed",
      optimizationGoal: "LINK_CLICKS",
      dailyBudgetShare: igOnly ? 25 : 20,
      placements: ["instagram_feed", "instagram_explore"],
      audienceSummary: audiences[1] ?? audiences[0] ?? "Público premium",
    },
  ];

  if (channel === "META_FULL") {
    sets.push({
      name: "Facebook Feed — Soporte",
      placementFocus: "facebook_feed",
      optimizationGoal: "LINK_CLICKS",
      dailyBudgetShare: 25,
      placements: placements.facebookPositions,
      audienceSummary: "Ampliación 35–55, intereses hogar y arquitectura",
    });
  }

  return sets;
}

function buildCopies(
  input: CampaignGeneratorInput,
  brand: BrandKnowledgeContext,
  goal: CampaignGeneratorGoal,
  luxury: LuxuryLevel
): CampaignBlueprintProposal["copies"] {
  const product = input.productOffer.trim() || brand.mainProducts || "muebles de exterior premium";
  const materials = brand.materials || "aluminio y telas náuticas";
  const tone =
    luxury === "ultra_premium"
      ? "ultra exclusivo, discreto, sin promociones"
      : "premium, elegante, asesoramiento personalizado";

  const headlines = [
    `${product.split(",")[0].trim()} — diseño a medida`,
    "Outdoor living de alta gama",
    "Terminaciones náuticas para tu terraza",
    brand.positioning?.slice(0, 55) || "Muebles de exterior premium",
    "Proyectos para countries y casas de diseño",
  ].filter(Boolean);

  const descriptions = [
    `${materials}. Fabricación en Córdoba, proyectos en ${input.targetZone || "Buenos Aires"}.`,
    brand.differentiators ||
      "No competimos por precio: calidad, diseño y durabilidad para exteriores.",
    `Tono ${tone}. Asesoramiento para arquitectos y propietarios exigentes.`,
  ];

  const whatsappLine =
    goal === "WHATSAPP_LEADS"
      ? "Escribinos por WhatsApp para coordinar una consulta sin compromiso."
      : "Conocé la colección y solicitá asesoramiento personalizado.";

  const primaryText = `¿Buscás ${product.toLowerCase()} para un proyecto exigente? ${brand.differentiators?.slice(0, 120) ?? "Materiales premium y diseño a medida."} ${whatsappLine}`;

  const stories = [
    `Tu terraza merece más que muebles genéricos. ${product} con ${materials}.`,
    `Diseño minimalista · Durabilidad náutica · Proyectos a medida en ${input.targetZone || "BA"}.`,
    `Consultá por WhatsApp → asesoramiento premium, sin presión comercial.`,
  ];

  const reels = [
    `POV: terminás de instalar tu living outdoor en aluminio y tela náutica. Calidad que se ve y se siente.`,
    `De la galería al jardín: cómo elegimos materiales que resisten sol, lluvia y el paso del tiempo.`,
    `Proyecto real · ${product} · Estética limpia, líneas puras, cero compromisos en terminaciones.`,
  ];

  const feed = [
    primaryText,
    `${brand.positioning || "Muebles outdoor premium"} — pensados para quienes valoran el diseño por encima del precio.`,
    `Córdoba · ${input.targetZone || "Buenos Aires"} · Proyectos exclusivos de exterior.`,
  ];

  const cta =
    goal === "WHATSAPP_LEADS"
      ? brand.primaryCta || "Enviar mensaje"
      : goal === "WEB_TRAFFIC"
        ? "Más información"
        : brand.secondaryCta || "Ver más";

  return { headlines, descriptions, primaryText, stories, reels, feed, cta };
}

function buildAssetsChecklist(channel: CampaignGeneratorChannel): BlueprintAssetItem[] {
  const items: BlueprintAssetItem[] = [
    { item: "Video vertical Reels (15–30s)", format: "9:16", required: true, ready: false },
    { item: "Stories estáticas o motion (3–5 piezas)", format: "9:16", required: true, ready: false },
    { item: "Imágenes Feed premium (producto + ambiente)", format: "4:5 / 1:1", required: true, ready: false },
    { item: "Logo en alta resolución", format: "PNG/SVG", required: true, ready: false },
    { item: "Fotos de proyectos reales / renders", format: "JPG", required: true, ready: false },
  ];
  if (channel === "META_FULL") {
    items.push({
      item: "Variantes cuadrado para Facebook Feed",
      format: "1:1",
      required: false,
      ready: false,
    });
  }
  return items;
}

function resolveStatus(
  input: CampaignGeneratorInput,
  brand: BrandKnowledgeContext,
  assets: BlueprintAssetItem[]
): CampaignBlueprintStatus {
  const missingRequired = assets.some((a) => a.required && !a.ready);
  if (missingRequired) return "NEEDS_ASSETS";
  if (input.dailyBudget >= 100000 || input.luxuryLevel === "ultra_premium") {
    return "APPROVAL_REQUIRED";
  }
  if (brand.isComplete) return "READY_FOR_META_DRAFT";
  return "INTERNAL_DRAFT";
}

export function generateCampaignBlueprintProposal(
  input: CampaignGeneratorInput,
  brand: BrandKnowledgeContext,
  metaInsights: MetaInsightsSnapshot
): { proposal: CampaignBlueprintProposal; status: CampaignBlueprintStatus } {
  const mergedBrand: BrandKnowledgeContext = {
    ...brand,
    positioning: brand.positioning || MALDIVAS_FALLBACK.positioning!,
    brandVoice: brand.brandVoice || MALDIVAS_FALLBACK.brandVoice!,
    idealCustomer: brand.idealCustomer || MALDIVAS_FALLBACK.idealCustomer!,
    mainProducts: brand.mainProducts || MALDIVAS_FALLBACK.mainProducts!,
    materials: brand.materials || MALDIVAS_FALLBACK.materials!,
    differentiators: brand.differentiators || MALDIVAS_FALLBACK.differentiators!,
    locations: brand.locations?.length ? brand.locations : MALDIVAS_FALLBACK.locations!,
  };

  const { objective, metaObjective, funnelStage, cta } = resolveMetaObjective(
    input.campaignGoal
  );
  const copies = buildCopies(input, mergedBrand, input.campaignGoal, input.luxuryLevel);
  copies.cta = cta;

  const locations = buildLocations(input, mergedBrand);
  const audiences = buildAudiences(input.campaignGoal, mergedBrand, input.luxuryLevel);
  const placements = buildPlacements(input.channelPreference, metaInsights);
  const adSets = buildAdSets(
    input,
    input.campaignGoal,
    input.channelPreference,
    audiences,
    placements
  );

  const start = addDays(new Date(), 3);
  const end = addDays(start, input.suggestedDurationDays);
  const totalBudget = input.dailyBudget * input.suggestedDurationDays;

  const productSlug = slugify(input.productOffer || "outdoor");
  const zoneSlug = slugify(input.targetZone || "ba");
  const campaignName = `Maldivas | ${productSlug} | ${zoneSlug} | ${input.campaignGoal.replace(/_/g, "-").toLowerCase()}`;

  const creativeAngles = [
    `Artesanía y materiales náuticos: ${mergedBrand.materials}`,
    "Antes/después de terraza o galería en country",
    "Detalle de terminaciones aluminio + costura náutica",
    "Lifestyle aspiracional: pileta, atardecer, silencio visual minimalista",
    input.luxuryLevel === "ultra_premium"
      ? "Curaduría exclusiva: piezas limitadas y proyectos únicos"
      : "Diseño a medida accesible para segmento premium",
  ];

  if (metaInsights.priorCampaignNames.length > 0) {
    creativeAngles.push(
      `Continuidad con campañas previas: ${metaInsights.priorCampaignNames.slice(0, 2).join(", ")}`
    );
  }

  const visualRecommendations = [
    "Paleta neutra: grises, blancos, madera natural, acentos metálicos.",
    "Iluminación natural, golden hour, sin saturación excesiva.",
    "Evitar texto superpuesto >20% en imagen; tipografía sans-serif fina.",
    "Mostrar contexto real: terraza, quincho, pileta — nunca fondo genérico de stock barato.",
    "Reels con movimiento lento, música ambiental discreta, sin voz en off agresiva.",
  ];

  const assetsChecklist = buildAssetsChecklist(input.channelPreference);
  const status = resolveStatus(input, mergedBrand, assetsChecklist);

  const googleNote =
    input.channelPreference === "GOOGLE_FUTURE"
      ? " Google Ads no está conectado; esta propuesta es interna y orientada a Meta/Instagram."
      : "";

  const insightNote = metaInsights.used
    ? ` Se incorporaron ${metaInsights.insightRowCount} filas de insights y ${metaInsights.campaignCount} campañas históricas.`
    : "";

  const proposal: CampaignBlueprintProposal = {
    campaignName,
    objective,
    metaObjective,
    funnelStage,
    structure: {
      platform: input.channelPreference === "GOOGLE_FUTURE" ? "GOOGLE_FUTURE" : "META",
      campaignType:
        input.channelPreference === "INSTAGRAM_PRIORITY"
          ? "Instagram Advantage+ manual placements"
          : input.channelPreference === "META_FULL"
            ? "Meta full funnel"
            : "Propuesta futura Google (borrador interno)",
      budgetType: "CBO desactivado — presupuesto por ad set",
      durationDays: input.suggestedDurationDays,
      totalBudgetEstimate: totalBudget,
    },
    adSets,
    audiences,
    locations,
    placements,
    budget: {
      dailyBudget: input.dailyBudget,
      monthlyEstimate: Math.round(input.dailyBudget * 30),
      allocationNotes: adSets
        .map((s) => `${s.name}: ${s.dailyBudgetShare}% (~$${Math.round((input.dailyBudget * s.dailyBudgetShare) / 100)}/día)`)
        .join(" · "),
    },
    calendar: {
      suggestedStart: formatDate(start),
      suggestedEnd: formatDate(end),
      phases: [
        { label: "Semana 1–2", focus: "Testing creatividades Reels + Stories, optimizar CTR" },
        {
          label: "Semana 3+",
          focus:
            input.campaignGoal === "REMARKETING"
              ? "Intensificar remarketing y lookalikes"
              : "Escalar winners, pausar piezas con CPC alto",
        },
      ],
    },
    creativeAngles,
    copies,
    visualRecommendations,
    assetsChecklist,
    metaInsightsUsed: metaInsights,
    brandContextUsed: true,
    brandVoice: mergedBrand.brandVoice,
    recommendationSummary: `Campaña ${input.luxuryLevel} para ${input.productOffer} en ${input.targetZone || "zona objetivo"}, priorizando Instagram con tono ${mergedBrand.brandVoice}.${insightNote}${googleNote}`,
    readOnlyNotice: isReadOnlyMode()
      ? "ADS_MODE=read_only — esta propuesta es un borrador interno. No se creará nada en Meta hasta cambiar de modo y aprobar."
      : "Borrador interno — requiere aprobación antes de publicar en plataforma.",
  };

  return { proposal, status };
}
