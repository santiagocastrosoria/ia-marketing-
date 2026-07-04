"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import { formatARSDaily } from "@/lib/utils/formatARS";
import { isReadOnlyMode } from "@/lib/utils/config";
import {
  REVIEW_STATUS_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  scoreColor,
  scoreRingColor,
} from "@/lib/campaign-generator/statusLabels";
import type {
  CampaignBlueprint,
  CampaignBlueprintReview,
} from "@/lib/types/campaignBlueprint";
import {
  Loader2,
  ArrowLeft,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Lock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-200"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreRingColor(score)}
        />
      </svg>
      <div className="absolute text-center">
        <div className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</div>
        <div className="text-xs text-slate-500">/ 100</div>
      </div>
    </div>
  );
}

export default function CampaignReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [blueprint, setBlueprint] = useState<CampaignBlueprint | null>(null);
  const [review, setReview] = useState<CampaignBlueprintReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBlueprint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ blueprint: CampaignBlueprint }>(
        `/api/campaign-generator/${id}/review`
      );
      setBlueprint(data.blueprint);
      setReview(data.blueprint.review ?? null);
    } catch (err) {
      setError(err instanceof FetchApiError ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBlueprint();
  }, [loadBlueprint]);

  const runReview = async () => {
    setReviewing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await fetchJson<{
        blueprint: CampaignBlueprint;
        review: CampaignBlueprintReview;
      }>(`/api/campaign-generator/${id}/review`, { method: "POST" });
      setBlueprint(data.blueprint);
      setReview(data.review);
    } catch (err) {
      setError(err instanceof FetchApiError ? err.message : "Error al revisar");
    } finally {
      setReviewing(false);
    }
  };

  const markReady = async () => {
    setMarkingReady(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await fetchJson<{ blueprint: CampaignBlueprint; message: string }>(
        `/api/campaign-generator/${id}/mark-ready`,
        { method: "POST" }
      );
      setBlueprint(data.blueprint);
      setSuccessMessage(data.message);
    } catch (err) {
      setError(err instanceof FetchApiError ? err.message : "Error al marcar");
    } finally {
      setMarkingReady(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </AppShell>
    );
  }

  if (!blueprint) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-slate-600">{error ?? "Propuesta no encontrada"}</p>
          <Link
            href="/campaign-generator"
            className="mt-4 inline-block text-indigo-600 hover:underline"
          >
            Volver al generador
          </Link>
        </div>
      </AppShell>
    );
  }

  const displayReview = review;
  const statusLabel = STATUS_LABELS[blueprint.status];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/campaign-generator"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Generador
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-700">Revisión de campaña</span>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-indigo-500" />
              <h1 className="text-2xl font-bold text-slate-900">
                Revisión profesional
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {blueprint.proposal.campaignName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatARSDaily(blueprint.input.dailyBudget)} ·{" "}
              {blueprint.input.targetZone}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[blueprint.status]}`}
          >
            {statusLabel}
          </span>
        </header>

        {isReadOnlyMode() && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            ADS_MODE=read_only — esta revisión es interna. No se creará nada en Meta.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={runReview} disabled={reviewing}>
            {reviewing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando…
              </>
            ) : displayReview ? (
              "Volver a revisar"
            ) : (
              "Ejecutar revisión"
            )}
          </Button>
          <Button
            variant="success"
            onClick={markReady}
            disabled={markingReady}
          >
            {markingReady ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Marcar como lista para Meta Draft
          </Button>
        </div>

        {!displayReview ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm">
              Ejecutá la revisión para obtener score, checklist y recomendaciones
              antes de cualquier borrador en Meta.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[auto_1fr]">
              <ScoreRing score={displayReview.preparationScore} />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Score de preparación
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Evaluación de si esta propuesta puede convertirse en campaña
                  pausada en Meta en el futuro.
                </p>
                <p className="mt-3 text-sm">
                  Estado sugerido:{" "}
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[displayReview.suggestedStatus]}`}
                  >
                    {REVIEW_STATUS_LABELS[displayReview.suggestedStatus]}
                  </span>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Revisado:{" "}
                  {new Date(displayReview.reviewedAt).toLocaleString("es-AR")}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Checklist de preparación
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {displayReview.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {item.passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <div className="font-medium text-slate-800">{item.label}</div>
                      {item.note && !item.passed && (
                        <div className="text-xs text-slate-500">{item.note}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Análisis por criterio
              </h2>
              <div className="space-y-3">
                {displayReview.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {c.label}
                      </span>
                      <span className={`text-sm font-bold ${scoreColor(c.score)}`}>
                        {c.score}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{c.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-amber-100 bg-amber-50/50 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Recomendaciones concretas
              </h2>
              <ul className="space-y-2">
                {displayReview.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="font-bold text-amber-600">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => router.push("/campaign-generator")}>
            Volver al generador
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
