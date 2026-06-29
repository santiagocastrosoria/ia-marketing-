import { NextResponse } from "next/server";
import { auditLog } from "@/lib/security/auditLogger";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { logApiError } from "@/lib/api/logApiError";
import { getOrCreateDefaultBusiness, resolveBusinessId } from "@/lib/db/businessService";
import { fromCreateObjectiveBody } from "@/lib/db/objectiveMapper";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { CreateObjectiveInput, MarketingObjective } from "@/lib/types/marketing";

function sanitizePayload(body: CreateObjectiveInput & { businessId?: string }) {
  return {
    businessName: body.businessName,
    goal: body.goal,
    product: body.product?.slice(0, 80),
    dailyBudget: body.dailyBudget,
    monthlyBudget: body.monthlyBudget,
    locations: body.locations,
    platforms: body.platforms,
    idealCustomer: body.idealCustomer?.slice(0, 80),
    averageTicket: body.averageTicket,
    brandAwarenessLevel: body.brandAwarenessLevel,
  };
}

function toMarketingObjectiveRow(
  businessId: string,
  dbRow: ReturnType<typeof fromCreateObjectiveBody>
): Omit<MarketingObjective, "id" | "created_at" | "status"> {
  return {
    business_id: businessId,
    goal: dbRow.goal,
    product: dbRow.product,
    daily_budget: dbRow.daily_budget,
    monthly_budget: dbRow.monthly_budget ?? undefined,
    locations: dbRow.locations,
    platforms: dbRow.platforms as MarketingObjective["platforms"],
    ideal_customer: dbRow.ideal_customer,
    average_ticket: dbRow.average_ticket ?? undefined,
    brand_awareness_level: dbRow.brand_awareness_level as MarketingObjective["brand_awareness_level"],
    landing_url: dbRow.landing_url ?? undefined,
    whatsapp_url: dbRow.whatsapp_url ?? undefined,
    creative_types: (dbRow.creative_types ?? undefined) as MarketingObjective["creative_types"],
    restrictions: dbRow.restrictions ?? undefined,
    industry: dbRow.industry ?? undefined,
  };
}

export async function POST(request: Request) {
  const route = "objectives POST";
  let userId: string | undefined;
  let businessId: string | undefined;
  let sanitized: ReturnType<typeof sanitizePayload> | undefined;

  try {
    const auth = await getAuthContext();
    userId = auth.userId;
    const { userEmail, repo } = auth;
    const body: CreateObjectiveInput & { businessId?: string } = await request.json();
    sanitized = sanitizePayload(body);

    if (!body.goal?.trim()) {
      return apiFail("goal es requerido", "VALIDATION_ERROR", 400, {
        userId,
        payload: sanitized,
      });
    }
    if (!body.dailyBudget || body.dailyBudget < 1) {
      return apiFail(
        "dailyBudget debe ser un número positivo en ARS",
        "VALIDATION_ERROR",
        400,
        { userId, payload: sanitized }
      );
    }
    if (!Array.isArray(body.locations) || body.locations.length === 0) {
      return apiFail(
        "locations debe ser un array con al menos una zona",
        "VALIDATION_ERROR",
        400,
        { userId, payload: sanitized }
      );
    }

    const businessDefaults = {
      name: body.businessName,
      industry: body.industry,
      website_url: body.landingUrl,
      whatsapp_number: body.whatsappUrl,
      default_location: body.locations[0],
    };

    const business = body.businessId
      ? await resolveBusinessId(repo, body.businessId, businessDefaults)
      : await getOrCreateDefaultBusiness(repo, businessDefaults);

    businessId = business.id;

    const dbRow = fromCreateObjectiveBody(business.id, {
      goal: body.goal.trim(),
      product: body.product?.trim() ?? "",
      dailyBudget: body.dailyBudget,
      monthlyBudget: body.monthlyBudget,
      locations: body.locations,
      platforms: body.platforms,
      idealCustomer: body.idealCustomer?.trim() ?? "",
      averageTicket: body.averageTicket,
      brandAwarenessLevel: body.brandAwarenessLevel,
      landingUrl: body.landingUrl,
      whatsappUrl: body.whatsappUrl,
      creativeTypes: body.creativeTypes,
      restrictions: body.restrictions,
      industry: body.industry,
    });

    console.info(`[${route}]`, {
      userId,
      userEmail,
      businessId: business.id,
      goal: body.goal,
      daily_budget: dbRow.daily_budget,
      payload: sanitized,
    });

    const objective = await repo.createObjective(
      toMarketingObjectiveRow(business.id, dbRow)
    );

    await auditLog({
      userId,
      repo,
      action: "OBJECTIVE_CREATED",
      entityType: "marketing_objective",
      entityId: objective.id,
      payload: { businessId: business.id, objectiveId: objective.id },
    });

    return NextResponse.json(
      {
        success: true,
        error: false,
        objective,
        objectiveId: objective.id,
        businessId: business.id,
        business,
      },
      { status: 201 }
    );
  } catch (error) {
    logApiError(route, error, { userId, businessId, payload: sanitized });
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiFail(
      error instanceof Error ? error.message : "Error al crear objetivo",
      "OBJECTIVE_CREATE_FAILED",
      500,
      {
        userId,
        businessId,
        payload: sanitized,
        details: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function GET() {
  const route = "objectives GET";
  try {
    const { userId, userEmail, repo } = await getAuthContext();
    const objectives = await repo.getObjectives();
    console.info(`[${route}]`, { userId, userEmail, count: objectives.length });
    return NextResponse.json({ error: false, objectives });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "OBJECTIVES_GET_FAILED");
  }
}
