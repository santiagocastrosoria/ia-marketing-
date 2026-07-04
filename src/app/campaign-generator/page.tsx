"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import { formatARS, formatARSDaily } from "@/lib/utils/formatARS";
import { isReadOnlyMode } from "@/lib/utils/config";
import type {
  CampaignBlueprint,
  CampaignGeneratorChannel,
  CampaignGeneratorGoal,
  LuxuryLevel,
} from "@/lib/types/campaignBlueprint";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/campaign-generator/statusLabels";
import {
  Loader2,
  Sparkles,
  Eye,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CampaignGeneratorPage() {
  const [productOffer, setProductOffer] = useState(
    "Livings y reposeras de aluminio con tela náutica"
  );
  const [targetZone, setTargetZone] = useState("Buenos Aires — Zona Norte");
  const [dailyBudget, setDailyBudget] = useState(80000);
  const [suggestedDurationDays, setSuggestedDurationDays] = useState(21);
  const [channelPreference, setChannelPreference] =
    useState<CampaignGeneratorChannel>("INSTAGRAM_PRIORITY");
  const [campaignGoal, setCampaignGoal] =
    useState<CampaignGeneratorGoal>("WHATSAPP_LEADS");
  const [luxuryLevel, setLuxuryLevel] = useState<LuxuryLevel>("premium");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<CampaignBlueprint | null>(null);
  const [history, setHistory] = useState<CampaignBlueprint[]>([]);
  const [metaBlockMessage, setMetaBlockMessage] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchJson<{ blueprints: CampaignBlueprint[] }>(
        "/api/campaign-generator/generate"
      );
      setHistory(data.blueprints ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setMetaBlockMessage(null);
    setBlueprint(null);

    try {
      const data = await fetchJson<{ blueprint: CampaignBlueprint }>(
        "/api/campaign-generator/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productOffer,
            targetZone,
            dailyBudget,
            suggestedDurationDays,
            channelPreference,
            campaignGoal,
            luxuryLevel,
            additionalNotes,
          }),
        }
      );
      setBlueprint(data.blueprint);
      await loadHistory();
    } catch (err) {
      const message =
        err instanceof FetchApiError ? err.message : "Error al generar propuesta";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateInMeta = async () => {
    if (!blueprint) return;
    setMetaBlockMessage(null);
    try {
      await fetchJson(`/api/campaign-generator/${blueprint.id}/create-in-meta`, {
        method: "POST",
      });
    } catch (err) {
      if (err instanceof FetchApiError && err.code === "READ_ONLY_MODE") {
        setMetaBlockMessage(err.message);
      } else {
        setMetaBlockMessage(
          err instanceof Error ? err.message : "No se puede crear en Meta"
        );
      }
    }
  };

  const loadBlueprint = async (id: string) => {
    try {
      const data = await fetchJson<{ blueprint: CampaignBlueprint }>(
        `/api/campaign-generator/${id}`
      );
      setBlueprint(data.blueprint);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof FetchApiError ? err.message : "Error al cargar");
    }
  };

  const proposal = blueprint?.proposal;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-500" />
            <h1 className="text-2xl font-bold text-slate-900">
              Generador de campañas
            </h1>
          </div>
          <p className="text-slate-600">
            Describí qué querés vender y generá una propuesta profesional para
            Maldivas Outdoor. Los borradores se guardan internamente — sin
            escritura en Meta.
          </p>
          {isReadOnlyMode() && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <Eye className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                ADS_MODE=read_only activo. Las propuestas usan insights Meta si
                hay datos, pero no se publica nada en la plataforma.
              </span>
            </div>
          )}
        </header>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Brief en lenguaje natural">
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">
                    ¿Qué querés vender?
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                    value={productOffer}
                    onChange={(e) => setProductOffer(e.target.value)}
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Zona objetivo</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={targetZone}
                    onChange={(e) => setTargetZone(e.target.value)}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">
                      Presupuesto diario (ARS)
                    </span>
                    <input
                      type="number"
                      min={5000}
                      step={5000}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">
                      Duración (días)
                    </span>
                    <input
                      type="number"
                      min={7}
                      max={90}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={suggestedDurationDays}
                      onChange={(e) =>
                        setSuggestedDurationDays(Number(e.target.value))
                      }
                    />
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">
                    Canal preferido
                  </span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={channelPreference}
                    onChange={(e) =>
                      setChannelPreference(e.target.value as CampaignGeneratorChannel)
                    }
                  >
                    <option value="INSTAGRAM_PRIORITY">
                      Instagram prioritario
                    </option>
                    <option value="META_FULL">Meta completo (IG + FB)</option>
                    <option value="GOOGLE_FUTURE">Google (futuro)</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Objetivo</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={campaignGoal}
                    onChange={(e) =>
                      setCampaignGoal(e.target.value as CampaignGeneratorGoal)
                    }
                  >
                    <option value="WHATSAPP_LEADS">WhatsApp leads</option>
                    <option value="WEB_TRAFFIC">Tráfico web</option>
                    <option value="AWARENESS">Reconocimiento</option>
                    <option value="REMARKETING">Remarketing</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">
                    Nivel de lujo
                  </span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={luxuryLevel}
                    onChange={(e) =>
                      setLuxuryLevel(e.target.value as LuxuryLevel)
                    }
                  >
                    <option value="premium">Premium</option>
                    <option value="ultra_premium">Ultra premium</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">
                    Notas adicionales (opcional)
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                  />
                </label>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando propuesta…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generar campaña
                    </>
                  )}
                </Button>
              </div>
            </Section>

            <Section title="Propuestas guardadas">
              {loadingHistory ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Todavía no hay borradores. Generá la primera propuesta.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => loadBlueprint(item.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50/50"
                        >
                          <div className="font-medium text-slate-800 line-clamp-1">
                            {item.proposal.campaignName}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span
                              className={`rounded px-1.5 py-0.5 ${STATUS_COLORS[item.status]}`}
                            >
                              {STATUS_LABELS[item.status]}
                            </span>
                            <span>{formatARSDaily(item.input.dailyBudget)}</span>
                          </div>
                        </button>
                        <Link
                          href={`/campaign-generator/${item.id}/review`}
                          className="flex items-center gap-1 border-t border-slate-100 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          <ClipboardCheck className="h-3 w-3" />
                          Revisar campaña
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="space-y-4 lg:col-span-3">
            {!proposal ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                <div>
                  <Sparkles className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm">
                    Completá el brief y generá una propuesta completa con
                    estructura, copies y checklist de assets.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                  <div>
                    <p className="text-xs font-medium uppercase text-indigo-600">
                      Propuesta generada
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {proposal.campaignName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {proposal.recommendationSummary}
                    </p>
                  </div>
                  {blueprint && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[blueprint.status]}`}
                    >
                      {STATUS_LABELS[blueprint.status]}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Objetivo y estructura">
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-slate-500">Objetivo</dt>
                        <dd className="font-medium">{proposal.objective}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Meta objective</dt>
                        <dd>{proposal.metaObjective}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Tipo</dt>
                        <dd>{proposal.structure.campaignType}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Presupuesto</dt>
                        <dd>
                          {formatARSDaily(proposal.budget.dailyBudget)} · total{" "}
                          {formatARS(proposal.structure.totalBudgetEstimate)}
                        </dd>
                      </div>
                    </dl>
                  </Section>

                  <Section title="Calendario">
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-slate-500">Inicio sugerido</dt>
                        <dd>{proposal.calendar.suggestedStart}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Fin sugerido</dt>
                        <dd>{proposal.calendar.suggestedEnd}</dd>
                      </div>
                    </dl>
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      {proposal.calendar.phases.map((p) => (
                        <li key={p.label}>
                          <strong>{p.label}:</strong> {p.focus}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>

                <Section title="Ad sets sugeridos">
                  <div className="space-y-3">
                    {proposal.adSets.map((set) => (
                      <div
                        key={set.name}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                      >
                        <div className="font-semibold text-slate-800">
                          {set.name}{" "}
                          <span className="font-normal text-slate-500">
                            ({set.dailyBudgetShare}%)
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600">{set.audienceSummary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {set.optimizationGoal} · {set.placements.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {proposal.budget.allocationNotes}
                  </p>
                </Section>

                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Públicos">
                    <BulletList items={proposal.audiences} />
                  </Section>
                  <Section title="Ubicaciones">
                    <BulletList items={proposal.locations} />
                  </Section>
                </div>

                <Section title="Placements Instagram / Meta">
                  <BulletList
                    items={[
                      proposal.placements.placementStrategy,
                      `Formatos: ${proposal.placements.formats.join(", ")}`,
                      `IG: ${proposal.placements.instagramPositions.join(", ")}`,
                      ...(proposal.placements.facebookPositions.length
                        ? [
                            `FB: ${proposal.placements.facebookPositions.join(", ")}`,
                          ]
                        : []),
                    ]}
                  />
                  {proposal.metaInsightsUsed.used && (
                    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      Insights Meta: {proposal.metaInsightsUsed.insightRowCount}{" "}
                      filas · {proposal.metaInsightsUsed.campaignCount} campañas
                      {proposal.metaInsightsUsed.topPlacements.length > 0 && (
                        <span>
                          {" "}
                          · mejor placement:{" "}
                          {proposal.metaInsightsUsed.topPlacements[0].placement}
                        </span>
                      )}
                    </div>
                  )}
                </Section>

                <Section title="Ángulos creativos">
                  <BulletList items={proposal.creativeAngles} />
                </Section>

                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Copy principal">
                    <p className="text-sm text-slate-700">
                      {proposal.copies.primaryText}
                    </p>
                    <div className="mt-3 space-y-1">
                      {proposal.copies.headlines.slice(0, 3).map((h) => (
                        <p key={h} className="text-sm font-medium text-slate-800">
                          {h}
                        </p>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-indigo-600">
                      CTA: {proposal.copies.cta}
                    </p>
                  </Section>
                  <Section title="Stories">
                    <BulletList items={proposal.copies.stories} />
                  </Section>
                </div>

                <Section title="Reels">
                  <BulletList items={proposal.copies.reels} />
                </Section>

                <Section title="Recomendaciones visuales">
                  <BulletList items={proposal.visualRecommendations} />
                </Section>

                <Section title="Checklist de assets">
                  <ul className="space-y-2 text-sm">
                    {proposal.assetsChecklist.map((asset) => (
                      <li
                        key={asset.item}
                        className="flex items-center gap-2 text-slate-700"
                      >
                        {asset.required ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        )}
                        <span>
                          {asset.item}
                          {asset.format ? ` (${asset.format})` : ""}
                          {asset.required ? " — requerido" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <Lock className="mb-2 h-4 w-4 text-slate-400" />
                  {proposal.readOnlyNotice}
                </div>

                <div className="flex flex-wrap gap-3">
                  {blueprint && (
                    <Link href={`/campaign-generator/${blueprint.id}/review`}>
                      <Button variant="primary" type="button">
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Revisar campaña
                      </Button>
                    </Link>
                  )}
                  <Button variant="secondary" onClick={handleCreateInMeta}>
                    Crear en Meta
                  </Button>
                </div>

                {metaBlockMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {metaBlockMessage}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
