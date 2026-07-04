import type {
  CampaignBlueprint,
  CampaignBlueprintReview,
  CampaignReviewStatus,
  ReviewChecklistItem,
  ReviewCriterionScore,
} from "@/lib/types/campaignBlueprint";
import { MALDIVAS_NEGATIVE_KEYWORDS } from "@/lib/utils/presets";

const CHEAP_TONE_WORDS = [
  "barato",
  "oferta",
  "descuento",
  "promo",
  "imperdible",
  "gratis",
  "mega",
  "super",
  "liquidación",
  "2x1",
  "urgente",
  "últimas unidades",
];

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function hasCheapTone(text: string): string[] {
  const lower = text.toLowerCase();
  return CHEAP_TONE_WORDS.filter((w) => lower.includes(w));
}

function buildChecklist(blueprint: CampaignBlueprint): ReviewChecklistItem[] {
  const { input, proposal } = blueprint;
  const allCopy = [
    proposal.copies.primaryText,
    ...proposal.copies.stories,
    ...proposal.copies.reels,
    ...proposal.copies.headlines,
  ].join(" ");

  const hasVideoAsset = proposal.assetsChecklist.some(
    (a) =>
      a.ready &&
      (a.format?.includes("9:16") ?? false) &&
      a.item.toLowerCase().includes("video")
  );
  const hasFeedAsset = proposal.assetsChecklist.some(
    (a) => a.ready && (a.format?.includes("4:5") ?? a.format?.includes("1:1"))
  );
  const hasStoryAsset = proposal.assetsChecklist.some(
    (a) =>
      a.ready &&
      (a.format?.includes("9:16") ?? false) &&
      a.item.toLowerCase().includes("stor")
  );

  const hasWhatsApp =
    input.campaignGoal === "WHATSAPP_LEADS" ||
    allCopy.toLowerCase().includes("whatsapp");
  const hasWeb =
    input.campaignGoal === "WEB_TRAFFIC" ||
    proposal.copies.cta.toLowerCase().includes("información");

  return [
    {
      id: "video_916",
      label: "Video vertical 9:16",
      passed: hasVideoAsset,
      note: hasVideoAsset
        ? undefined
        : "Falta video Reels 9:16 listo para subir.",
    },
    {
      id: "feed_45",
      label: "Imagen feed 4:5",
      passed: hasFeedAsset,
      note: hasFeedAsset ? undefined : "Falta imagen feed 4:5 o 1:1 en alta resolución.",
    },
    {
      id: "story_916",
      label: "Story 9:16",
      passed: hasStoryAsset,
      note: hasStoryAsset ? undefined : "Faltan piezas Story 9:16 (estáticas o motion).",
    },
    {
      id: "copy_main",
      label: "Copy principal",
      passed: proposal.copies.primaryText.trim().length >= 40,
      note:
        proposal.copies.primaryText.trim().length >= 40
          ? undefined
          : "El copy principal es muy corto o genérico.",
    },
    {
      id: "copy_short",
      label: "Copy corto",
      passed: proposal.copies.stories.some((s) => s.trim().length >= 20),
      note: "Necesitás al menos un copy corto para Stories.",
    },
    {
      id: "destination",
      label: "Landing o WhatsApp",
      passed: hasWhatsApp || hasWeb,
      note: "Definí destino: WhatsApp para leads o landing para tráfico web.",
    },
    {
      id: "zone",
      label: "Zona definida",
      passed: input.targetZone.trim().length >= 3,
    },
    {
      id: "budget",
      label: "Presupuesto definido",
      passed: input.dailyBudget >= 10000,
      note:
        input.dailyBudget >= 10000
          ? undefined
          : "Presupuesto diario demasiado bajo para aprender en Meta.",
    },
    {
      id: "duration",
      label: "Duración definida",
      passed: input.suggestedDurationDays >= 7 && input.suggestedDurationDays <= 90,
    },
  ];
}

function scoreObjectiveClarity(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  let score = 70;
  const notes: string[] = [];

  if (proposal.objective.length >= 30) score += 10;
  else notes.push("El objetivo declarado es vago.");

  if (input.productOffer.trim().length >= 15) score += 10;
  else notes.push("Describí mejor qué producto o línea promocionás.");

  if (proposal.metaObjective) score += 10;

  return {
    id: "objective_clarity",
    label: "Claridad del objetivo",
    score: clampScore(score),
    summary:
      notes.length > 0
        ? notes.join(" ")
        : "Objetivo claro y alineado con la propuesta Meta.",
  };
}

