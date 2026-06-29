import type { BrandDocumentInput, BrandProfileInput } from "@/lib/types/brand";

export const MALDIVAS_BRAND_PROFILE: Omit<
  BrandProfileInput,
  "business_id"
> = {
  positioning:
    "Marca premium de muebles de exterior. Lujo, diseño, calidad, durabilidad y terminaciones premium. No competimos por precio.",
  brand_voice:
    "Elegante, aspiracional, cercano pero selecto. Tono premium sin agresividad comercial. Evitar descuentos y lenguaje masivo.",
  ideal_customer:
    "Dueños de casas premium, countries, arquitectos, estudios de arquitectura, desarrollistas, personas con pileta, terrazas, galerías y jardines.",
  main_products:
    "Livings, reposeras, camastros, mesas, sillas y barras de exterior.",
  materials:
    "Aluminio, telas náuticas, piedras premium, diseño a medida.",
  differentiators:
    "Diseño exclusivo, materiales de exterior de primera, terminaciones premium, proyectos a medida, asesoramiento para arquitectos.",
  locations: [
    "Córdoba",
    "Buenos Aires",
    "Zona Norte",
    "Uruguay / Punta del Este",
  ],
  preferred_words: [
    "premium",
    "alta gama",
    "a medida",
    "exterior",
    "diseño",
    "durabilidad",
    "proyectos exclusivos",
    "outdoor living",
  ],
  forbidden_words: [
    "barato",
    "gratis",
    "usado",
    "descuento",
    "oferta",
    "liquidación",
    "ikea",
    "mercado libre",
  ],
  primary_cta: "Consultar por WhatsApp",
  secondary_cta: "Solicitar presupuesto personalizado",
};

export const MALDIVAS_BRAND_DOCUMENTS: Omit<
  BrandDocumentInput,
  "business_id"
>[] = [
  {
    title: "Preguntas frecuentes",
    document_type: "faq",
    content_text: `¿Hacen envíos? Sí, en Córdoba, Buenos Aires y Zona Norte.
¿Trabajan con arquitectos? Sí, asesoramos estudios y desarrollistas.
¿Cuál es el tiempo de entrega? Varía según proyecto a medida, consultar.
¿Los materiales resisten intemperie? Sí, aluminio y telas náuticas de alta durabilidad.`,
  },
  {
    title: "Objeciones comunes",
    document_type: "objection",
    content_text: `"Es muy caro" → Enfatizar durabilidad, materiales premium y valor a largo plazo.
"Solo estoy mirando" → Ofrecer asesoramiento sin compromiso para proyectos reales.
"Vi más barato" → No competimos por precio; calidad, diseño y terminaciones superiores.`,
  },
  {
    title: "Competidores",
    document_type: "competitor",
    content_text:
      "Competidores low-cost de interior y retail masivo. Diferenciarse por exclusividad, materiales de exterior y diseño a medida.",
  },
  {
    title: "Rango de precios",
    document_type: "price_range",
    content_text:
      "Ticket promedio $850.000 ARS. Proyectos premium desde living completo. No publicar precios en anuncios.",
  },
  {
    title: "Links importantes",
    document_type: "important_links",
    content_text: "",
    metadata_json: {
      links: [
        { label: "Sitio web", url: "https://maldivasoutdoor.com" },
        { label: "WhatsApp", url: "https://wa.me/5493510000000" },
        { label: "Instagram", url: "https://instagram.com/maldivasoutdoor" },
      ],
    },
  },
];
