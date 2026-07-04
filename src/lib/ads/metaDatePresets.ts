export const META_DATE_PRESETS = [
  { value: "last_7d", label: "Últimos 7 días" },
  { value: "last_30d", label: "Últimos 30 días" },
  { value: "last_90d", label: "Últimos 90 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "maximum", label: "Máximo histórico disponible" },
] as const;

export type MetaDatePreset = (typeof META_DATE_PRESETS)[number]["value"];

export const META_NO_INSIGHTS_CODE = "NO_INSIGHTS_DATA" as const;

export const META_NO_INSIGHTS_MESSAGE =
  "No hay datos reales de Meta para este período. Esto puede pasar si no hubo campañas activas, gasto o entrega durante el rango seleccionado.";

const PRESET_VALUES = new Set<string>(META_DATE_PRESETS.map((p) => p.value));

export function isValidMetaDatePreset(value: string): value is MetaDatePreset {
  return PRESET_VALUES.has(value);
}

export function normalizeMetaDatePreset(value?: string | null): MetaDatePreset {
  if (value && isValidMetaDatePreset(value)) return value;
  return "last_30d";
}

export function metaDatePresetLabel(value: MetaDatePreset): string {
  return META_DATE_PRESETS.find((p) => p.value === value)?.label ?? value;
}
