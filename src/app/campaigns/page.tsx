"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { StatusBadge, RiskBadge } from "@/components/ui/Badges";
import type { CampaignPlan } from "@/lib/types/marketing";
import { formatARSDaily, formatARSMonthly } from "@/lib/utils/formatARS";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import { MetaPlacementPanel } from "@/components/campaigns/MetaPlacementPanel";
import {
  primaryChannelLabel,
  primaryPlacementLabel,
  placementStrategyLabel,
} from "@/lib/ads/metaPlacements";
import { Loader2, Pause, ShieldCheck, Play } from "lucide-react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    fetchJson<{ campaigns?: CampaignPlan[] }>("/api/dashboard")
      .then((data) => {
        setCampaigns(data.campaigns ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const createPaused = async (id: string) => {
    setActionLoading(id);
    try {
      const data = await fetchJson<{ message: string }>("/api/campaigns/create-paused", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignPlanId: id }),
      });
      alert(data.message);
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
      setActionLoading(null);
    }
  };

  const requestApproval = async (id: string) => {
    setActionLoading(`approval-${id}`);
    try {
      const data = await fetchJson<{ message: string }>("/api/campaigns/create-paused", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignPlanId: id }),
      });
      alert(data.message);
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
      setActionLoading(null);
    }
  };

  const saveMetaPlacements = async (
    campaignId: string,
    updates: Partial<CampaignPlan>
  ) => {
    await fetchJson(`/api/campaigns/${campaignId}/meta-placements`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    load();
  };

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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Constructor de campañas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Campañas propuestas en estado DRAFT/PAUSED. Ninguna puede activarse sin aprobación.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500">No hay campañas. Generá una estrategia primero.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold">
                        {c.platform}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {c.campaignName}
                      </h3>
                      <StatusBadge status={c.status} />
                      <RiskBadge level={c.riskLevel} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{c.strategy_summary}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Objetivo: {c.objective}</span>
                      <span>Embudo: {c.funnelStage}</span>
                      <span>Canal: {primaryChannelLabel(c.primaryChannel)}</span>
                      <span>
                        Placement principal: {primaryPlacementLabel(c.primaryPlacement)}
                      </span>
                      {c.placementStrategy && (
                        <span>
                          Estrategia: {placementStrategyLabel(c.placementStrategy)}
                        </span>
                      )}
                      <span>Presupuesto: {formatARSDaily(c.dailyBudget)}</span>
                      <span>Estimado mensual: {formatARSMonthly(c.monthlyBudgetEstimate)}</span>
                      <span>{c.adGroups.length} ad groups/sets</span>
                      <span>{c.ads.length} anuncios</span>
                      {c.requiresApproval && (
                        <span className="text-amber-700 font-medium">
                          Requiere aprobación
                        </span>
                      )}
                      {c.keywords.length > 0 && (
                        <span>{c.keywords.length} keywords</span>
                      )}
                    </div>
                  </div>
                </div>

                {c.keywords.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {c.keywords.slice(0, 8).map((k, i) => (
                        <span
                          key={i}
                          className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                        >
                          {k.text}
                        </span>
                      ))}
                      {c.keywords.length > 8 && (
                        <span className="text-xs text-slate-400">
                          +{c.keywords.length - 8} más
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {c.ads[0] && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Copy principal</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {c.ads[0].copy.headlines[0]} — {c.ads[0].copy.descriptions[0]}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      CTA: {c.ads[0].copy.cta} | UTM: {c.ads[0].utm.utm_campaign}
                    </p>
                  </div>
                )}

                {c.platform === "META" && (
                  <MetaPlacementPanel
                    campaign={c}
                    onSave={(updates) => saveMetaPlacements(c.id, updates)}
                  />
                )}

                <div className="mt-4 flex gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => createPaused(c.id)}
                    disabled={actionLoading === c.id}
                  >
                    {actionLoading === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Pause className="h-3 w-3" />
                    )}
                    Crear en plataforma (PAUSED)
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => requestApproval(c.id)}
                    disabled={actionLoading === `approval-${c.id}`}
                  >
                    {actionLoading === `approval-${c.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    Solicitar aprobación
                  </Button>
                  {c.status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={async () => {
                        setActionLoading(`activate-${c.id}`);
                        try {
                          const data = await fetchJson<{ message: string }>(
                            `/api/campaigns/${c.id}/activate`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({}),
                            }
                          );
                          alert(data.message);
                          load();
                        } catch (err) {
                          if (
                            err instanceof FetchApiError &&
                            err.code === "APPROVAL_REQUIRED"
                          ) {
                            alert(
                              `Activación bloqueada: ${err.message} Solicitá aprobación primero.`
                            );
                          } else {
                            alert(
                              err instanceof FetchApiError
                                ? err.message
                                : err instanceof Error
                                  ? err.message
                                  : "Error"
                            );
                          }
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      <Play className="h-3 w-3" />
                      Activar (aprobada)
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
