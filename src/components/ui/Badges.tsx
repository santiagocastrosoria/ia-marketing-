import { cn } from "@/lib/utils/cn";
import type { EntityStatus, RiskLevel } from "@/lib/types/marketing";

const statusStyles: Record<EntityStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  PAUSED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<EntityStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAUSED: "Pausado",
  ACTIVE: "Activo",
  ARCHIVED: "Archivado",
};

export function StatusBadge({
  status,
  className,
}: {
  status: EntityStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

const riskStyles: Record<RiskLevel, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
};

const riskLabels: Record<RiskLevel, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
};

export function RiskBadge({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        riskStyles[level],
        className
      )}
    >
      Riesgo {riskLabels[level]}
    </span>
  );
}
