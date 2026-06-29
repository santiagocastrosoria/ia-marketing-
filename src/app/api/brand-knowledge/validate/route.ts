import { NextResponse } from "next/server";
import {
  getBrandKnowledgeContext,
  validateForCampaignCreation,
} from "@/lib/brand/brandKnowledgeService";
import { REQUIRED_PROFILE_LABELS } from "@/lib/brand/knowledgeValidator";
import { apiErrorResponse } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET(request: Request) {
  try {
    const { repo } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: true, code: "MISSING_BUSINESS_ID", message: "businessId requerido" },
        { status: 400 }
      );
    }

    const profile = await repo.getBrandProfile(businessId);
    const documents = await repo.getBrandDocuments(businessId);
    const chunks = await repo.getBrandKnowledgeChunks(businessId);
    const { allowed, validation } = await validateForCampaignCreation(repo, businessId);
    const context = await getBrandKnowledgeContext(repo, businessId);

    return NextResponse.json({
      error: false,
      isComplete: validation.isComplete,
      completionPercentage: validation.completenessScore,
      missingFields: validation.missingFields,
      missingFieldLabels: validation.missingFields.map(
        (k) => REQUIRED_PROFILE_LABELS[k] ?? k
      ),
      businessId,
      profileExists: !!profile,
      documentsCount: documents.length,
      chunksCount: chunks.length,
      allowed,
      message: validation.message,
      context: {
        completenessScore: context.completenessScore,
        isComplete: context.isComplete,
      },
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_VALIDATE_FAILED");
  }
}