function scoreCoherence(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  let score = 80;
  const notes: string[] = [];

  const productLower = input.productOffer.toLowerCase();
  const audienceText = proposal.audiences.join(" ").toLowerCase();
  const isPremiumProduct =
    productLower.includes("premium") ||
    productLower.includes("aluminio") ||
    productLower.includes("náutica") ||
    input.luxuryLevel !== "premium";

  if (!isPremiumProduct && audienceText.includes("alto poder")) {
    score -= 15;
    notes.push("El producto no refleja posicionamiento premium del público.");
  }

  const budgetPerDay = input.dailyBudget;
  if (budgetPerDay < 20000 && input.campaignGoal === "AWARENESS") {
    score -= 20;
    notes.push("Awareness con presupuesto bajo puede no generar datos útiles.");
  }

  if (proposal.adSets.length >= 2) score += 5;

  return {
    id: "coherence",
    label: "Coherencia producto · público · presupuesto",
    score: clampScore(score),
    summary:
      notes.length > 0
        ? notes.join(" ")
        : "Producto, público y presupuesto están alineados.",
  };
}

function scoreBudget(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { dailyBudget } = blueprint.input;
  let score = 70;
  let summary = "";

  if (dailyBudget < 15000) {
    score = 35;
    summary =
      "Presupuesto muy bajo para Meta premium; difícil optimizar con datos confiables.";
  } else if (dailyBudget < 40000) {
    score = 65;
    summary = "Presupuesto aceptable para prueba inicial en zona acotada.";
  } else if (dailyBudget <= 120000) {
    score = 90;
    summary = "El presupuesto está bien para prueba inicial con aprendizaje sólido.";
  } else {
    score = 75;
    summary =
      "Presupuesto alto — conviene aprobación humana antes de activar en Meta.";
  }

  return {
    id: "budget",
    label: "Presupuesto diario razonable",
    score: clampScore(score),
    summary,
  };
}

function scoreAudience(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  let score = 75;
  const notes: string[] = [];

  const locationCount = proposal.locations.length;
  const zone = input.targetZone.toLowerCase();

  if (locationCount > 4 && !zone.includes("buenos aires")) {
    score -= 15;
    notes.push("Público geográfico muy amplio; considerá acotar para premium.");
  }

  if (
    zone.includes("buenos aires") &&
    proposal.adSets.every((s) => !s.audienceSummary.toLowerCase().includes("buenos"))
  ) {
    score -= 10;
    notes.push("Separaría Buenos Aires en un ad set propio.");
  }

  const hasExclusion = proposal.audiences.some((a) =>
    a.toLowerCase().includes("exclus")
  );
  if (!hasExclusion) {
    score -= 10;
    notes.push("Faltan exclusiones explícitas de público no calificado.");
  }

  if (input.dailyBudget >= 80000 && locationCount === 1) {
    score += 5;
  }

  if (input.dailyBudget < 25000 && locationCount > 2) {
    score -= 15;
    notes.push("Presupuesto chico para tantas ubicaciones — audiencia demasiado fragmentada.");
  }

  return {
    id: "audience",
    label: "Tamaño y foco del público",
    score: clampScore(score),
    summary:
      notes.length > 0
        ? notes.join(" ")
        : "Segmentación equilibrada para el segmento premium.",
  };
}

function scorePlacements(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  let score = 80;
  const notes: string[] = [];
  const ig = proposal.placements.instagramPositions;

  if (input.channelPreference === "INSTAGRAM_PRIORITY") {
    if (!ig.includes("instagram_reels")) {
      score -= 25;
      notes.push("Falta priorizar Reels en Instagram.");
    }
    if (!ig.includes("instagram_stories")) {
      score -= 15;
      notes.push("Stories deberían estar incluidos para conversión.");
    }
  }

  if (
    input.campaignGoal === "WHATSAPP_LEADS" &&
    !proposal.adSets.some((s) => s.placementFocus.includes("stories"))
  ) {
    score -= 10;
    notes.push("Para WhatsApp leads, Stories suelen convertir mejor.");
  }

  if (proposal.metaInsightsUsed.used && proposal.metaInsightsUsed.topPlacements.length > 0) {
    score += 10;
  }

  return {
    id: "placements",
    label: "Placements elegidos",
    score: clampScore(score),
    summary:
      notes.length > 0
        ? notes.join(" ")
        : "Placements coherentes con Instagram prioritario y el objetivo.",
  };
}

