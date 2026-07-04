import { NextResponse } from "next/server";
import { apiErrorResponse, apiFail } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import { generateCampaignBlueprintProposal } from "@/lib/agent/campaignGeneratorAgent";
import { gatherMetaPerformanceContext } from "@/lib/ads/metaInsightsContext";
import { getBrandKnowledgeContext } from "@/lib/brand/brandKnowledgeService";
import { auditLog } from "@/lib/security/auditLogger";
import type {
  CampaignGeneratorChannel,
  CampaignGeneratorGoal,
  CampaignGeneratorInput,
  LuxuryLevel,
} from "@/lib/types/campaignBlueprint";

function parseInput(body: Record<string, unknown>): CampaignGeneratorInput | null {
  const productOffer = String(body.productOffer ?? "").trim();
  const targetZone = String(body.targetZone ?? "").trim();
  const dailyBudget = Number(body.dailyBudget);
  const suggestedDurationDays = Number(body.suggestedDurationDays ?? 14);
  const channelPreference = body.channelPreference as CampaignGeneratorChannel;
  const campaignGoal = body.campaignGoal as CampaignGeneratorGoal;
  const luxuryLevel = body.luxuryLevel as LuxuryLevel;

  if (!productOffer || !targetZone) return null;
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) return null;
  if (!Number.isFinite(suggestedDurationDays) || suggestedDurationDays < 7) return null;

  const validChannels: CampaignGeneratorChannel[] = [
    "INSTAGRAM_PRIORITY",
    "META_FULL",
    "GOOGLE_FUTURE",
  ];
  const validGoals: CampaignGeneratorGoal[] = [
    "WHATSAPP_LEADS",
    "WEB_TRAFFIC",
    "AWARENESS",
    "REMARKETING",
  ];
  const validLuxury: LuxuryLevel[] = ["premium", "ultra_premium"];

  if (!validChannels.includes(channelPreference)) return null;
  if (!validGoals.includes(campaignGoal)) return null;
  if (!validLuxury.includes(luxuryLevel)) return null;

  return {
    productOffer,
    targetZone,
    dailyBudget,
    suggestedDurationDays,
    channelPreference,
    campaignGoal,
    luxuryLevel,
    additionalNotes: body.additionalNotes
      ? String(body.additionalNotes)
      : undefined,
    businessId: body.businessId ? String(body.businessId) : undefined,
  };
}

async function resolveBusiness(
  repo: Awaited<ReturnType<typeof getAuthContext>>["repo"],
  businessId?: string
) {
  if (businessId) {
    const business = await repo.getBusiness(businessId);
    if (business) return business;
  }
  const maldivas = await repo.findBusinessByName("Maldivas Outdoor");
  if (maldivas) return maldivas;
  const businesses = await repo.getBusinesses();
  return businesses[0];
}

export async function POST(request: Request) {
  try {
    const { userId, repo } = await getAuthContext();
    const body = await request.json();
    const input = parseInput(body);

    if (!input) {
      return apiFail(
        "Completá producto, zona, presupuesto, duración, canal, objetivo y nivel de lujo.",
        "INVALID_GENERATOR_INPUT",
        400
      );
    }

    const business = await resolveBusiness(repo, input.businessId);
    if (!business) {
      return apiFail(
        "No hay negocio configurado. Creá Maldivas Outdoor en la base de marca.",
        "BUSINESS_NOT_FOUND",
        404
      );
    }

    input.businessId = business.id;

    const query = [
      input.productOffer,
      input.targetZone,
      input.campaignGoal,
      input.luxuryLevel,
    ].join(" ");

    const [brandKnowledge, metaInsights] = await Promise.all([
      getBrandKnowledgeContext(repo, business.id, query),
      gatherMetaPerformanceContext(),
    ]);

    const { proposal, status } = generateCampaignBlueprintProposal(
      input,
      brandKnowledge,
      metaInsights
    );

    const blueprint = await repo.createCampaignBlueprint({
      user_id: userId,
      business_id: business.id,
      input,
      proposal,
      status,
    });

    await auditLog({
      userId,
      repo,
      action: "CAMPAIGN_BLUEPRINT_GENERATED",
      entityType: "campaign_blueprint",
      entityId: blueprint.id,
      payload: {
        status,
        campaignName: proposal.campaignName,
        metaInsightsUsed: metaInsights.used,
        brandCompleteness: brandKnowledge.completenessScore,
      },
    });

    return NextResponse.json({
      blueprint: {
        ...blueprint,
        business_name: business.name,
      },
      brandKnowledge: {
        isComplete: brandKnowledge.isComplete,
        completenessScore: brandKnowledge.completenessScore,
        businessId: business.id,
      },
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_GENERATE_FAILED");
  }
}

export async function GET() {
  try {
    const { repo } = await getAuthContext();
    const blueprints = await repo.getCampaignBlueprints();
    const businesses = await repo.getBusinesses();
    const businessMap = new Map(businesses.map((b) => [b.id, b.name]));

    return NextResponse.json({
      blueprints: blueprints.map((b) => ({
        ...b,
        business_name: businessMap.get(b.business_id),
      })),
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "CAMPAIGN_BLUEPRINT_LIST_FAILED");
  }
}
