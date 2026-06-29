"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/Badges";
import type { CampaignMetrics, CampaignPlan, Recommendation, InstagramPosition } from "@/lib/types/marketing";
import type { MetaInsightsResult } from "@/lib/ads/metaInsightsService";
import { instagramPositionLabel } from "@/lib/ads/metaPlacements";
import { Loader2, BarChart3, Sparkles, AlertTriangle, Camera } from "lucide-react";
import { formatARS } from "@/lib/utils/formatARS";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";

type AnalysisResult = {
  summary: string;
  insights: { metric: string; diagnosis: string; severity: string }[];
  placementInsights?: {
    simulated?: boolean;
    instagramVsFacebook?: string;
    reelsVsStoriesVsFeed?: string;
    topPlacement?: string;
  };
};

const adsMode =
  process.env.NEXT_PUBLIC_ADS_MODE ?? process.env.ADS_MODE ?? "mock";

export default function MetricsPage() {
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [placementBreakdown, setPlacementBreakdown] =
    useState<MetaInsightsResult | null>(null);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const load = () => {
    const params = new URLSearchParams({ period });
    if (selectedCampaign) params.set("campaignPlanId", selectedCampaign);
    fetchJson<{
      metrics?: CampaignMetrics[];
      campaigns?: CampaignPlan[];
    }>(`/api/metrics?${params}`)
      .then((data) => {
        setMetrics(data.metrics ?? []);
        setCampaigns(data.campaigns ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [period, selectedCampaign]);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const data = await fetchJson<{
        analysis: AnalysisResult;
        recommendations?: Recommendation[];
        placementBreakdown?: MetaInsightsResult | null;
      }>("/api/metrics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignPlanId: selectedCampaign || campaigns[0]?.id,
          generateMock: true,
        }),
      });
      setAnalysis(data.analysis);
      setPlacementBreakdown(data.placementBreakdown ?? null);
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
          <div className="flex gap-3">
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
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">Todas las campañas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.campaignName}
                </option>
              ))}
            </select>
            <Button onClick={analyze} disabled={analyzing}>
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
          simulated={
            placementBreakdown?.simulated ??
            analysis?.placementInsights?.simulated ??
            adsMode === "mock"
          }
          source={placementBreakdown?.source}
        />

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

        {analysis && (
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

        {placementBreakdown && placementBreakdown.rows.length > 0 && (
          <PlacementBreakdownSection breakdown={placementBreakdown} />
        )}

        {recommendations.length > 0 && (
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

        {metrics.length > 0 && (
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

function MetricsSourceBanner({
  adsMode,
  simulated,
  source,
}: {
  adsMode: string;
  simulated: boolean;
  source?: MetaInsightsResult["source"];
}) {
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
        Desglose Meta / Instagram
      </h2>

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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
