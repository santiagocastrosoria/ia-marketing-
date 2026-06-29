"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/Badges";
import type { ApprovalRequest } from "@/lib/types/marketing";
import { Loader2, Check, X, Edit } from "lucide-react";
import { formatARS, formatARSMonthly, formatARSDaily } from "@/lib/utils/formatARS";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    fetchJson<{ approvals?: ApprovalRequest[] }>("/api/approvals")
      .then((data) => {
        setApprovals(data.approvals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    setActionLoading(`approve-${id}`);
    try {
      await fetchJson(`/api/approvals/${id}/approve`, { method: "POST" });
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

  const reject = async (id: string) => {
    setActionLoading(`reject-${id}`);
    try {
      await fetchJson(`/api/approvals/${id}/reject`, { method: "POST" });
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
          <h1 className="text-2xl font-bold text-slate-900">Pendientes de aprobación</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toda acción que genere gasto requiere tu aprobación explícita
          </p>
        </div>

        {approvals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500">No hay solicitudes pendientes de aprobación.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        {a.action_type}
                      </span>
                      <RiskBadge level={a.risk_level} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {a.campaign_plan?.campaignName ?? "Campaña"}
                    </h3>
                    <p className="text-sm text-slate-600">{a.reason}</p>

                    {a.campaign_plan && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-500">Plataforma:</span>{" "}
                          <span className="font-medium">{a.campaign_plan.platform}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Presupuesto diario:</span>{" "}
                          <span className="font-medium">
                            {formatARSDaily(a.campaign_plan.dailyBudget)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Estimado mensual:</span>{" "}
                          <span className="font-medium">
                            {formatARSMonthly(a.campaign_plan.monthlyBudgetEstimate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Riesgo:</span>{" "}
                          <RiskBadge level={a.risk_level} />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Qué va a cambiar</p>
                      <pre className="mt-1 text-xs text-slate-600 overflow-auto">
                        {JSON.stringify(a.action_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => approve(a.id)}
                    disabled={actionLoading === `approve-${a.id}`}
                  >
                    {actionLoading === `approve-${a.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Aprobar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => reject(a.id)}
                    disabled={actionLoading === `reject-${a.id}`}
                  >
                    {actionLoading === `reject-${a.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    Rechazar
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Edit className="h-3 w-3" />
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
