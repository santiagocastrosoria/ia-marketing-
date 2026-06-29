import type { AdCopy, MarketingObjective } from "@/lib/types/marketing";
import type { BrandKnowledgeContext } from "@/lib/types/brand";

function filterForbidden(text: string, forbidden: string[]): string {
  let result = text;
  for (const word of forbidden) {
    const re = new RegExp(word, "gi");
    result = result.replace(re, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

export function generateMetaCopy(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext
): AdCopy {
  const isPremium =
    (objective.average_ticket ?? 0) > 500000 ||
    objective.product.toLowerCase().includes("premium") ||
    (brand?.positioning?.toLowerCase().includes("premium") ?? false);
  const whatsapp = objective.goal.toLowerCase().includes("whatsapp");

  const productLabel = brand?.mainProducts?.split(",")[0] ?? "Muebles de Exterior";

  const headlines = isPremium
    ? [
        brand?.positioning?.slice(0, 40) || `${productLabel} Premium`,
        "Diseño a Medida para tu Terraza",
        "Livings Outdoor de Alta Gama",
        ...(brand?.preferredWords.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1)) ?? []),
        "Proyectos Exclusivos de Exterior",
      ].filter(Boolean)
    : [
        "Muebles de Exterior de Calidad",
        "Transformá tu Espacio Outdoor",
        "Diseño y Confort para tu Jardín",
      ];

  const descriptions = isPremium
    ? [
        brand?.materials
          ? `${brand.materials}. Terminaciones de lujo.`
          : "Aluminio, telas náuticas y piedras premium. Terminaciones de lujo para countries y casas exclusivas.",
        brand?.differentiators ?? "No competimos por precio. Diseño a medida con materiales de primera.",
        `Pensado para ${brand?.idealCustomer?.slice(0, 80) ?? "proyectos premium"}.`,
        "Asesoramiento personalizado para arquitectos y dueños de casas de alto standing.",
      ]
    : [
        "Muebles de exterior resistentes y elegantes. Consultá por WhatsApp.",
        "Diseño funcional para tu jardín, terraza o quincho.",
      ];

  const primaryTextRaw = isPremium
    ? whatsapp
      ? `¿Buscás ${productLabel.toLowerCase()} para tu proyecto? ${brand?.differentiators ?? "Materiales de alta gama y diseño a medida."} Consultá por WhatsApp.`
      : brand?.positioning ?? "Muebles outdoor de diseño con materiales premium."
    : "Descubrí nuestra colección. Calidad, diseño y asesoramiento personalizado.";

  const primaryText = filterForbidden(
    primaryTextRaw,
    brand?.forbiddenWords ?? []
  );

  const cta = brand?.primaryCta ?? (whatsapp ? "Enviar mensaje" : "Más información");

  const variants = [
    {
      headline: headlines[0],
      description: descriptions[0],
      primaryText,
    },
    {
      headline: headlines[1],
      description: descriptions[1],
      primaryText: isPremium
        ? "Cada proyecto es único. Trabajamos con arquitectos y propietarios que buscan excelencia en outdoor living."
        : primaryText,
    },
    {
      headline: headlines[2],
      description: descriptions[2],
      primaryText: whatsapp
        ? "Escribinos por WhatsApp para recibir asesoramiento sin compromiso. Proyectos premium únicamente."
        : primaryText,
    },
  ];

  return { headlines, descriptions, primaryText, cta, variants };
}

export function generateGoogleCopy(
  objective: MarketingObjective,
  brand?: BrandKnowledgeContext
): AdCopy {
  const isPremium =
    (objective.average_ticket ?? 0) > 500000 ||
    objective.product.toLowerCase().includes("premium");

  const headlines = isPremium
    ? [
        "Muebles Exterior Premium",
        "Reposeras y Livings de Lujo",
        "Diseño a Medida Outdoor",
        "Aluminio y Telas Náuticas",
        "Maldivas Outdoor - Calidad",
        "Muebles para Pileta Premium",
        "Proyectos Exclusivos Exterior",
        "Sillones Outdoor Alta Gama",
        "Mesas y Barras Premium",
        "Muebles Country y Terraza",
        "Durabilidad y Diseño Premium",
        "Presupuesto Personalizado",
        "Terminaciones de Lujo",
        "Muebles Jardín Premium",
        "Asesoramiento Arquitectos",
      ]
    : [
        "Muebles de Exterior",
        "Living Outdoor",
        "Reposeras para Pileta",
        "Muebles para Terraza",
        "Consultá Presupuesto",
      ];

  const descriptions = isPremium
    ? [
        "Muebles de exterior premium en aluminio y telas náuticas. Diseño a medida para proyectos exclusivos.",
        "Livings, reposeras y camastros de alta gama. Atendemos Córdoba, Buenos Aires y Zona Norte.",
        "No somos low-cost. Calidad, durabilidad y terminaciones premium para outdoor living.",
        "Solicitá presupuesto para tu proyecto. Ideal para countries, piletas y terrazas de lujo.",
      ]
    : [
        "Muebles de exterior de calidad. Envíos y asesoramiento personalizado.",
        "Transformá tu espacio outdoor. Consultá por WhatsApp.",
      ];

  return {
    headlines,
    descriptions,
    cta: brand?.primaryCta ?? "Solicitar presupuesto",
    variants: headlines.slice(0, 3).map((h, i) => ({
      headline: filterForbidden(h, brand?.forbiddenWords ?? []),
      description: filterForbidden(
        descriptions[i % descriptions.length],
        brand?.forbiddenWords ?? []
      ),
    })),
  };
}

export function generateCopy(
  objective: MarketingObjective,
  platform: "META" | "GOOGLE",
  brand?: BrandKnowledgeContext
): AdCopy {
  return platform === "META"
    ? generateMetaCopy(objective, brand)
    : generateGoogleCopy(objective, brand);
}
