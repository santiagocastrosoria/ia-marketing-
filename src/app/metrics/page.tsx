"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/Badges";
import type {
  CampaignMetrics,
  CampaignPlan,
  Recommendation,
  InstagramPosition,
  AggregatedPlacementRow,
  MarketingObjective,
} from "@/lib/types/marketing";
import type { MetaInsightsResult } from "@/lib/ads/metaInsightsService";
import { instagramPositionLabel } from "@/lib/ads/metaPlacements";
import { Loader2, BarChart3, Sparkles, AlertTriangle, Camera } from "lucide-react";
import Link from "next/link";
import { MetaInsightsPeriodSelect } from "@/components/integrations/MetaInsightsPeriodSelect";
import { MetaNoInsightsPanel } from "@/components/integrations/MetaNoInsightsPanel";
import { formatARS } from "@/lib/utils/formatARS";
import type { MetaDatePreset } from "@/lib/ads/metaDatePresets";
import { META_NO_INSIGHTS_CODE } from "@/lib/ads/metaDatePresets";
import type { MetaInsightRow } from "@/lib/ads/metaRealService";
import type { MetaIntegrationStatus } from "@/lib/ads/metaConfig";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";

const META_PERMISSION_MESSAGE =
  "No se pudieron importar métricas reales de Meta/Instagram. Falta permiso ads_read sobre la cuenta publicitaria.";

const META_PERMISSION_SUGGESTION =
  "Revisá Business Settings → Usuarios del sistema → Activos → Cuenta publicitaria → Ver rendimiento / Administrar campañas.";

type AnalysisScope = "campaign" | "objective" | "all";
type MetricsSource = "simulated" | "meta_real";

type AnalysisResult = {
  summary: string;
  insights: { metric: string; diagnosis: string; severity: string }[];
  placementInsights?: {
    simulated?: boolean;
    aggregated?: boolean;
    campaignCount?: number;
    instagramVsFacebook?: string;
    reelsVsStoriesVsFeed?: string;
    topPlacement?: string;
    channelInsights?: string[];
  };
  aggregatedPlacementRows?: AggregatedPlacementRow[];
};

const adsMode =
  process.env.NEXT_PUBLIC_ADS_MODE ?? process.env.ADS_MODE ?? "mock";