function scoreCta(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  const cta = proposal.copies.cta.toLowerCase();
  let score = 85;
  let summary = "CTA alineado con el objetivo de campaña.";

  if (input.campaignGoal === "WHATSAPP_LEADS") {
    if (!cta.includes("mensaje") && !cta.includes("whatsapp")) {
      score = 45;
      summary = "El CTA no invita a WhatsApp; cambiá a «Enviar mensaje» o similar.";
    }
  } else if (input.campaignGoal === "WEB_TRAFFIC") {
    if (!cta.includes("información") && !cta.includes("sitio") && !cta.includes("web")) {
      score = 55;
      summary = "Para tráfico web, usá CTA tipo «Más información» o «Ver sitio».";
    }
  } else if (input.campaignGoal === "AWARENESS") {
    if (cta.includes("mensaje")) {
      score = 60;
      summary = "Awareness no debería empujar WhatsApp como CTA principal.";
    }
  }

  return {
    id: "cta",
    label: "CTA vs objetivo",
    score: clampScore(score),
    summary,
  };
}

function scoreCreativeAssets(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const missing = blueprint.proposal.assetsChecklist.filter(
    (a) => a.required && !a.ready
  );
  let score = 100 - missing.length * 18;
  const summary =
    missing.length > 0
      ? `Faltan ${missing.length} assets creativos obligatorios (video, stories, feed).`
      : "Assets creativos completos según checklist.";

  return {
    id: "creative_assets",
    label: "Assets creativos",
    score: clampScore(score),
    summary,
  };
}

function scorePremiumTone(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const allText = [
    blueprint.proposal.copies.primaryText,
    ...blueprint.proposal.copies.stories,
    ...blueprint.proposal.copies.reels,
    blueprint.proposal.brandVoice,
    blueprint.proposal.recommendationSummary,
  ].join(" ");

  const cheapHits = hasCheapTone(allText);
  const forbiddenHits = MALDIVAS_NEGATIVE_KEYWORDS.filter((w) =>
    allText.toLowerCase().includes(w.toLowerCase())
  );

  let score = 90;
  const issues = [...cheapHits, ...forbiddenHits.slice(0, 3)];

  if (issues.length > 0) score -= issues.length * 15;

  const summary =
    issues.length > 0
      ? `Evitá términos que restan lujo: ${issues.slice(0, 4).join(", ")}.`
      : "Tono premium consistente con Maldivas Outdoor.";

  return {
    id: "premium_tone",
    label: "Tono premium",
    score: clampScore(score),
    summary,
  };
}

function scoreAntiGeneric(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { proposal, input } = blueprint;
  let score = 75;
  const notes: string[] = [];

  const genericPhrases = [
    "muebles de calidad",
    "descubrí nuestra colección",
    "sin compromiso",
    "transformá tu espacio",
  ];
  const text = proposal.copies.primaryText.toLowerCase();
  const genericCount = genericPhrases.filter((p) => text.includes(p)).length;

  if (genericCount >= 2) {
    score -= 25;
    notes.push("El copy suena genérico; incorporá materiales, zona o diseño a medida.");
  }

  if (!text.includes("aluminio") && !text.includes("náutica") && !text.includes("medida")) {
    score -= 10;
    notes.push("Mencioná diferenciadores concretos (aluminio, telas náuticas, a medida).");
  }

  if (input.luxuryLevel === "ultra_premium" && !text.includes("exclusiv")) {
    score -= 5;
  }

  return {
    id: "anti_generic",
    label: "Riesgo marca barata o genérica",
    score: clampScore(score),
    summary:
      notes.length > 0
        ? notes.join(" ")
        : "Propuesta diferenciada, no parece catálogo masivo.",
  };
}

function scoreSufficientInfo(blueprint: CampaignBlueprint): ReviewCriterionScore {
  const { input, proposal } = blueprint;
  let score = 0;
  if (input.productOffer.trim()) score += 20;
  if (input.targetZone.trim()) score += 15;
  if (input.dailyBudget > 0) score += 15;
  if (input.suggestedDurationDays >= 7) score += 10;
  if (proposal.adSets.length >= 2) score += 15;
  if (proposal.copies.primaryText.length >= 40) score += 15;
  if (proposal.audiences.length >= 2) score += 10;

  const summary =
    score >= 80
      ? "Hay información suficiente para armar campaña pausada en Meta."
      : "Completá brief, ad sets y copies antes de pasar a Meta Draft.";

  return {
    id: "sufficient_info",
    label: "Información para campaña real",
    score: clampScore(score),
    summary,
  };
}

