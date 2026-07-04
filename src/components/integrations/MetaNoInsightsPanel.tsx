import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MetaDatePreset } from "@/lib/ads/metaDatePresets";
import { META_NO_INSIGHTS_MESSAGE } from "@/lib/ads/metaDatePresets";

export function MetaNoInsightsPanel({
  onTryPreset,
}: {
  onTryPreset?: (preset: MetaDatePreset) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 space-y-3">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-800">Sin datos de Meta para este período</p>
          <p className="mt-1 text-slate-600">{META_NO_INSIGHTS_MESSAGE}</p>
        </div>
      </div>
      <ul className="list-disc list-inside space-y-1 text-slate-600 ml-8">
        <li>Probá un rango más amplio (últimos 90 días o máximo histórico).</li>
        <li>Revisá en Ads Manager si hubo campañas activas con gasto o entrega.</li>
        <li>
          Cuando habilitemos draft/live approval podrás crear una campaña de prueba; en
          read_only no se crean campañas reales.
        </li>
      </ul>
      {onTryPreset && (
        <div className="flex flex-wrap gap-2 ml-8">
          <Button size="sm" variant="secondary" onClick={() => onTryPreset("last_90d")}>
            Probar últimos 90 días
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onTryPreset("maximum")}>
            Probar máximo histórico
          </Button>
        </div>
      )}
    </div>
  );
}
