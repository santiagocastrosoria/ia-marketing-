import type { ActionType, ProposedAction } from "@/lib/types/marketing";

const ACTIONS_REQUIRING_APPROVAL: ActionType[] = [
  "ACTIVATE_CAMPAIGN",
  "ACTIVATE_AD_SET",
  "ACTIVATE_AD",
  "INCREASE_BUDGET",
  "CREATE_ACTIVE_CAMPAIGN",
  "CHANGE_STATUS_TO_ACTIVE",
  "CHANGE_BID_AGGRESSIVE",
  "CHANGE_CONVERSION_GOAL",
  "CHANGE_LANDING_URL",
  "ADD_SPENDING_CAMPAIGN",
  "CHANGE_PLACEMENT_STRATEGY",
];

const SAFE_BUDGET_DECREASE_THRESHOLD = 0.2; // 20% decrease allowed without approval

export function requireHumanApproval(action: ProposedAction): {
  requiresApproval: boolean;
  reason: string;
} {
  const { type, payload, currentBudget, proposedBudget } = action;

  if (ACTIONS_REQUIRING_APPROVAL.includes(type)) {
    return {
      requiresApproval: true,
      reason: `La acción "${type}" puede generar gasto publicitario y requiere aprobación humana.`,
    };
  }

  if (type === "APPLY_RECOMMENDATION") {
    const recType = payload.recommendationType as string;
    const spendingActions = [
      "CHANGE_BUDGET",
      "CREATE_REMARKETING",
      "CREATE_SEARCH",
      "CREATE_WARMUP",
    ];
    if (spendingActions.includes(recType)) {
      const isIncrease =
        payload.direction === "increase" ||
        (typeof proposedBudget === "number" &&
          typeof currentBudget === "number" &&
          proposedBudget > currentBudget);
      if (isIncrease) {
        return {
          requiresApproval: true,
          reason: `Aplicar recomendación "${recType}" con aumento de presupuesto requiere aprobación.`,
        };
      }
    }
  }

  if (
    typeof currentBudget === "number" &&
    typeof proposedBudget === "number" &&
    proposedBudget > currentBudget
  ) {
    return {
      requiresApproval: true,
      reason: "Cualquier aumento de presupuesto requiere aprobación humana.",
    };
  }

  if (
    typeof currentBudget === "number" &&
    typeof proposedBudget === "number" &&
    proposedBudget < currentBudget
  ) {
    const decreasePercent =
      (currentBudget - proposedBudget) / currentBudget;
    if (decreasePercent > SAFE_BUDGET_DECREASE_THRESHOLD) {
      return {
        requiresApproval: true,
        reason: "Reducción de presupuesto superior al 20% requiere aprobación.",
      };
    }
    return {
      requiresApproval: false,
      reason: "Reducción de presupuesto dentro de límites seguros.",
    };
  }

  const statusChange = payload.newStatus as string | undefined;
  if (
    statusChange === "ACTIVE" ||
    statusChange === "ENABLED" ||
    payload.targetStatus === "ACTIVE"
  ) {
    return {
      requiresApproval: true,
      reason: "Cambiar estado a ACTIVE/ENABLED requiere aprobación humana.",
    };
  }

  return {
    requiresApproval: false,
    reason: "Acción segura que no genera gasto adicional.",
  };
}

export function isSpendingAction(type: ActionType): boolean {
  return ACTIONS_REQUIRING_APPROVAL.includes(type);
}