function buildRecommendations(
  blueprint: CampaignBlueprint,
  checklist: ReviewChecklistItem[],
  criteria: ReviewCriterionScore[]
): string[] {
  const recs: string[] = [];
  const { input, proposal } = blueprint;

  if (!checklist.find((c) => c.id === "video_916")?.passed) {
    recs.push(
      "Antes de crear esta campaña, necesitás 2 Reels en 9:16 mostrando el producto en casa real o render premium."
    );
  }
  if (!checklist.find((c) => c.id === "story_916")?.passed) {
    recs.push(
      "Prepará 3–5 Stories 9:16 con detalle de materiales y CTA directo a WhatsApp."
    );
  }
  if (!checklist.find((c) => c.id === "feed_45")?.passed) {
    recs.push(
      "Sumá imágenes feed 4:5 con ambiente aspiracional (terraza, pileta, galería)."
    );
  }

  const budgetCrit = criteria.find((c) => c.id === "budget");
  if (budgetCrit && budgetCrit.score >= 65) {
    recs.push(budgetCrit.summary);
  }

  const audienceCrit = criteria.find((c) => c.id === "audience");
  if (audienceCrit?.summary.includes("Buenos Aires")) {
    recs.push("Separaría Buenos Aires en un ad set propio.");
  }

  if (input.channelPreference === "GOOGLE_FUTURE") {
    recs.push(
      "Google Ads no está conectado; mantené esta propuesta como borrador Meta hasta integrar Search."
    );
  }

  if (proposal.copies.reels.length < 2) {
    recs.push("Escribí al menos 2 guiones de Reels distintos para test A/B.");
  }

  const cheapCrit = criteria.find((c) => c.id === "premium_tone");
  if (cheapCrit && cheapCrit.score < 70) {
    recs.push(cheapCrit.summary);
  }

  const ctaCrit = criteria.find((c) => c.id === "cta");
  if (ctaCrit && ctaCrit.score < 70) {
    recs.push(ctaCrit.summary);
  }

  if (input.luxuryLevel === "ultra_premium" || input.dailyBudget >= 100000) {
    recs.push(
      "Presupuesto o nivel ultra premium: requiere aprobación humana antes de cualquier borrador en Meta."
    );
  }

  return [...new Set(recs)].slice(0, 8);
}

function resolveReviewStatus(
  blueprint: CampaignBlueprint,
  preparationScore: number,
  checklist: ReviewChecklistItem[]
): CampaignReviewStatus {
  const { input } = blueprint;

  const assetItems = ["video_916", "feed_45", "story_916"];
  const missingAssets = assetItems.some(
    (id) => !checklist.find((c) => c.id === id)?.passed
  );
  if (missingAssets) return "NEEDS_ASSETS";

  if (input.dailyBudget >= 100000 || input.luxuryLevel === "ultra_premium") {
    return "APPROVAL_REQUIRED";
  }

  if (preparationScore < 65) return "NEEDS_REVIEW";

  const failedCritical = checklist.filter(
    (c) => !c.passed && ["copy_main", "destination", "zone", "budget"].includes(c.id)
  );
  if (failedCritical.length > 0) return "NEEDS_REVIEW";

  if (preparationScore >= 75) return "READY_FOR_META_DRAFT";

  return "NEEDS_REVIEW";
}

export function reviewCampaignBlueprint(
  blueprint: CampaignBlueprint
): CampaignBlueprintReview {
  const checklist = buildChecklist(blueprint);
  const criteria: ReviewCriterionScore[] = [
    scoreObjectiveClarity(blueprint),
    scoreCoherence(blueprint),
    scoreBudget(blueprint),
    scoreAudience(blueprint),
    scorePlacements(blueprint),
    scoreCta(blueprint),
    scoreCreativeAssets(blueprint),
    scorePremiumTone(blueprint),
    scoreAntiGeneric(blueprint),
    scoreSufficientInfo(blueprint),
  ];

  const preparationScore = clampScore(
    criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length
  );

  const recommendations = buildRecommendations(blueprint, checklist, criteria);
  const suggestedStatus = resolveReviewStatus(
    blueprint,
    preparationScore,
    checklist
  );

  return {
    preparationScore,
    suggestedStatus,
    checklist,
    criteria,
    recommendations,
    reviewedAt: new Date().toISOString(),
  };
}
