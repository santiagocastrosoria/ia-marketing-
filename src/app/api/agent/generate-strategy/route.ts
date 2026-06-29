import { NextResponse } from "next/server";
import { generateStrategy } from "@/lib/agent/strategyAgent";
import { getBrandKnowledgeContext } from "@/lib/brand/brandKnowledgeService";
import { auditLog } from "@/lib/security/auditLogger";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { logApiError } from "@/lib/api/logApiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

async function resolveObjectiveId(
  repo: Awaited<ReturnType<typeof getAuthContext>>["repo"],
  objectiveId?: string | null
): Promise<{ id: string; found: boolean } | null> {
  if (objectiveId) {
    const objective = await repo.getObjective(objectiveId);
    if (objective) return { id: objective.id, found: true };
    return null;
  }

  const objectives = await repo.getObjectives();
  if (objectives.length === 0) return null;
  return { id: objectives[0].id, found: true };
}

export async function POST(request: Request) {
  const route = "agent/generate-strategy POST";
  let userId: string | undefined;
  let businessId: string | undefined;
  let resolvedObjectiveId: string | undefined;

  try {
    const auth = await getAuthContext();
    userId = auth.userId;
    const { userEmail, repo } = auth;
    const body = await request.json();
    const { objectiveId, regenerate, loadOnly } = body as {
      objectiveId?: string;
      regenerate?: boolean;
      loadOnly?: boolean;
    };

    console.info(`[${route}] request`, {
      userId,
      userEmail,
      objectiveIdReceived: objectiveId ?? null,
      loadOnly: !!loadOnly,
      regenerate: !!regenerate,
    });

    const resolved = await resolveObjectiveId(repo, objectiveId);
    if (!resolved) {
      return apiFail(
        objectiveId
          ? "Objetivo no encontrado o no pertenece a tu cuenta"
          : "No hay objetivos. Creá uno en /objectives primero.",
        objectiveId ? "OBJECTIVE_NOT_FOUND" : "NO_OBJECTIVES",
        objectiveId ? 404 : 400,
        { userId, objectiveIdReceived: objectiveId }
      );
    }

    resolvedObjectiveId = resolved.id;
    const objective = await repo.getObjective(resolvedObjectiveId);
    if (!objective) {
      return apiFail("Objetivo no encontrado", "OBJECTIVE_NOT_FOUND", 404, {
        userId,
        objectiveId: resolvedObjectiveId,
      });
    }

    businessId = objective.business_id;

    console.info(`[${route}] objective resolved`, {
      userId,
      businessId,
      objectiveId: resolvedObjectiveId,
      goal: objective.goal,
    });

    const brandKnowledge = await getBrandKnowledgeContext(repo, objective.business_id);

    const existing = await repo.getStrategies(resolvedObjectiveId);

    if (loadOnly) {
      const latest = existing.length > 0 ? existing[existing.length - 1] : null;
      console.info(`[${route}] loadOnly`, {
        objectiveId: resolvedObjectiveId,
        strategyFound: !!latest,
        strategyId: latest?.id ?? null,
      });
      return NextResponse.json({
        success: true,
        error: false,
        strategy: latest,
        objectiveId: resolvedObjectiveId,
        businessId,
        brandKnowledge: {
          isComplete: brandKnowledge.isComplete,
          missingFields: brandKnowledge.missingFields,
          completenessScore: brandKnowledge.completenessScore,
        },
      });
    }

    if (!regenerate && existing.length > 0) {
      const latest = existing[existing.length - 1];
      console.info(`[${route}] reused existing strategy`, {
        objectiveId: resolvedObjectiveId,
        strategyId: latest.id,
      });
      return NextResponse.json({
        success: true,
        error: false,
        strategy: latest,
        objectiveId: resolvedObjectiveId,
        businessId,
        reused: true,
        brandKnowledge: {
          isComplete: brandKnowledge.isComplete,
          missingFields: brandKnowledge.missingFields,
          completenessScore: brandKnowledge.completenessScore,
        },
      });
    }

    const strategyData = generateStrategy(objective, brandKnowledge);
    const strategy = await repo.createStrategy(strategyData);

    console.info(`[${route}] strategy created`, {
      userId,
      businessId,
      objectiveId: resolvedObjectiveId,
      strategyId: strategy.id,
    });

    try {
      await auditLog({
        userId,
        repo,
        action: "STRATEGY_GENERATED",
        entityType: "strategy_plan",
        entityId: strategy.id,
        payload: {
          objectiveId: resolvedObjectiveId,
          businessId,
          brandKnowledgeUsed: true,
          completenessScore: brandKnowledge.completenessScore,
        },
      });
    } catch (auditErr) {
      console.warn(`[${route}] audit log failed (strategy saved)`, auditErr);
    }

    return NextResponse.json({
      success: true,
      error: false,
      strategy,
      objectiveId: resolvedObjectiveId,
      businessId,
      brandKnowledge: {
        isComplete: brandKnowledge.isComplete,
        missingFields: brandKnowledge.missingFields,
        completenessScore: brandKnowledge.completenessScore,
      },
    });
  } catch (error) {
    logApiError(route, error, {
      userId,
      businessId,
      objectiveId: resolvedObjectiveId,
    });
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiFail(
      error instanceof Error ? error.message : "Error al generar estrategia",
      "STRATEGY_GENERATION_FAILED",
      500,
      {
        userId,
        businessId,
        objectiveId: resolvedObjectiveId,
        details: error instanceof Error ? error.message : String(error),
      }
    );
  }
}
