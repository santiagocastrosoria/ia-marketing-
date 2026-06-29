"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { RiskBadge, StatusBadge } from "@/components/ui/Badges";
import {
  Megaphone,
  Play,
  Pause,
  Clock,
  DollarSign,
  Users,
  MousePointer,
  TrendingUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { formatARS } from "@/lib/utils/formatARS";
import type { DashboardStats, Recommendation } from "@/lib/types/marketing";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ stats?: DashboardStats }>("/api/dashboard")
      .then((data) => {
        setStats(data.stats ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof FetchApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "No se pudo cargar el dashboard"
        );
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      </AppShell>
    );
  }

  const s = stats ?? {
    totalCampaigns: 0,
    activeCampaigns: 0,
    pausedCampaigns: 0,
    pendingApprovals: 0,
    dailySpendConfigured: 0,
    totalLeads: 0,
    avgCpl: 0,
    avgCtr: 0,
    avgCpc: 0,
    recommendations: [],
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Resumen de campañas, métricas y recomendaciones del agente IA
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total campañas" value={s.totalCampaigns} icon={Megaphone} />
          <StatCard title="Activas" value={s.activeCampaigns} icon={Play} />
          <StatCard title="Pausadas" value={s.pausedCampaigns} icon={Pause} />
          <StatCard
            title="Pendientes aprobación"
            value={s.pendingApprovals}
            icon={Clock}
            subtitle="Requieren acción humana"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Gasto diario configurado"
            value={formatARS(s.dailySpendConfigured)}
            icon={DollarSign}
          />
          <StatCard title="Leads generados" value={s.totalLeads} icon={Users} />
          <StatCard
            title="CPL promedio"
            value={s.avgCpl > 0 ? formatARS(s.avgCpl) : "—"}
            icon={TrendingUp}
          />
          <StatCard
            title="CTR / CPC promedio"
            value={s.avgCtr > 0 ? `${s.avgCtr}% / ${formatARS(s.avgCpc)}` : "—"}
            icon={MousePointer}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Recomendaciones del agente
          </h2>
          {s.recommendations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No hay recomendaciones pendientes. Creá un objetivo y generá campañas para comenzar.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {s.recommendations.map((rec: Recommendation) => (
                <div
                  key={rec.id}
                  className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">{rec.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{rec.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{rec.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RiskBadge level={rec.risk_level} />
                    {rec.requires_approval && (
                      <span className="text-xs text-amber-600 font-medium">
                        Requiere aprobación
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
