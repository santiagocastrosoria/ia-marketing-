import type { MetaDatePreset } from "@/lib/ads/metaDatePresets";
import { META_DATE_PRESETS } from "@/lib/ads/metaDatePresets";

export function MetaInsightsPeriodSelect({
  value,
  onChange,
  className = "rounded-lg border border-slate-300 px-3 py-2 text-sm",
}: {
  value: MetaDatePreset;
  onChange: (value: MetaDatePreset) => void;
  className?: string;
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as MetaDatePreset)}
    >
      {META_DATE_PRESETS.map((preset) => (
        <option key={preset.value} value={preset.value}>
          {preset.label}
        </option>
      ))}
    </select>
  );
}
