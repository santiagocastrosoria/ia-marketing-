import type { CreateObjectiveInput } from "@/lib/types/marketing";

export const MALDIVAS_OUTDOOR_PRESET: CreateObjectiveInput = {
  businessName: "Maldivas Outdoor",
  industry: "Muebles de exterior premium",
  product:
    "Livings, reposeras, camastros, mesas, sillas y barras de exterior. Materiales: aluminio, telas náuticas, piedras premium, diseño a medida.",
  goal: "Consultas por WhatsApp y solicitudes de presupuesto",
  dailyBudget: 150000,
  monthlyBudget: 4500000,
  locations: [
    "Córdoba",
    "Buenos Aires",
    "Zona Norte",
    "Uruguay / Punta del Este (opcional)",
  ],
  platforms: "BOTH",
  idealCustomer:
    "Dueños de casas premium, countries, arquitectos, estudios de arquitectura, desarrollistas, personas con pileta, terrazas, galerías y jardines",
  averageTicket: 850000,
  brandAwarenessLevel: "medium",
  landingUrl: "https://maldivasoutdoor.com",
  whatsappUrl: "https://wa.me/5493510000000",
  creativeTypes: ["image", "video", "instagram", "web"],
  restrictions:
    "No mostrar a públicos equivocados. Excluir búsquedas de barato, usado, interior, electrodomésticos. Posicionamiento: lujo, diseño, calidad, durabilidad, terminaciones premium.",
};

export const MALDIVAS_BUDGET_PRESETS_ARS = {
  low: 20000,
  medium: 50000,
  strong: 150000,
  monthlyStrong: 4500000,
};

export const MALDIVAS_KEYWORDS = [
  "muebles de exterior",
  "muebles de exterior premium",
  "reposeras para pileta",
  "reposeras premium",
  "camastros para pileta",
  "living exterior",
  "sillones de exterior",
  "muebles outdoor",
  "muebles para terraza",
  "muebles para galería",
  "muebles para jardín premium",
  "muebles de aluminio exterior",
  "mesa exterior premium",
  "muebles para quincho",
  "muebles para country",
];

export const MALDIVAS_NEGATIVE_KEYWORDS = [
  "electrodomésticos",
  "heladera",
  "lavarropas",
  "microondas",
  "muebles de interior",
  "ropero",
  "cama",
  "colchón",
  "escritorio",
  "silla oficina",
  "barato",
  "gratis",
  "usado",
  "segunda mano",
  "reparar",
  "tutorial",
  "planos",
  "ikea",
  "mercado libre usado",
];