export default function MetricsPage() {
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([]);
  const [objectives, setObjectives] = useState<MarketingObjective[]>([]);
  const [latestObjectiveId, setLatestObjectiveId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [placementBreakdown, setPlacementBreakdown] =
    useState<MetaInsightsResult | null>(null);
  const [aggregatedRows, setAggregatedRows] = useState<AggregatedPlacementRow[]>([]);
  const [analyzeScope, setAnalyzeScope] = useState<AnalysisScope>("objective");
  const [metricsSource, setMetricsSource] = useState<MetricsSource>("simulated");
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [metaIntegration, setMetaIntegration] = useState<MetaIntegrationStatus | null>(null);
  const [realMetaRows, setRealMetaRows] = useState<MetaInsightRow[]>([]);
  const [realMetaLoading, setRealMetaLoading] = useState(false);
  const [realMetaError, setRealMetaError] = useState<string | null>(null);
  const [realMetaPermissionDenied, setRealMetaPermissionDenied] = useState(false);
  const [realMetaNoData, setRealMetaNoData] = useState(false);
  const [metaDatePreset, setMetaDatePreset] = useState<MetaDatePreset>("last_30d");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedObjective, setSelectedObjective] = useState<string>("");

  const load = () => {
    const params = new URLSearchParams({ period });
    if (analyzeScope === "campaign" && selectedCampaign) {
      params.set("campaignPlanId", selectedCampaign);
    }
    fetchJson<{
      metrics?: CampaignMetrics[];
      campaigns?: CampaignPlan[];
      objectives?: MarketingObjective[];
      latestObjectiveId?: string;
    }>(`/api/metrics?${params}`)
      .then((data) => {
        setMetrics(data.metrics ?? []);
        setCampaigns(data.campaigns ?? []);
        setObjectives(data.objectives ?? []);
        if (data.latestObjectiveId) {
          setLatestObjectiveId(data.latestObjectiveId);
          if (!selectedObjective) setSelectedObjective(data.latestObjectiveId);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [period, selectedCampaign, analyzeScope]);

  useEffect(() => {
    fetchJson<{ meta?: MetaIntegrationStatus }>("/api/integrations/status")
      .then((data) => {
        setMetaIntegration(data.meta ?? null);
        setMetaConfigured(!!data.meta?.metaReadEnabled);
      })
      .catch(() => {
        setMetaConfigured(false);
        setMetaIntegration(null);
      });
  }, []);

  const loadRealMetaInsights = async (preset: MetaDatePreset = metaDatePreset) => {
    setRealMetaLoading(true);
    setRealMetaError(null);
    setRealMetaPermissionDenied(false);
    setRealMetaNoData(false);
    setRealMetaRows([]);
    try {
      const data = await fetchJson<{
        rows: MetaInsightRow[];
        code?: string;
        status?: string;
        message?: string;
        meta?: MetaIntegrationStatus;
      }>(`/api/integrations/meta/insights?datePreset=${preset}`);
      setRealMetaRows(data.rows ?? []);
      if (data.meta) setMetaIntegration(data.meta);
      if ((data.rows ?? []).length === 0) {
        if (data.code === META_NO_INSIGHTS_CODE || data.status === "no_data") {
          setRealMetaNoData(true);
        } else {
          setRealMetaError(data.message ?? "No se pudieron cargar métricas Meta");
        }
      }
    } catch (err) {
      setRealMetaRows([]);
      if (err instanceof FetchApiError && err.code === "META_PERMISSION_DENIED") {
        setRealMetaPermissionDenied(true);
        setRealMetaError(META_PERMISSION_MESSAGE);
        if (err.body?.meta) setMetaIntegration(err.body.meta as MetaIntegrationStatus);
      } else {
        setRealMetaError(
          err instanceof FetchApiError ? err.message : "No se pudieron cargar métricas Meta"
        );
      }
    } finally {
      setRealMetaLoading(false);
    }
  };

  const tryMetaDatePreset = (preset: MetaDatePreset) => {
    setMetaDatePreset(preset);
  };

  useEffect(() => {
    if (metricsSource === "meta_real" && adsMode === "read_only" && metaConfigured) {
      loadRealMetaInsights(metaDatePreset);
    }
  }, [metricsSource, metaDatePreset, metaConfigured]);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const scope = analyzeScope;
      const body: Record<string, unknown> = {
        scope,
        generateMock: true,
      };
      if (scope === "campaign") {
        body.campaignPlanId = selectedCampaign || campaigns[0]?.id;
      } else if (scope === "objective") {
        body.objectiveId = selectedObjective || latestObjectiveId;
      }

      const data = await fetchJson<{
        analysis: AnalysisResult;
        recommendations?: Recommendation[];
        placementBreakdown?: MetaInsightsResult | null;
        aggregatedPlacementRows?: AggregatedPlacementRow[];
        scope?: AnalysisScope;
      }>("/api/metrics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAnalysis(data.analysis);
      setPlacementBreakdown(data.placementBreakdown ?? null);
      setAggregatedRows(
        data.aggregatedPlacementRows ??
          data.analysis.aggregatedPlacementRows ??
          []
      );
      setRecommendations(data.recommendations ?? []);
      load();
    } catch (err) {
      alert(
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const applyRecommendation = async (id: string) => {
    try {
      const data = await fetchJson<{ message?: string }>(
        `/api/recommendations/${id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      alert(data.message ?? "Recomendación aplicada");
    } catch (err) {
      if (err instanceof FetchApiError && err.code === "APPROVAL_REQUIRED") {
        const approvalId = err.body?.approvalRequestId as string | undefined;
        alert(
          `Requiere aprobación humana.${approvalId ? ` ID: ${approvalId}` : ""} Revisá /approvals.`
        );
        return;
      }
      alert(
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error"
      );
    }
  };

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      leads: acc.leads + m.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 }
  );

  const avgCtr =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.ctr, 0) / metrics.length
      : 0;
  const avgCpc =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.cpc, 0) / metrics.length
      : 0;
  const avgCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analizador de métricas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Rendimiento por canal Meta — Instagram vs Facebook y placements
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={metricsSource}
              onChange={(e) => setMetricsSource(e.target.value as MetricsSource)}
            >
              <option value="simulated">Métricas simuladas</option>
              <option
                value="meta_real"
                disabled={adsMode !== "read_only" || !metaConfigured}
              >
                Métricas reales Meta/Instagram
                {adsMode !== "read_only" || !metaConfigured ? " (no disponible)" : ""}
              </option>
            </select>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={analyzeScope}
              onChange={(e) => setAnalyzeScope(e.target.value as AnalysisScope)}
            >
              <option value="campaign">Campaña individual</option>
              <option value="objective">Todas del objetivo actual</option>
              <option value="all">Todas mis campañas</option>
            </select>
            {metricsSource === "meta_real" ? (
              <MetaInsightsPeriodSelect
                value={metaDatePreset}
                onChange={setMetaDatePreset}
              />
            ) : (
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="1">Hoy</option>
                <option value="7">7 días</option>
                <option value="14">14 días</option>
                <option value="30">30 días</option>
              </select>
            )}
            {analyzeScope === "campaign" && (
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm max-w-xs"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
              >
                <option value="">Seleccionar campaña</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaignName}
                  </option>
                ))}
              </select>
            )}
            {analyzeScope === "objective" && (
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm max-w-xs"
                value={selectedObjective || latestObjectiveId || ""}
                onChange={(e) => setSelectedObjective(e.target.value)}
              >
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.goal.slice(0, 50)}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={analyze} disabled={analyzing || metricsSource === "meta_real"}>
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analizar métricas
            </Button>
          </div>
        </div>

        <MetricsSourceBanner
          adsMode={adsMode}
          metricsSource={metricsSource}
          permissionDenied={realMetaPermissionDenied}
          noData={realMetaNoData}
          simulated={
            metricsSource === "simulated" ||
            adsMode === "mock" ||
            placementBreakdown?.simulated === true ||
            analysis?.placementInsights?.simulated === true
          }
          source={metricsSource === "meta_real" ? "meta_api" : placementBreakdown?.source}
        />

        {metricsSource === "meta_real" && adsMode === "read_only" && !realMetaPermissionDenied && !realMetaNoData && realMetaRows.length > 0 && !realMetaLoading && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Métricas reales de Meta/Instagram en solo lectura</p>
            <p className="mt-1 text-emerald-800">
              Datos importados desde Meta Marketing API. No podés crear, editar ni activar
              campañas desde esta app.
            </p>
          </div>
        )}

        {metricsSource === "meta_real" && realMetaLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        )}

        {metricsSource === "meta_real" && realMetaPermissionDenied && !realMetaLoading && (
          <MetaPermissionErrorPanel suggestion={metaIntegration?.permissionSuggestion} />
        )}

        {metricsSource === "meta_real" && realMetaNoData && !realMetaLoading && !realMetaPermissionDenied && (
          <MetaNoInsightsPanel
            onTryPreset={(preset) => {
              tryMetaDatePreset(preset);
            }}
          />
        )}

        {metricsSource === "meta_real" && realMetaError && !realMetaLoading && !realMetaPermissionDenied && !realMetaNoData && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {realMetaError}
          </div>
        )}

        {metricsSource === "meta_real" && realMetaRows.length > 0 && !realMetaLoading && (
          <RealMetaInsightsTable rows={realMetaRows} />
        )}

        {metricsSource === "simulated" && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <MetricCard label="Gasto" value={formatARS(totals.spend)} />
          <MetricCard label="Impresiones" value={totals.impressions.toLocaleString("es-AR")} />
          <MetricCard label="Clics" value={totals.clicks.toLocaleString("es-AR")} />
          <MetricCard label="CTR" value={`${avgCtr.toFixed(2)}%`} />
          <MetricCard label="CPC" value={formatARS(avgCpc)} />
          <MetricCard label="Leads" value={totals.leads.toString()} />
          <MetricCard label="CPL" value={avgCpl > 0 ? formatARS(avgCpl) : "—"} />
          <MetricCard
            label="Conv. rate"
            value={
              totals.clicks > 0
                ? `${((totals.leads / totals.clicks) * 100).toFixed(2)}%`
                : "—"
            }
          />
        </div>
        )}

        {metricsSource === "simulated" && analysis && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Diagnóstico del agente
            </h2>
            <p className="mt-2 text-sm text-indigo-800">{analysis.summary}</p>
            {analysis.placementInsights && (
              <div className="mt-4 space-y-2 rounded-lg bg-white/60 p-3 text-sm text-indigo-900">
                {analysis.placementInsights.instagramVsFacebook && (
                  <p>
                    <span className="font-semibold">Instagram vs Facebook: </span>
                    {analysis.placementInsights.instagramVsFacebook}
                  </p>
                )}
                {analysis.placementInsights.reelsVsStoriesVsFeed && (
                  <p>
                    <span className="font-semibold">Reels / Stories / Feed: </span>
                    {analysis.placementInsights.reelsVsStoriesVsFeed}
                  </p>
                )}
                {analysis.placementInsights.topPlacement && (
                  <p>
                    <span className="font-semibold">Mejor placement: </span>
                    {analysis.placementInsights.topPlacement}
                  </p>
                )}
                {analysis.placementInsights.channelInsights?.map((line) => (
                  <p key={line}>
                    <span className="font-semibold">Insight: </span>
                    {line}
                  </p>
                ))}
              </div>
            )}
            {analysis.insights.length > 0 && (
              <div className="mt-4 space-y-2">
                {analysis.insights.map((insight, i) => (
                  <div key={i} className="rounded-lg bg-white/60 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700">
                        {insight.metric}
                      </span>
                      <RiskBadge level={insight.severity as "LOW" | "MEDIUM" | "HIGH"} />
                    </div>
                    <p className="mt-1 text-sm text-indigo-900">{insight.diagnosis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {metricsSource === "simulated" && aggregatedRows.length > 0 && (
          <AggregatedPlacementTable rows={aggregatedRows} />
        )}

        {metricsSource === "simulated" &&
          placementBreakdown &&
          placementBreakdown.rows.length > 0 &&
          aggregatedRows.length === 0 && (
          <PlacementBreakdownSection breakdown={placementBreakdown} />
        )}

        {metricsSource === "simulated" && recommendations.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Recomendaciones</h2>
            <div className="mt-4 space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start justify-between rounded-lg border border-slate-100 p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">{rec.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{rec.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{rec.reason}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs text-slate-500">
                        Impacto: {rec.expected_impact}
                      </span>
                      {rec.requires_approval && (
                        <span className="text-xs text-amber-600 font-medium">
                          Requiere aprobación
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RiskBadge level={rec.risk_level} />
                    <Button size="sm" onClick={() => applyRecommendation(rec.id)}>
                      Aplicar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {metricsSource === "simulated" && metrics.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Gasto</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Impr.</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Clics</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">CTR</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">CPC</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Leads</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">CPL</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Calidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.slice(0, 20).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{m.date}</td>
                    <td className="px-4 py-2 text-right">{formatARS(m.spend)}</td>
                    <td className="px-4 py-2 text-right">{m.impressions.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-2 text-right">{m.clicks}</td>
                    <td className="px-4 py-2 text-right">{m.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right">{formatARS(m.cpc)}</td>
                    <td className="px-4 py-2 text-right">{m.leads}</td>
                    <td className="px-4 py-2 text-right">{formatARS(m.cpl)}</td>
                    <td className="px-4 py-2 text-right">{m.lead_quality_score}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AggregatedPlacementTable({ rows }: { rows: AggregatedPlacementRow[] }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      <p className="px-4 py-3 text-sm font-semibold text-indigo-900 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <Camera className="h-4 w-4" />
        Desglose agregado por canal y placement
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Canal</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Placement</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Campañas</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Gasto ARS</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Impr.</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Clics</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CTR</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CPC</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CPM</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Leads</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CPL</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Conv.</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={`${row.channel}-${row.placement}`}
                className="hover:bg-indigo-50/30"
              >
                <td className="px-3 py-2 font-medium">{row.channel}</td>
                <td className="px-3 py-2">{row.placement}</td>
                <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px]">
                  {row.campaignNames.join(", ")}
                </td>
                <td className="px-3 py-2 text-right">{formatARS(row.spend)}</td>
                <td className="px-3 py-2 text-right">
                  {row.impressions.toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-right">{row.clicks}</td>
                <td className="px-3 py-2 text-right">{row.ctr.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">{formatARS(row.cpc)}</td>
                <td className="px-3 py-2 text-right">{formatARS(row.cpm)}</td>
                <td className="px-3 py-2 text-right">{row.leads}</td>
                <td className="px-3 py-2 text-right">{formatARS(row.cpl)}</td>
                <td className="px-3 py-2 text-right">{row.conversions}</td>
                <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px]">
                  {row.recommendation ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricsSourceBanner({
  adsMode,
  metricsSource,
  permissionDenied,
  noData,
  simulated,
  source,
}: {
  adsMode: string;
  metricsSource: MetricsSource;
  permissionDenied?: boolean;
  noData?: boolean;
  simulated: boolean;
  source?: MetaInsightsResult["source"];
}) {
  if (metricsSource === "meta_real" && permissionDenied) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold">Meta/Instagram — error de permisos (no son métricas reales)</p>
          <p className="mt-0.5 text-red-800">{META_PERMISSION_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (metricsSource === "meta_real" && noData) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <Camera className="h-5 w-5 shrink-0 text-slate-500" />
        <div>
          <p className="font-semibold">Fuente: Meta/Instagram API — sin datos en el período</p>
          <p className="mt-0.5 text-slate-600">
            La conexión respondió correctamente; no hay filas de insights para el rango elegido.
          </p>
        </div>
      </div>
    );
  }

  if (metricsSource === "meta_real" && adsMode === "read_only") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <Camera className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold">Fuente: Meta/Instagram API (solo lectura)</p>
          <p className="mt-0.5 text-emerald-800">
            Desglose por publisher_platform y platform_position — Reels, Stories, Feed, etc.
          </p>
        </div>
      </div>
    );
  }

  if (simulated || adsMode === "mock") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Métricas simuladas / modo demo</p>
          <p className="mt-0.5 text-amber-800">
            ADS_MODE=mock — estos números no son reales. Los desgloses por
            publisher_platform y platform_position son datos de prueba generados
            automáticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <Camera className="h-5 w-5 shrink-0 text-emerald-600" />
      <div>
        <p className="font-semibold">
          Métricas reales — ADS_MODE={adsMode}
          {source === "meta_api" ? " (Meta Insights API)" : ""}
        </p>
        <p className="mt-0.5 text-emerald-800">
          Desglose por publisher_platform y platform_position desde Meta.
        </p>
      </div>
    </div>
  );
}

function MetaPermissionErrorPanel({ suggestion }: { suggestion?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 space-y-3">
      <p className="font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        {META_PERMISSION_MESSAGE}
      </p>
      <p className="text-red-800">
        No se muestran métricas simuladas en este modo. Corregí los permisos en Meta
        Business y volvé a probar la conexión en{" "}
        <Link href="/settings/integrations" className="font-medium underline">
          Integraciones
        </Link>
        .
      </p>
      <p className="text-red-800 bg-white/60 rounded-lg px-3 py-2 border border-red-100">
        {suggestion ?? META_PERMISSION_SUGGESTION}
      </p>
    </div>
  );
}

function PlacementBreakdownSection({
  breakdown,
}: {
  breakdown: MetaInsightsResult;
}) {
  const publishers = Object.entries(breakdown.byPublisher);
  const igPositions = Object.entries(breakdown.byInstagramPosition);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        <Camera className="h-5 w-5 text-pink-600" />
        Métricas por canal y placement
      </h2>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <p className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 border-b border-slate-100">
          Desglose unificado — Instagram Reels, Stories, Feed, Facebook Feed, Google Search
        </p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Plataforma</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Canal</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Placement</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Gasto ARS</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">CPC</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">CTR</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">CPM</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">CPL</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {breakdown.rows.map((row) => (
              <tr key={`${row.publisher_platform}-${row.platform_position}`} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{row.platform}</td>
                <td className="px-4 py-2">{row.channel}</td>
                <td className="px-4 py-2">{row.placement}</td>
                <td className="px-4 py-2 text-right">{formatARS(row.spend)}</td>
                <td className="px-4 py-2 text-right">{formatARS(row.cpc)}</td>
                <td className="px-4 py-2 text-right">{row.ctr.toFixed(2)}%</td>
                <td className="px-4 py-2 text-right">{formatARS(row.cpm)}</td>
                <td className="px-4 py-2 text-right">{formatARS(row.cpl)}</td>
                <td className="px-4 py-2 text-right">{row.leads}</td>
                <td className="px-4 py-2 text-xs text-slate-600 max-w-[200px]">
                  {row.recommendation ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {publishers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 border-b border-slate-100">
            Por publisher_platform (Instagram vs Facebook)
          </p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500">Plataforma</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Gasto</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Impr.</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Clics</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">CTR</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {publishers.map(([platform, row]) => (
                <tr key={platform} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium capitalize">{platform}</td>
                  <td className="px-4 py-2 text-right">{formatARS(row.spend)}</td>
                  <td className="px-4 py-2 text-right">{row.impressions.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-2 text-right">{row.clicks}</td>
                  <td className="px-4 py-2 text-right">{row.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right">{row.leads}</td>
                  <td className="px-4 py-2 text-right">{formatARS(row.cpl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {igPositions.length > 0 && (
        <div className="rounded-xl border border-pink-200 bg-white shadow-sm overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-pink-800 bg-pink-50 border-b border-pink-100">
            Por platform_position — Reels vs Stories vs Feed
          </p>
          <table className="w-full text-sm">
            <thead className="bg-pink-50/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500">Placement</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Gasto</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Impr.</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Clics</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">CTR</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {igPositions.map(([pos, row]) => (
                <tr key={pos} className="hover:bg-pink-50/30">
                  <td className="px-4 py-2 font-medium">
                    {instagramPositionLabel(pos as InstagramPosition)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatARS(row.spend)}</td>
                  <td className="px-4 py-2 text-right">{row.impressions.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-2 text-right">{row.clicks}</td>
                  <td className="px-4 py-2 text-right">{row.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right">{row.leads}</td>
                  <td className="px-4 py-2 text-right">{formatARS(row.cpl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RealMetaInsightsTable({ rows }: { rows: MetaInsightRow[] }) {
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + r.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 }
  );

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      <p className="px-4 py-3 text-sm font-semibold text-emerald-900 bg-emerald-50 border-b border-emerald-100">
        Métricas reales Meta — por canal y placement
      </p>
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 border-b border-slate-100">
        <MetricCard label="Gasto total" value={formatARS(totals.spend)} />
        <MetricCard label="Impresiones" value={totals.impressions.toLocaleString("es-AR")} />
        <MetricCard label="Clics" value={totals.clicks.toLocaleString("es-AR")} />
        <MetricCard label="Leads" value={totals.leads.toString()} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Canal</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Placement</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Gasto</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Impr.</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Alcance</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Clics</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CTR</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CPC</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">CPM</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Leads</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Conv.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={`${row.channel}-${row.placement}-${i}`} className="hover:bg-emerald-50/30">
                <td className="px-3 py-2 font-medium">{row.channel}</td>
                <td className="px-3 py-2">{row.placement}</td>
                <td className="px-3 py-2 text-right">{formatARS(row.spend)}</td>
                <td className="px-3 py-2 text-right">{row.impressions.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-right">{row.reach.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-right">{row.clicks}</td>
                <td className="px-3 py-2 text-right">{row.ctr.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">{formatARS(row.cpc)}</td>
                <td className="px-3 py-2 text-right">{formatARS(row.cpm)}</td>
                <td className="px-3 py-2 text-right">{row.leads}</td>
                <td className="px-3 py-2 text-right">{row.conversions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
