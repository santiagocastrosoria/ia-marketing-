import type { BrandDocument, BrandProfile } from "@/lib/types/brand";

export const REQUIRED_PROFILE_FIELDS: {
  key: keyof BrandProfile;
  label: string;
}[] = [
  { key: "positioning", label: "positioning" },
  { key: "brand_voice", label: "brand_voice" },
  { key: "ideal_customer", label: "ideal_customer" },
  { key: "main_products", label: "main_products" },
  { key: "materials", label: "materials" },
  { key: "differentiators", label: "differentiators" },
  { key: "locations", label: "locations" },
  { key: "forbidden_words", label: "forbidden_words" },
  { key: "preferred_words", label: "preferred_words" },
  { key: "primary_cta", label: "primary_cta" },
  { key: "secondary_cta", label: "secondary_cta" },
];

export const REQUIRED_PROFILE_LABELS: Record<string, string> = {
  positioning: "Perfil / posicionamiento de marca",
  brand_voice: "Tono de comunicación",
  ideal_customer: "Cliente ideal",
  main_products: "Productos principales",
  materials: "Materiales",
  differentiators: "Diferenciales",
  locations: "Zonas de venta",
  forbidden_words: "Palabras prohibidas",
  preferred_words: "Palabras recomendadas",
  primary_cta: "CTA principal",
  secondary_cta: "CTA secundario",
};

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function validateBrandKnowledge(
  profile: BrandProfile | null,
  _documents: BrandDocument[] = []
): {
  isComplete: boolean;
  missingFields: string[];
  completenessScore: number;
  message: string;
} {
  if (!profile) {
    return {
      isComplete: false,
      missingFields: REQUIRED_PROFILE_FIELDS.map((f) => f.label),
      completenessScore: 0,
      message:
        "No hay perfil de marca configurado. Completá la base de conocimiento antes de crear campañas.",
    };
  }

  const missing: string[] = [];
  let filled = 0;

  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = profile[field.key];
    if (isEmpty(value)) {
      missing.push(field.label);
    } else {
      filled++;
    }
  }

  const completenessScore = Math.round(
    (filled / REQUIRED_PROFILE_FIELDS.length) * 100
  );
  const isComplete = missing.length === 0;

  return {
    isComplete,
    missingFields: missing,
    completenessScore,
    message: isComplete
      ? "Base de conocimiento completa para generar campañas."
      : `Faltan campos obligatorios: ${missing.map((k) => REQUIRED_PROFILE_LABELS[k] ?? k).join(", ")}`,
  };
}
