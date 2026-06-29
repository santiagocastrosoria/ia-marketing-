"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { MALDIVAS_OUTDOOR_PRESET } from "@/lib/utils/presets";
import { formatARS } from "@/lib/utils/formatARS";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";
import type {
  CreateObjectiveInput,
  BrandAwarenessLevel,
  Platforms,
  CreativeType,
  MetaChannelPreference,
} from "@/lib/types/marketing";
import {
  META_CHANNEL_OPTIONS,
  defaultMetaChannelForBusiness,
  isMaldivasBrand,
} from "@/lib/ads/metaPlacements";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";

function formatObjectiveError(err: unknown): { code?: string; message: string; details?: string } {
  if (err instanceof FetchApiError) {
    const body = err.body ?? {};
    return {
      code: err.code,
      message: err.message,
      details: [
        body.details as string | undefined,
        body.businessId ? `businessId: ${body.businessId}` : undefined,
        body.userId ? `userId: ${body.userId}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Error al crear objetivo" };
}

export default function ObjectivesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateObjectiveInput>(MALDIVAS_OUTDOOR_PRESET);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("brandBusinessId");
    if (stored) setBusinessId(stored);
  }, []);

  const update = (field: keyof CreateObjectiveInput, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "businessName" || field === "industry" || field === "product") {
        const name = field === "businessName" ? (value as string) : next.businessName;
        const industry = field === "industry" ? (value as string) : next.industry;
        const product = field === "product" ? (value as string) : next.product;
        if (isMaldivasBrand(name, industry, product)) {
          next.metaChannelPreference = "INSTAGRAM_PRIORITY";
          next.placementStrategy = "MANUAL_INSTAGRAM_FOCUS";
        }
      }
      return next;
    });
  };

  const loadPreset = () => setForm(MALDIVAS_OUTDOOR_PRESET);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setFormErrorCode(null);
    try {
      const data = await fetchJson<{
        success?: boolean;
        objective?: { id: string };
        objectiveId?: string;
        business?: { id: string };
        businessId?: string;
      }>("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          industry: form.industry,
          product: form.product,
          goal: form.goal,
          dailyBudget: form.dailyBudget,
          monthlyBudget: form.monthlyBudget,
          locations: form.locations,
          platforms: form.platforms,
          idealCustomer: form.idealCustomer,
          averageTicket: form.averageTicket,
          brandAwarenessLevel: form.brandAwarenessLevel,
          landingUrl: form.landingUrl,
          whatsappUrl: form.whatsappUrl,
          creativeTypes: form.creativeTypes,
          restrictions: form.restrictions,
          metaChannelPreference: form.metaChannelPreference,
          placementStrategy: form.placementStrategy,
          businessId: businessId || undefined,
        }),
      });

      const objectiveId = data.objectiveId ?? data.objective?.id;
      const resolvedBusinessId = data.businessId ?? data.business?.id;

      if (!objectiveId) {
        throw new Error("El servidor no devolvió objectiveId");
      }

      sessionStorage.setItem("lastObjectiveId", objectiveId);
      if (resolvedBusinessId) {
        localStorage.setItem("brandBusinessId", resolvedBusinessId);
      }
      router.push(`/strategy?objectiveId=${objectiveId}`);
    } catch (err) {
      const { code, message, details } = formatObjectiveError(err);
      setFormErrorCode(code ?? null);
      setFormError(details ? `${message} — ${details}` : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Crear objetivo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Definí tu negocio, presupuesto y objetivo para que el agente genere la estrategia
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadPreset}>
            <Sparkles className="h-4 w-4" />
            Preset Maldivas
          </Button>
        </div>

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">
                {formErrorCode ? `[${formErrorCode}]` : "Error al crear objetivo"}
              </p>
              <p className="mt-1 text-sm text-red-800">{formError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="Nombre del negocio" required>
            <input
              className={inputClassName()}
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Rubro" required>
              <input
                className={inputClassName()}
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                required
              />
            </Field>
            <Field label="Presupuesto diario en ARS" required>
              <input
                className={inputClassName()}
                type="number"
                min={1}
                placeholder="Ej: 150000"
                value={form.dailyBudget}
                onChange={(e) => update("dailyBudget", Number(e.target.value))}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Ingresá el presupuesto diario en pesos argentinos. Ejemplo: 150000 = {formatARS(150000)} por día.
              </p>
              {form.dailyBudget < 1000 && (
                <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  El presupuesto parece muy bajo para campañas reales en Argentina. Si quisiste cargar {formatARS(150000)}, escribí 150000.
                </p>
              )}
              {form.dailyBudget >= 1000 && form.dailyBudget < 10000 && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Presupuesto limitado. El agente va a recomendar pocas campañas para no fragmentar el gasto.
                </p>
              )}
            </Field>
          </div>

          <Field label="Producto o servicio" required>
            <textarea
              className={inputClassName("min-h-[80px]")}
              value={form.product}
              onChange={(e) => update("product", e.target.value)}
              required
            />
          </Field>

          <Field label="Objetivo principal" required>
            <input
              className={inputClassName()}
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Presupuesto mensual estimado en ARS">
              <input
                className={inputClassName()}
                type="number"
                placeholder="Ej: 4500000"
                value={form.monthlyBudget ?? ""}
                onChange={(e) =>
                  update("monthlyBudget", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
            <Field label="Ticket promedio">
              <input
                className={inputClassName()}
                type="number"
                value={form.averageTicket ?? ""}
                onChange={(e) =>
                  update("averageTicket", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
          </div>

          <Field label="Zonas geográficas (separadas por coma)" required>
            <input
              className={inputClassName()}
              value={form.locations.join(", ")}
              onChange={(e) =>
                update(
                  "locations",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Plataforma">
              <select
                className={inputClassName()}
                value={form.platforms}
                onChange={(e) => update("platforms", e.target.value as Platforms)}
              >
                <option value="BOTH">Meta + Google</option>
                <option value="META">Solo Meta Ads</option>
                <option value="GOOGLE">Solo Google Ads</option>
              </select>
            </Field>
            <Field label="Conocimiento de marca">
              <select
                className={inputClassName()}
                value={form.brandAwarenessLevel}
                onChange={(e) =>
                  update("brandAwarenessLevel", e.target.value as BrandAwarenessLevel)
                }
              >
                <option value="new">Nueva</option>
                <option value="medium">Media</option>
                <option value="strong">Fuerte</option>
              </select>
            </Field>
          </div>

          {(form.platforms === "META" || form.platforms === "BOTH") && (
            <Field label="Canal dentro de Meta Ads">
              <select
                className={inputClassName()}
                value={
                  form.metaChannelPreference ??
                  defaultMetaChannelForBusiness(
                    form.businessName,
                    form.industry,
                    form.product
                  )
                }
                onChange={(e) =>
                  update("metaChannelPreference", e.target.value as MetaChannelPreference)
                }
              >
                {META_CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                Instagram es recomendado para productos visuales premium, contenido
                aspiracional, Reels, Stories y consultas por WhatsApp.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {META_CHANNEL_OPTIONS.find(
                  (o) =>
                    o.id ===
                    (form.metaChannelPreference ??
                      defaultMetaChannelForBusiness(
                        form.businessName,
                        form.industry,
                        form.product
                      ))
                )?.description}
              </p>
            </Field>
          )}

          <Field label="Cliente ideal" required>
            <textarea
              className={inputClassName("min-h-[60px]")}
              value={form.idealCustomer}
              onChange={(e) => update("idealCustomer", e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="URL landing / sitio web">
              <input
                className={inputClassName()}
                type="url"
                value={form.landingUrl ?? ""}
                onChange={(e) => update("landingUrl", e.target.value)}
              />
            </Field>
            <Field label="WhatsApp destino">
              <input
                className={inputClassName()}
                value={form.whatsappUrl ?? ""}
                onChange={(e) => update("whatsappUrl", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Creatividades disponibles">
            <div className="flex flex-wrap gap-3">
              {(["image", "video", "catalog", "web", "instagram"] as CreativeType[]).map(
                (type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.creativeTypes?.includes(type) ?? false}
                      onChange={(e) => {
                        const current = form.creativeTypes ?? [];
                        update(
                          "creativeTypes",
                          e.target.checked
                            ? [...current, type]
                            : current.filter((t) => t !== type)
                        );
                      }}
                    />
                    {type}
                  </label>
                )
              )}
            </div>
          </Field>

          <Field label="Restricciones">
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 min-h-[60px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={form.restrictions ?? ""}
              onChange={(e) => update("restrictions", e.target.value)}
            />
          </Field>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Crear objetivo y generar estrategia
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

function inputClassName(extra = "") {
  return `w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${extra}`;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
