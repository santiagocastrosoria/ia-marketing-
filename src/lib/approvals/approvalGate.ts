import { requireHumanApproval } from "@/lib/approvals/requireHumanApproval";
import { auditLog } from "@/lib/security/auditLogger";
import { createRepository } from "@/lib/db/repository";
import type {
  ActionType,
  ProposedAction,
  RiskLevel,
} from "@/lib/types/marketing";
import { v4 as uuidv4 } from "uuid";

export class ApprovalGateError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "APPROVAL_REQUIRED"
      | "NOT_APPROVED"
      | "REJECTED"
      | "BLOCKED"
  ) {
    super(message);
    this.name = "ApprovalGateError";
  }
}

export interface GateResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalRequestId?: string;
  reason: string;
}

function assessRiskLevel(action: ProposedAction): RiskLevel {
  const { type, proposedBudget, currentBudget } = action;

    if (type === "ACTIVATE_CAMPAIGN" || type === "CREATE_ACTIVE_CAMPAIGN") {
    if (typeof proposedBudget === "number" && proposedBudget > 500000) return "HIGH";
    if (typeof proposedBudget === "number" && proposedBudget > 200000) return "MEDIUM";
    return "LOW";
  }

  if (type === "INCREASE_BUDGET" && currentBudget && proposedBudget) {
    const increase = (proposedBudget - currentBudget) / currentBudget;
    if (increase > 0.5) return "HIGH";
    if (increase > 0.2) return "MEDIUM";
    return "LOW";
  }

  if (
    type === "CHANGE_BID_AGGRESSIVE" ||
    type === "CHANGE_CONVERSION_GOAL"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function resolveCampaignPlanId(action: ProposedAction): string {
  return action.campaignPlanId ?? action.entityId;
}

export async function checkApprovalGate(
  action: ProposedAction,
  userId: string,
  options?: { approvalRequestId?: string; skipAudit?: boolean }
): Promise<GateResult> {
  const { requiresApproval, reason } = requireHumanApproval(action);

  if (!requiresApproval) {
    if (!options?.skipAudit) {
      await auditLog({
        userId,
        action: `GATE_ALLOWED:${action.type}`,
        entityType: action.entityType,
        entityId: action.entityId,
        payload: { action, reason },
      });
    }
    return { allowed: true, requiresApproval: false, reason };
  }

  if (options?.approvalRequestId) {
    const repo = await createRepository(userId);
    const request = await repo.getApprovalRequest(options.approvalRequestId);

    if (!request) {
      throw new ApprovalGateError(
        "Solicitud de aprobación no encontrada.",
        "NOT_APPROVED"
      );
    }

    if (request.status === "REJECTED") {
      throw new ApprovalGateError(
        "La acción fue rechazada por el usuario.",
        "REJECTED"
      );
    }

    if (request.status !== "APPROVED") {
      throw new ApprovalGateError(
        "La acción requiere aprobación humana antes de ejecutarse.",
        "NOT_APPROVED"
      );
    }

    if (!options?.skipAudit) {
      await auditLog({
        userId,
        action: `GATE_APPROVED_EXECUTE:${action.type}`,
        entityType: action.entityType,
        entityId: action.entityId,
        payload: { action, approvalRequestId: options.approvalRequestId },
      });
    }

    return {
      allowed: true,
      requiresApproval: true,
      approvalRequestId: options.approvalRequestId,
      reason: "Acción aprobada por el usuario.",
    };
  }

  const riskLevel = assessRiskLevel(action);
  const repo = await createRepository(userId);
  const approvalRequest = await repo.createApprovalRequest({
    campaign_plan_id: resolveCampaignPlanId(action),
    action_type: action.type as ActionType,
    action_payload: action.payload,
    reason,
    risk_level: riskLevel,
    status: "PENDING",
  });

  await auditLog({
    userId,
    action: `GATE_BLOCKED:${action.type}`,
    entityType: action.entityType,
    entityId: action.entityId,
    payload: { action, approvalRequestId: approvalRequest.id, reason },
  });

  return {
    allowed: false,
    requiresApproval: true,
    approvalRequestId: approvalRequest.id,
    reason,
  };
}

export async function executeWithApprovalGate<T>(
  action: ProposedAction,
  userId: string,
  executor: () => Promise<T>,
  approvalRequestId?: string
): Promise<{ result?: T; gate: GateResult }> {
  const gate = await checkApprovalGate(action, userId, { approvalRequestId });

  if (!gate.allowed) {
    return { gate };
  }

  const result = await executor();
  return { result, gate };
}

export async function createApprovalRequestForAction(
  action: ProposedAction,
  userId: string,
  customReason?: string
): Promise<{ id: string; riskLevel: RiskLevel }> {
  const { requiresApproval, reason } = requireHumanApproval(action);

  if (!requiresApproval) {
    throw new ApprovalGateError(
      "Esta acción no requiere aprobación.",
      "BLOCKED"
    );
  }

  const riskLevel = assessRiskLevel(action);
  const repo = await createRepository(userId);

  const request = await repo.createApprovalRequest({
    campaign_plan_id: resolveCampaignPlanId(action),
    action_type: action.type as ActionType,
    action_payload: action.payload,
    reason: customReason ?? reason,
    risk_level: riskLevel,
    status: "PENDING",
  });

  await auditLog({
    userId,
    action: `APPROVAL_REQUESTED:${action.type}`,
    entityType: action.entityType,
    entityId: action.entityId,
    payload: { action, approvalRequestId: request.id },
  });

  return { id: request.id, riskLevel };
}
