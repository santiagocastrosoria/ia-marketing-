import type {
  CampaignBlueprintStatus,
  CampaignReviewStatus,
} from "@/lib/types/campaignBlueprint";

export const STATUS_LABELS: Record<CampaignBlueprintStatus, string> = {
  INTERNAL_DRAFT: "Borrador interno",
  READY_FOR_META_DRAFT: "Listo para borrador Meta",
  NEEDS_ASSETS: "Requiere assets",
  NEEDS_REVIEW: "Requiere revisión",
  APPROVAL_REQUIRED: "Requiere aprobación",
};

export const STATUS_COLORS: Record<CampaignBlueprintStatus, string> = {
  INTERNAL_DRAFT: "bg-slate-100 text-slate-700",
  READY_FOR_META_DRAFT: "bg-emerald-100 text-emerald-800",
  NEEDS_ASSETS: "bg-amber-100 text-amber-800",
  NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  APPROVAL_REQUIRED: "bg-indigo-100 text-indigo-800",
};

export const REVIEW_STATUS_LABELS: Record<CampaignReviewStatus, string> = {
  READY_FOR_META_DRAFT: STATUS_LABELS.READY_FOR_META_DRAFT,
  NEEDS_ASSETS: STATUS_LABELS.NEEDS_ASSETS,
  NEEDS_REVIEW: STATUS_LABELS.NEEDS_REVIEW,
  APPROVAL_REQUIRED: STATUS_LABELS.APPROVAL_REQUIRED,
};

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 65) return "text-amber-600";
  return "text-red-600";
}

export function scoreRingColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 65) return "stroke-amber-500";
  return "stroke-red-500";
}
