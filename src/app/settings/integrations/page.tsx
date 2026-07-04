"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import { MetaInsightsPeriodSelect } from "@/components/integrations/MetaInsightsPeriodSelect";
import { MetaNoInsightsPanel } from "@/components/integrations/MetaNoInsightsPanel";
import type { MetaIntegrationStatus } from "@/lib/ads/metaConfig";
import type { MetaDatePreset } from "@/lib/ads/metaDatePresets";
import { META_NO_INSIGHTS_CODE } from "@/lib/ads/metaDatePresets";
import type { MetaDebugPermissionsReport } from "@/lib/ads/metaDebugService";
import type { MetaAdAccount, MetaInsightRow, MetaRealCampaign } from "@/lib/ads/metaRealService";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Plug,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

type IntegrationsResponse = {
  adsMode: string;
  meta: MetaIntegrationStatus;
};

type TestResponse = {
  ok: boolean;
  message?: string;
  adAccount?: MetaAdAccount;
  meta?: MetaIntegrationStatus;
};

export default function IntegrationsSettingsPage() {
  const [adsMode, setAdsMode] = useState<string>("mock");
  const [meta, setMeta] = useState<MetaIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [campaigns, setCampaigns] = useState<MetaRealCampaign[] | null>(null);
  const [insights, setInsights] = useState<MetaInsightRow[] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<MetaDebugPermissionsReport | null>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const [metaDatePreset, setMetaDatePreset] = useState<MetaDatePreset>("last_30d");
  const [insightsNoData, setInsightsNoData] = useState(false);

  const loadStatus = useCallback(() => {
    setLoading(true);
    fetchJson<IntegrationsResponse>("/api/integrations/status")
      .then((data) => {
        setAdsMode(data.adsMode ?? "mock");
        setMeta(data.meta);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const testConnection = async () => {
    setTesting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const data = await fetchJson<TestResponse>("/api/integrations/meta/test", {
        method: "POST",
      });
      setActionMessage(data.message ?? "Conexión verificada.");
      if (data.meta) setMeta(data.meta);
      loadStatus();
    } catch (err) {
      setActionError(
        err instanceof FetchApiError ? err.message : "Error al probar conexión"
      );
      if (err instanceof FetchApiError && err.body?.meta) {
        setMeta(err.body.meta as MetaIntegrationStatus);
      }
      loadStatus();
    } finally {
      setTesting(false);
    }
  };

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const data = await fetchJson<{ campaigns: MetaRealCampaign[]; count: number }>(
        "/api/integrations/meta/campaigns"
      );
      setCampaigns(data.campaigns ?? []);
      setActionMessage(`${data.count ?? 0} campaña(s) leídas desde Meta (solo lectura).`);
    } catch (err) {
      setActionError(
        err instanceof FetchApiError ? err.message : "Error al leer campañas"
      );
      setCampaigns(null);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const loadDiagnostic = async () => {
    setLoadingDiagnostic(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const data = await fetchJson<{ diagnostic: MetaDebugPermissionsReport }>(
        "/api/integrations/meta/debug-permissions"
      );
      setDiagnostic(data.diagnostic);
      setActionMessage("Diagnóstico de permisos completado (solo lectura).");
    } catch (err) {
      setDiagnostic(null);
      setActionError(
        err instanceof FetchApiError ? err.message : "Error al diagnosticar permisos"
      );
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const loadInsights = async (preset: MetaDatePreset = metaDatePreset) => {
    setLoadingInsights(true);
    setActionMessage(null);
    setActionError(null);
    setInsightsNoData(false);
    try {
      const data = await fetchJson<{
        rows: MetaInsightRow[];
        code?: string;
        status?: string;
        message?: string;
      }>(`/api/integrations/meta/insights?datePreset=${preset}`);
      setInsights(data.rows ?? []);
      if ((data.rows ?? []).length === 0) {
        if (data.code === META_NO_INSIGHTS_CODE || data.status === "no_data") {
          setInsightsNoData(true);
          setActionMessage(null);
        } else {
          setActionMessage(data.message ?? "Sin filas de insights.");
        }
      } else {
        setActionMessage(
          `${data.rows?.length ?? 0} fila(s) de insights leídas (solo lectura).`
        );
      }
    } catch (err) {
      if (err instanceof FetchApiError && err.code === "META_PERMISSION_DENIED") {
        setActionError(err.message);
      } else {
        setActionError(
          err instanceof FetchApiError ? err.message : "Error al leer métricas"
        );
      }
      setInsights(null);
      setInsightsNoData(false);
      if (err instanceof FetchApiError && err.body?.meta) {
        setMeta(err.body.meta as MetaIntegrationStatus);
      }
      loadStatus();
    } finally {
      setLoadingInsights(false);
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

  const isReadOnly = adsMode === "read_only";
  const isMock = adsMode === "mock";

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Plug className="h-7 w-7 text-indigo-600" />
            Integraciones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Estado de conexiones con plataformas publicitarias. Tokens solo en servidor.
          </p>
        </div>

        <AdsModeBanner adsMode={adsMode} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Modo actual</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">ADS_MODE</dt>
              <dd className="font-mono font-medium text-slate-900">{adsMode}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Meta lectura habilitada</dt>
              <dd className="font-medium text-slate-900">
                {meta?.metaReadEnabled ? "Sí" : "No"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Meta / Instagram</h2>
              <p className="text-sm text-slate-500 mt-1">
                Marketing API — solo lectura en modo read_only
              </p>
            </div>
            <MetaStatusBadge status={meta?.status} />
          </div>

          {meta && (
            <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-3">
              <p className="text-slate-700">{meta.message}</p>

              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                <MetaCheckItem label="Token configurado" ok={meta.tokenConfigured} />
                <MetaCheckItem label="Ad account configurada" ok={meta.adAccountConfigured} />
                <MetaCheckItem
                  label="Permiso ads_read confirmado"
                  ok={meta.adsReadConfirmed}
                  unknown={meta.adsReadConfirmed === null}
                />
              </dl>

              {meta.adAccountIdMasked && (
                <p>
                  <span className="text-slate-500">Ad Account: </span>
                  <span className="font-mono">{meta.adAccountIdMasked}</span>
                </p>
              )}

              {meta.lastMetaError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Último error Meta
                  </p>
                  <p className="mt-1">{meta.lastMetaError}</p>
                  {meta.lastMetaErrorCode && (
                    <p className="mt-1 text-xs font-mono text-red-600">{meta.lastMetaErrorCode}</p>
                  )}
                </div>
              )}

              {(meta.permissionSuggestion ||
                meta.lastMetaErrorCode === "META_PERMISSION_DENIED" ||
                meta.adsReadConfirmed === false) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="text-xs font-semibold">Cómo corregir permisos</p>
                  <p className="mt-1">
                    {meta.permissionSuggestion ??
                      "Revisá Business Settings → Usuarios del sistema → Activos → Cuenta publicitaria → Ver rendimiento / Administrar campañas."}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span>App ID: {meta.hasAppId ? "✓" : "—"}</span>
                <span>App Secret: {meta.hasAppSecret ? "✓ (servidor)" : "—"}</span>
              </div>

              {meta.missingVariables.length > 0 && (
                <p className="text-amber-700 text-xs">
                  Faltan: {meta.missingVariables.join(", ")}
                </p>
              )}
            </div>
          )}

          {isReadOnly && (
            <div className="flex flex-wrap items-center gap-3">
              <MetaInsightsPeriodSelect
                value={metaDatePreset}
                onChange={setMetaDatePreset}
              />
              <Button onClick={testConnection} disabled={testing} size="sm">
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Probar conexión Meta
              </Button>
              <Button
                variant="secondary"
                onClick={loadCampaigns}
                disabled={loadingCampaigns}
                size="sm"
              >
                {loadingCampaigns ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Leer campañas Meta
              </Button>
              <Button
                variant="secondary"
                onClick={() => loadInsights(metaDatePreset)}
                disabled={loadingInsights}
                size="sm"
              >
                {loadingInsights ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Leer métricas Meta
              </Button>
              <Button
                variant="secondary"
                onClick={loadDiagnostic}
                disabled={loadingDiagnostic}
                size="sm"
              >
                {loadingDiagnostic ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Diagnosticar permisos
              </Button>
            </div>
          )}

          {!isReadOnly && !isMock && (
            <p className="text-sm text-slate-500">
              Modo {adsMode} — integración Meta real aún no implementada para escritura.
            </p>
          )}

          {isMock && (
            <p className="text-sm text-amber-700">
              ADS_MODE=mock — no se realizan llamadas a Meta. Cambiá a read_only y configurá
              credenciales para lectura real.
            </p>
          )}

          {actionMessage && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {actionMessage}
            </p>
          )}
          {actionError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}

          {diagnostic && (
            <MetaDiagnosticPanel report={diagnostic} />
          )}

          {campaigns && campaigns.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Campañas Meta (read only)
              </p>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Objetivo</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">{c.status}</td>
                      <td className="px-3 py-2 text-xs">{c.objective ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {insightsNoData && !actionError && (
            <MetaNoInsightsPanel
              onTryPreset={(preset) => {
                setMetaDatePreset(preset);
                loadInsights(preset);
              }}
            />
          )}

          {insights && insights.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Insights Meta (read only) — {insights.length} fila(s)
              </p>
              {insights.length === 0 ? (
                <p className="text-sm text-slate-500">No hay datos para el período.</p>
              ) : (
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Canal</th>
                      <th className="px-3 py-2 text-left">Placement</th>
                      <th className="px-3 py-2 text-right">Gasto</th>
                      <th className="px-3 py-2 text-right">Impr.</th>
                      <th className="px-3 py-2 text-right">Clics</th>
                      <th className="px-3 py-2 text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.slice(0, 20).map((row, i) => (
                      <tr key={`${row.channel}-${row.placement}-${i}`}>
                        <td className="px-3 py-2">{row.channel}</td>
                        <td className="px-3 py-2">{row.placement}</td>
                        <td className="px-3 py-2 text-right">{row.spend.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{row.impressions}</td>
                        <td className="px-3 py-2 text-right">{row.clicks}</td>
                        <td className="px-3 py-2 text-right">{row.leads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex gap-3">
          <Shield className="h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="font-medium text-slate-800">Seguridad</p>
            <p className="mt-1">
              En read_only no se pueden crear, editar, activar, pausar ni cambiar presupuestos
              en Meta. ApprovalGate y ownership de Supabase permanecen activos. Google Ads no
              está conectado.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetaDiagnosticPanel({ report }: { report: MetaDebugPermissionsReport }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
        <Search className="h-4 w-4" />
        Diagnóstico de permisos Meta (solo lectura)
      </h3>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
        <MetaCheckItem label="Token válido" ok={report.tokenValid} />
        <MetaCheckItem label="Tiene ads_read" ok={report.hasAdsReadScope} />
        <MetaCheckItem
          label="Ad account configurada encontrada"
          ok={report.configuredAccountInList}
          unknown={!report.configuredAdAccountId}
        />
        <div>
          <dt className="text-slate-500">App ID del token</dt>
          <dd className="font-mono text-xs text-slate-800">
            {report.tokenDebug.app_id ?? "—"}
            {report.configuredAppId &&
              report.tokenDebug.app_id &&
              report.configuredAppId !== report.tokenDebug.app_id && (
                <span className="ml-2 text-red-600">≠ META_APP_ID</span>
              )}
          </dd>
        </div>
      </dl>

      {report.scopesDetected.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Scopes detectados</p>
          <div className="flex flex-wrap gap-1">
            {report.scopesDetected.map((scope) => (
              <span
                key={scope}
                className={`rounded px-2 py-0.5 text-xs font-mono ${
                  scope.includes("ads_read") || scope === "ads_management"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}

      {report.tokenDebug.expires_at_iso && (
        <p className="text-xs text-slate-600">
          Expira: {report.tokenDebug.expires_at_iso}
          {report.tokenDebug.type ? ` · Tipo: ${report.tokenDebug.type}` : ""}
        </p>
      )}

      {report.visibleAdAccounts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">
            Cuentas publicitarias visibles por el token ({report.visibleAdAccounts.length})
          </p>
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {report.visibleAdAccounts.map((a) => (
              <li key={a.id} className="font-mono text-slate-700">
                {a.name} — {a.id}
                {report.configuredAdAccountId &&
                  a.id.replace(/^act_/, "") ===
                    report.configuredAdAccountId.replace(/^act_/, "") && (
                    <span className="ml-2 text-emerald-700">← configurada</span>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Resultado por llamada Meta</p>
        <div className="space-y-2">
          {report.steps.map((step) => (
            <div
              key={step.step}
              className={`rounded-lg border px-3 py-2 text-xs ${
                step.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : step.skipped
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{step.label}</span>
                <span>
                  {step.ok ? "✓ OK" : step.skipped ? "— omitido" : "✗ falló"}
                </span>
              </div>
              {step.error && (
                <p className="mt-1 font-mono break-all">
                  {step.error}
                  {step.errorCode != null ? ` (#${step.errorCode})` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Recomendaciones
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            {report.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetaCheckItem({
  label,
  ok,
  unknown,
}: {
  label: string;
  ok: boolean | null | undefined;
  unknown?: boolean;
}) {
  let value = "No";
  let className = "text-red-700";
  if (unknown || ok === null || ok === undefined) {
    value = "Sin verificar";
    className = "text-slate-600";
  } else if (ok) {
    value = "Sí";
    className = "text-emerald-700";
  }

  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-medium ${className}`}>{value}</dd>
    </div>
  );
}

function AdsModeBanner({ adsMode }: { adsMode: string }) {
  if (adsMode === "mock") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Modo mock</p>
          <p className="mt-0.5">Métricas y campañas simuladas. Sin APIs reales.</p>
        </div>
      </div>
    );
  }

  if (adsMode === "read_only") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <Eye className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold">Modo solo lectura (read_only)</p>
          <p className="mt-0.5">
            Lectura real de Meta/Instagram. No se pueden modificar campañas desde esta app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p>
        ADS_MODE={adsMode} — modo preparado; implementación de escritura pendiente.
      </p>
    </div>
  );
}

function MetaStatusBadge({ status }: { status?: string }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Conectada
      </span>
    );
  }
  if (status === "configured") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
        Configurada
      </span>
    );
  }
  if (status === "connection_failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
        <XCircle className="h-3.5 w-3.5" />
        Error de conexión
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
        Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      No configurada
    </span>
  );
}
