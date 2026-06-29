"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import type { MarketingObjective, StrategyPlan } from "@/lib/types/marketing";
import { formatARS, formatARSDaily } from "@/lib/utils/formatARS";
import { REQUIRED_PROFILE_LABELS } from "@/lib/brand/knowledgeValidator";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import { Loader2, Layers, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";

interface CampaignError {
  message: string;
  completenessScore?: number;
  missingFields?: string[];
  businessId?: string;
}

function formatStrategyError(err: unknown): { code?: string; message: string; details?: string } {
  if (err instanceof FetchApiError) {
    const body = err.body ?? {};
    return {
      code: err.code,
      message: err.message,
      details: [
        body.details as string | undefined,
        body.objectiveId ? `objectiveId: ${body.objectiveId}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Error al cargar estrategia" };
}

function StrategyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryObjectiveId = searchParams.get("objectiveId");

  const [objectives, setObjectives] = useState<MarketingObjective[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyPlan | null>(null);
  const [loadingObjectives, setLoadingObjectives] = useState(true);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [brandWarning, setBrandWarning] = useState<string | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyErrorCode, setStrategyErrorCode] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<CampaignError | null>(null);
  const [successWarning, setSuccessWarning] = useState<string | null>(null);
  const autoGenerateAttempted = useRef(false);

  const syncQueryParam = useCallback(
    (objectiveId: string) => {
      if (searchParams.get("objectiveId") !== objectiveId) {
        router.replace(`/strategy?objectiveId=${objectiveId}`);
      }
    },
    [router, searchParams]
  );

  const loadObjectives = useCallback(async () => {
    setLoadingObjectives(true);
    try {
      const data = await fetchJson<{ objectives?: MarketingObjective[] }>("/api/objectives");
      const list = data.objectives ?? [];
      setObjectives(list);

      const fromQuery =
        queryObjectiveId && list.some((o) => o.id === queryObjectiveId)
          ? queryObjectiveId
          : null;
      const fromSession = sessionStorage.getItem("lastObjectiveId");
      const fromSessionValid =
        fromSession && list.some((o) => o.id === fromSession) ? fromSession : null;
      const latest = list[0]?.id ?? null;

      const resolved = fromQuery ?? fromSessionValid ?? latest;
      setSelectedObjectiveId(resolved);
      if (resolved) syncQueryParam(resolved);
    } catch (err) {
      const { code, message, details } = formatStrategyError(err);
      setStrategyErrorCode(code ?? "OBJECTIVES_LOAD_FAILED");
      setStrategyError(details ? `${message} — ${details}` : message);
    } finally {
      setLoadingObjectives(false);
    }
  }, [queryObjectiveId, syncQueryParam]);

  const loadExistingStrategy = useCallback(async (objectiveId: string) => {
    setLoadingStrategy(true);
    setStrategyError(null);
    setStrategyErrorCode(null);
    setStrategy(null);
    setBrandWarning(null);

    try {
      const data = await fetchJson<{
        strategy: StrategyPlan | null;
        brandKnowledge?: { isComplete: boolean; completenessScore: number };
      }>("/api/agent/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectiveId, loadOnly: true }),
      });

      setStrategy(data.strategy ?? null);
      if (data.brandKnowledge && !data.brandKnowledge.isComplete) {
        setBrandWarning(
          `Base de marca al ${data.brandKnowledge.completenessScore}%. Completala para mejores resultados.`
        );
      }
    } catch (err) {
      const { code, message, details } = formatStrategyError(err);
      setStrategyErrorCode(code ?? null);
      setStrategyError(details ? `${message} — ${details}` : message);
    } finally {
      setLoadingStrategy(false);
    }
  }, []);

  const generateStrategy = useCallback(
    async (regenerate = false) => {
      if (!selectedObjectiveId) return;
      setGenerating(true);
      setStrategyError(null);
      setStrategyErrorCode(null);
      if (regenerate) setStrategy(null);

      try {
        const data = await fetchJson<{
          strategy: StrategyPlan;
          brandKnowledge?: { isComplete: boolean; completenessScore: number };
        }>("/api/agent/generate-strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectiveId: selectedObjectiveId,
            regenerate,
          }),
        });

        setStrategy(data.strategy);
        if (data.brandKnowledge && !data.brandKnowledge.isComplete) {
          setBrandWarning(
            `Base de marca al ${data.brandKnowledge.completenessScore}%. Completala para mejores resultados.`
          );
        }
      } catch (err) {
        const { code, message, details } = formatStrategyError(err);
        setStrategyErrorCode(code ?? null);
        setStrategyError(details ? `${message} — ${details}` : message);
      } finally {
        setGenerating(false);
      }
    },
    [selectedObjectiveId]
  );

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  useEffect(() => {
    if (selectedObjectiveId) {
      loadExistingStrategy(selectedObjectiveId);
    }
  }, [selectedObjectiveId, loadExistingStrategy]);

  // Tras crear objetivo: /strategy?objectiveId=... → generar automáticamente si no hay plan
  useEffect(() => {
    if (
      autoGenerateAttempted.current ||
      loadingStrategy ||
      loadingObjectives ||
      strategy ||
      strategyError ||
      !selectedObjectiveId ||
      !queryObjectiveId ||
      queryObjectiveId !== selectedObjectiveId
    ) {
      return;
    }
    autoGenerateAttempted.current = true;
    void generateStrategy(false);
  }, [
    loadingStrategy,
    loadingObjectives,
    strategy,
    strategyError,
    selectedObjectiveId,
    queryObjectiveId,
    generateStrategy,
  ]);

  const handleObjectiveChange = (id: string) => {
    setSelectedObjectiveId(id);
    sessionStorage.setItem("lastObjectiveId", id);
    syncQueryParam(id);
  };

  const loadMaldivasBrand = async () => {
    try {
      const data = await fetchJson<{ businessId: string }>(
        "/api/brand-knowledge/preset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      localStorage.setItem("brandBusinessId", data.businessId);
      setCampaignError(null);
      alert("Preset Maldivas cargado en base de marca.");
    } catch (err) {
      alert(
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al cargar preset"
      );
    }
  };

  const generateCampaigns = async () => {
    if (!selectedObjectiveId || !strategy) return;
    setGenerating(true);
    setCampaignError(null);
    setSuccessWarning(null);
    try {
      const data = await fetchJson<{ warning?: string }>(
        "/api/agent/generate-campaign-plan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectiveId: selectedObjectiveId, strategyId: strategy.id }),
        }
      );
      if (data.warning) setSuccessWarning(data.warning);
      router.push("/campaigns");
    } catch (err) {
      if (
        err instanceof FetchApiError &&
        err.status === 422 &&
        err.code === "BRAND_KNOWLEDGE_INCOMPLETE"
      ) {
        const body = err.body as Record<string, unknown> | undefined;
        setCampaignError({
          message:
            err.message ??
            "No se pueden generar campañas todavía porque la base de marca está incompleta.",
          completenessScore:
            (body?.completionPercentage as number | undefined) ??
            (body?.completenessScore as number | undefined),
          missingFields: body?.missingFields as string[] | undefined,
          businessId: body?.businessId as string | undefined,
        });
        return;
      }
      alert(
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error"
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loadingObjectives) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-slate-500">Primero creá un objetivo en /objectives.</p>
        <Button onClick={() => router.push("/objectives")}>Ir a crear objetivo</Button>
      </div>
    );
  }

  const selectedObjective = objectives.find((o) => o.id === selectedObjectiveId);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">Objetivo activo</label>
        {objectives.length > 1 ? (
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={selectedObjectiveId ?? ""}
            onChange={(e) => handleObjectiveChange(e.target.value)}
          >
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.goal} — {formatARSDaily(o.daily_budget)}/día
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-800">
            {selectedObjective?.goal ?? "—"}{" "}
            <span className="text-slate-500">
              ({selectedObjective ? formatARSDaily(selectedObjective.daily_budget) : ""}/día)
            </span>
          </p>
        )}
        {selectedObjective && (
          <p className="text-xs text-slate-400 font-mono">ID: {selectedObjective.id}</p>
        )}
      </div>

      {strategyError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-medium text-red-900">
              {strategyErrorCode ? `[${strategyErrorCode}]` : "Error de estrategia"}
            </p>
            <p className="mt-1 text-sm text-red-800">{strategyError}</p>
          </div>
        </div>
      )}

      {loadingStrategy && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      )}

      {!loadingStrategy && !strategy && (
        <div className="text-center py-8 space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <p className="text-slate-600">
            No hay estrategia generada para este objetivo todavía.
          </p>
          <Button onClick={() => generateStrategy(false)} disabled={generating || !selectedObjectiveId}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generar estrategia para este objetivo
          </Button>
        </div>
      )}

      {strategy && (
        <StrategyPlanView
          strategy={strategy}
          brandWarning={brandWarning}
          campaignError={campaignError}
          successWarning={successWarning}
          generating={generating}
          onRegenerate={() => generateStrategy(true)}
          onGenerateCampaigns={generateCampaigns}
          onLoadMaldivasBrand={loadMaldivasBrand}
          onGoCampaigns={() => router.push("/campaigns")}
          onGoBrandKnowledge={() => router.push("/brand-knowledge")}
        />
      )}
    </div>
  );
}

function StrategyPlanView({
  strategy,
  brandWarning,
  campaignError,
  successWarning,
  generating,
  onRegenerate,
  onGenerateCampaigns,
  onLoadMaldivasBrand,
  onGoCampaigns,
  onGoBrandKnowledge,
}: {
  strategy: StrategyPlan;
  brandWarning: string | null;
  campaignError: CampaignError | null;
  successWarning: string | null;
  generating: boolean;
  onRegenerate: () => void;
  onGenerateCampaigns: () => void;
  onLoadMaldivasBrand: () => void;
  onGoCampaigns: () => void;
  onGoBrandKnowledge: () => void;
}) {
  return (
    <div className="space-y-6">
      {brandWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {brandWarning}
        </div>
      )}

      {campaignError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-900">{campaignError.message}</p>
              {campaignError.completenessScore !== undefined && (
                <p className="text-sm text-red-800 mt-1">
                  Completitud: {campaignError.completenessScore}%
                </p>
              )}
              {campaignError.missingFields && campaignError.missingFields.length > 0 && (
                <ul className="mt-2 text-sm text-red-800 list-disc pl-4">
                  {campaignError.missingFields.map((f) => (
                    <li key={f}>{REQUIRED_PROFILE_LABELS[f] ?? f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button size="sm" onClick={onGoBrandKnowledge}>
              Ir a Base de marca
            </Button>
            <Button size="sm" variant="secondary" onClick={onLoadMaldivasBrand}>
              Cargar preset Maldivas
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="font-semibold text-indigo-900">Diagnóstico inicial</h2>
        <p className="mt-2 text-sm text-indigo-800 whitespace-pre-wrap">{strategy.diagnosis}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard title="Etapa del embudo" value={strategy.recommendedFunnelStage} />
        <InfoCard title="Calentamiento vs conversión" value={strategy.warmupVsConversion} />
        <InfoCard title="Creatividades" value={strategy.requiredCreatives.join(", ")} />
      </div>

      <Section title="Distribución de presupuesto">
        <div className="space-y-2">
          {strategy.budgetDistribution.map((b) => (
            <div
              key={b.platform}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
            >
              <span className="font-medium">{b.platform}</span>
              <span className="text-sm text-slate-600">
                {b.percentage}% — {formatARSDaily(b.dailyAmount)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Campañas recomendadas">
        <div className="space-y-3">
          {strategy.recommendedCampaigns.map((c) => (
            <div key={`${c.platform}-${c.name}`} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                  {c.platform}
                </span>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-slate-400">({c.funnelStage})</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{c.rationale}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Keywords recomendadas">
          <TagList items={strategy.recommendedKeywords} color="indigo" />
        </Section>
        <Section title="Keywords negativas">
          <TagList items={strategy.negativeKeywords} color="red" />
        </Section>
      </div>

      <Section title="Mensajes principales">
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          {strategy.mainMessages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>

      <Section title="CTAs">
        <TagList items={strategy.ctas} color="emerald" />
      </Section>

      <Section title="Métricas clave">
        <TagList items={strategy.keyMetrics} color="slate" />
      </Section>

      <Section title="Criterios de éxito">
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          {strategy.successCriteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title="Plan de optimización">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <OptimizationBlock title="7 días" items={strategy.optimizationPlan.day7} />
          <OptimizationBlock title="14 días" items={strategy.optimizationPlan.day14} />
          <OptimizationBlock title="30 días" items={strategy.optimizationPlan.day30} />
        </div>
      </Section>

      {successWarning && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {successWarning}
        </p>
      )}

      <div className="flex flex-wrap gap-4 pt-4">
        <Button onClick={onGenerateCampaigns} disabled={generating} size="lg">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Layers className="h-4 w-4" />
          )}
          Crear campañas pausadas
        </Button>
        <Button variant="secondary" onClick={onRegenerate} disabled={generating}>
          Regenerar estrategia
        </Button>
        <Button variant="secondary" onClick={onGoCampaigns}>
          Ver campañas
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function StrategyPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Generador de estrategia</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plan completo generado por el agente IA según tu objetivo (presupuestos en ARS)
          </p>
        </div>
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
          <StrategyContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  );
}

function TagList({
  items,
  color,
}: {
  items: string[];
  color: "indigo" | "red" | "emerald" | "slate";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    red: "bg-red-50 text-red-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2.5 py-0.5 text-xs ${colors[color]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function OptimizationBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
