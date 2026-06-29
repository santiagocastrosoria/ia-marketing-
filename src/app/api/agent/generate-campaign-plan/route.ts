import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { buildCampaignPlans } from "@/lib/agent/campaignBuilder";
import { generateStrategy } from "@/lib/agent/strategyAgent";
import {
  getBrandKnowledgeContext,
  validateForCampaignCreation,
} from "@/lib/brand/brandKnowledgeService";
import { auditLog } from "@/lib/security/auditLogger";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { isMockMode } from "@/lib/utils/config";

export async function POST(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const { objectiveId, strategyId } = await request.json();
    if (!objectiveId) {
      return apiFail("objectiveId es requerido", "MISSING_OBJECTIVE_ID", 400);
    }

    const objective = await repo.getObjective(objectiveId);
    if (!objective) {
      return apiFail("Objetivo no encontrado", "OBJECTIVE_NOT_FOUND", 404);
    }

    const brandKnowledge = await getBrandKnowledgeContext(
      repo,
      objective.business_id
    );
    const { allowed, validation } = await validateForCampaignCreation(
      repo,
      objective.business_id
    );

    const mockMode = isMockMode();
    let warning: string | undefined;

    if (!allowed) {
      if (mockMode) {
        warning =
          "Base de marca incompleta. Se generan campañas en DRAFT/PAUSED solo en modo demo. Completá la base de marca antes de publicar en plataforma.";
      } else {
        return apiFail(
          "No se pueden generar campañas todavía porque la base de marca está incompleta.",
          "BRAND_KNOWLEDGE_INCOMPLETE",
          422,
          {
            missingFields: validation.missingFields,
            completenessScore: validation.completenessScore,
            completionPercentage: validation.completenessScore,
            businessId: objective.business_id,
            profileExists: !!brandKnowledge.profile,
            redirectTo: "/brand-knowledge",
          }
        );
      }
    }

    let strategy;
    if (strategyId) {
      const strategies = await repo.getStrategies(objectiveId);
      strategy = strategies.find((s) => s.id === strategyId);
    }
    if (!strategy) {
      const strategies = await repo.getStrategies(objectiveId);
      strategy = strategies[strategies.length - 1];
    }
    if (!strategy) {
      const strategyData = generateStrategy(objective, brandKnowledge);
      strategy = await repo.createStrategy(strategyData);
    }

    const planData = buildCampaignPlans(objective, strategy, brandKnowledge);
    const campaigns = [];

    for (const plan of planData) {
      const created = await repo.createCampaignPlan(plan);
      campaigns.push(created);
    }

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_PLANS_GENERATED",
      entityType: "marketing_objective",
      entityId: objectiveId,
      payload: {
        campaignCount: campaigns.length,
        brandKnowledgeUsed: true,
        completenessScore: brandKnowledge.completenessScore,
        mockMode,
        warning,
      },
    });

    return NextResponse.json({
      strategy,
      campaigns,
      warning,
      brandKnowledge: {
        isComplete: brandKnowledge.isComplete,
        completenessScore: brandKnowledge.completenessScore,
        missingFields: brandKnowledge.missingFields,
        businessId: objective.business_id,
      },
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_PLAN_GENERATE_FAILED");
  }
}
