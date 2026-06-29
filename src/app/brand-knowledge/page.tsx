"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import type { BrandDocument, BrandKnowledgeContext } from "@/lib/types/brand";
import {
  Loader2,
  Save,
  Sparkles,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { REQUIRED_PROFILE_LABELS } from "@/lib/brand/knowledgeValidator";
import { fetchJson, FetchApiError } from "@/lib/api/fetchClient";

interface ProfileForm {
  positioning: string;
  brand_voice: string;
  ideal_customer: string;
  main_products: string;
  materials: string;
  differentiators: string;
  locations: string;
  preferred_words: string;
  forbidden_words: string;
  primary_cta: string;
  secondary_cta: string;
}

const emptyProfile: ProfileForm = {
  positioning: "",
  brand_voice: "",
  ideal_customer: "",
  main_products: "",
  materials: "",
  differentiators: "",
  locations: "",
  preferred_words: "",
  forbidden_words: "",
  primary_cta: "",
  secondary_cta: "",
};

function formatApiError(err: unknown, fallback: string): { message: string; code?: string } {
  if (err instanceof FetchApiError) {
    const details = err.body?.details as string | undefined;
    return {
      message: details ? `${err.message} — ${details}` : err.message,
      code: err.code,
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: fallback };
}

export default function BrandKnowledgePage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [context, setContext] = useState<BrandKnowledgeContext | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [documents, setDocuments] = useState<BrandDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageErrorCode, setPageErrorCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const [docForm, setDocForm] = useState({
    title: "",
    document_type: "general" as BrandDocument["document_type"],
    content_text: "",
  });

  const load = async (id?: string) => {
    setLoading(true);
    setPageError(null);
    setPageErrorCode(null);
    try {
      const url = id
        ? `/api/brand-knowledge/profile?businessId=${id}`
        : "/api/brand-knowledge/profile";
      const data = await fetchJson<{
        businesses?: { id: string }[];
        context?: BrandKnowledgeContext;
      }>(url);

      if (data.businesses?.length && !id) {
        setBusinessId(data.businesses[0].id);
        await load(data.businesses[0].id);
        return;
      }
      if (data.context) {
        setContext(data.context);
        setBusinessId(data.context.businessId);
        localStorage.setItem("brandBusinessId", data.context.businessId);
        setDocuments(data.context.documents);
        if (data.context.profile) {
          const p = data.context.profile;
          setProfile({
            positioning: p.positioning ?? "",
            brand_voice: p.brand_voice ?? "",
            ideal_customer: p.ideal_customer ?? "",
            main_products: p.main_products ?? "",
            materials: p.materials ?? "",
            differentiators: p.differentiators ?? "",
            locations: (p.locations ?? []).join(", "),
            preferred_words: (p.preferred_words ?? []).join(", "),
            forbidden_words: (p.forbidden_words ?? []).join(", "),
            primary_cta: p.primary_cta ?? "",
            secondary_cta: p.secondary_cta ?? "",
          });
        }
      }
    } catch (err) {
      const { message, code } = formatApiError(err, "No se pudo cargar la base de conocimiento");
      setPageError(message);
      setPageErrorCode(code ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setPageError(null);
    setPageErrorCode(null);
    try {
      const data = await fetchJson<{
        businessId: string;
        context: BrandKnowledgeContext;
      }>("/api/brand-knowledge/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          businessName: "Mi negocio",
          profile: {
            positioning: profile.positioning,
            brand_voice: profile.brand_voice,
            ideal_customer: profile.ideal_customer,
            main_products: profile.main_products,
            materials: profile.materials,
            differentiators: profile.differentiators,
            locations: profile.locations
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            preferred_words: profile.preferred_words
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            forbidden_words: profile.forbidden_words
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            primary_cta: profile.primary_cta,
            secondary_cta: profile.secondary_cta,
          },
        }),
      });
      localStorage.setItem("brandBusinessId", data.businessId);
      setContext(data.context);
      alert("Perfil de marca guardado");
    } catch (err) {
      const { message, code } = formatApiError(err, "Error al guardar el perfil");
      setPageError(message);
      setPageErrorCode(code ?? null);
    } finally {
      setSaving(false);
    }
  };

  const loadMaldivasPreset = async () => {
    setSaving(true);
    setPageError(null);
    setPageErrorCode(null);
    try {
      const data = await fetchJson<{ businessId: string }>(
        "/api/brand-knowledge/preset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId }),
        }
      );
      setBusinessId(data.businessId);
      localStorage.setItem("brandBusinessId", data.businessId);
      await load(data.businessId);
    } catch (err) {
      const { message, code } = formatApiError(err, "Error al cargar el preset Maldivas");
      setPageError(message);
      setPageErrorCode(code ?? null);
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async () => {
    if (!businessId || !docForm.title) return;
    setSaving(true);
    setPageError(null);
    setPageErrorCode(null);
    try {
      const data = await fetchJson<{ context: BrandKnowledgeContext }>(
        "/api/brand-knowledge/documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_id: businessId,
            ...docForm,
          }),
        }
      );
      setContext(data.context);
      setDocuments(data.context.documents);
      setDocForm({ title: "", document_type: "general", content_text: "" });
    } catch (err) {
      const message =
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al agregar documento";
      setPageError(message);
    } finally {
      setSaving(false);
    }
  };

  const searchKnowledge = async () => {
    if (!businessId) return;
    setPageError(null);
    setPageErrorCode(null);
    try {
      const data = await fetchJson<{
        chunks?: { chunk_text: string }[];
      }>(
        `/api/brand-knowledge/search?businessId=${businessId}&q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(data.chunks?.map((c) => c.chunk_text) ?? []);
    } catch (err) {
      const message =
        err instanceof FetchApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error en la búsqueda";
      setPageError(message);
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
      <div className="max-w-4xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Base de conocimiento de marca
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              El agente consulta esta información antes de generar estrategias, copies y campañas
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadMaldivasPreset} disabled={saving}>
            <Sparkles className="h-4 w-4" />
            Preset Maldivas
          </Button>
        </div>

        {pageError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">
                {pageErrorCode ? `[${pageErrorCode}]` : "Error"}
              </p>
              <p className="mt-1 text-sm text-red-800">{pageError}</p>
            </div>
          </div>
        )}

        {context && (
          <div
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              context.isComplete
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            {context.isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-slate-900">
                Completitud: {context.completenessScore}%
                {context.isComplete
                  ? " — Listo para crear campañas"
                  : " — Completá los campos obligatorios"}
              </p>
              {!context.isComplete && (
                <ul className="mt-2 text-sm text-amber-800 list-disc pl-4">
                  {context.missingFields.map((f) => (
                    <li key={f}>{REQUIRED_PROFILE_LABELS[f] ?? f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Perfil de marca</h2>

          <FormField label="Posicionamiento / perfil de marca">
            <textarea
              className={inputCls("min-h-[80px]")}
              value={profile.positioning}
              onChange={(e) => setProfile({ ...profile, positioning: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tono de comunicación">
              <textarea
                className={inputCls()}
                value={profile.brand_voice}
                onChange={(e) => setProfile({ ...profile, brand_voice: e.target.value })}
              />
            </FormField>
            <FormField label="Cliente ideal">
              <textarea
                className={inputCls()}
                value={profile.ideal_customer}
                onChange={(e) => setProfile({ ...profile, ideal_customer: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Productos principales">
            <textarea
              className={inputCls()}
              value={profile.main_products}
              onChange={(e) => setProfile({ ...profile, main_products: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Materiales">
              <textarea
                className={inputCls()}
                value={profile.materials}
                onChange={(e) => setProfile({ ...profile, materials: e.target.value })}
              />
            </FormField>
            <FormField label="Diferenciales">
              <textarea
                className={inputCls()}
                value={profile.differentiators}
                onChange={(e) => setProfile({ ...profile, differentiators: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Zonas de venta (separadas por coma)">
            <input
              className={inputCls()}
              value={profile.locations}
              onChange={(e) => setProfile({ ...profile, locations: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Palabras recomendadas (coma)">
              <input
                className={inputCls()}
                value={profile.preferred_words}
                onChange={(e) => setProfile({ ...profile, preferred_words: e.target.value })}
              />
            </FormField>
            <FormField label="Palabras prohibidas (coma)">
              <input
                className={inputCls()}
                value={profile.forbidden_words}
                onChange={(e) => setProfile({ ...profile, forbidden_words: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="CTA principal">
              <input
                className={inputCls()}
                value={profile.primary_cta}
                onChange={(e) => setProfile({ ...profile, primary_cta: e.target.value })}
              />
            </FormField>
            <FormField label="CTA secundario">
              <input
                className={inputCls()}
                value={profile.secondary_cta}
                onChange={(e) => setProfile({ ...profile, secondary_cta: e.target.value })}
              />
            </FormField>
          </div>

          <Button onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar perfil
          </Button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Documentos de conocimiento
          </h2>
          <p className="text-sm text-slate-500">
            FAQs, objeciones, competidores, rango de precios, links y archivos de texto
          </p>

          <div className="grid grid-cols-3 gap-3">
            <input
              className={inputCls()}
              placeholder="Título"
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
            />
            <select
              className={inputCls()}
              value={docForm.document_type}
              onChange={(e) =>
                setDocForm({
                  ...docForm,
                  document_type: e.target.value as BrandDocument["document_type"],
                })
              }
            >
              <option value="faq">Preguntas frecuentes</option>
              <option value="objection">Objeciones comunes</option>
              <option value="competitor">Competidores</option>
              <option value="price_range">Rango de precios</option>
              <option value="important_links">Links importantes</option>
              <option value="general">General</option>
              <option value="file">Archivo / texto largo</option>
            </select>
            <Button onClick={addDocument} disabled={!businessId || saving}>
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>

          <textarea
            className={inputCls("min-h-[100px]")}
            placeholder="Contenido del documento..."
            value={docForm.content_text}
            onChange={(e) => setDocForm({ ...docForm, content_text: e.target.value })}
          />

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <span className="text-xs font-medium text-indigo-600 uppercase">
                      {doc.document_type}
                    </span>
                    <p className="font-medium text-slate-900">{doc.title}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {doc.content_text}
                    </p>
                  </div>
                  <button
                    className="text-red-500 hover:text-red-700 p-1"
                    onClick={async () => {
                      if (!businessId) return;
                      try {
                        await fetchJson(
                          `/api/brand-knowledge/documents?id=${doc.id}&businessId=${businessId}`,
                          { method: "DELETE" }
                        );
                        load(businessId);
                      } catch (err) {
                        alert(
                          err instanceof FetchApiError
                            ? err.message
                            : err instanceof Error
                              ? err.message
                              : "Error al eliminar documento"
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Búsqueda en base de conocimiento
          </h2>
          <p className="text-xs text-slate-400">
            Modo mock: búsqueda por palabras clave. Preparado para embeddings en futuras versiones.
          </p>
          <div className="flex gap-2">
            <input
              className={inputCls()}
              placeholder="Buscar en la base de conocimiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="secondary" onClick={searchKnowledge}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((text, i) => (
                <p key={i} className="text-sm text-slate-600 rounded bg-slate-50 p-2">
                  {text}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${extra}`;
}
