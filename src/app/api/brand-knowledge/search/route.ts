import { NextResponse } from "next/server";
import { getBrandKnowledgeContext } from "@/lib/brand/brandKnowledgeService";
import { retrieveByKeywords } from "@/lib/brand/knowledgeRetriever";
import { apiErrorResponse } from "@/lib/api/apiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";

export async function GET(request: Request) {
  try {
    const { repo } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const query = searchParams.get("q") ?? "";

    if (!businessId) {
      return NextResponse.json(
        { error: true, code: "MISSING_BUSINESS_ID", message: "businessId requerido" },
        { status: 400 }
      );
    }

    const chunks = await repo.getBrandKnowledgeChunks(businessId);
    const result = retrieveByKeywords(query, chunks, 10);
    const context = await getBrandKnowledgeContext(repo, businessId, query);

    return NextResponse.json({
      error: false,
      query,
      mode: result.mode,
      chunks: result.chunks,
      scores: result.scores,
      context: {
        positioning: context.positioning,
        suggestedKeywords: context.suggestedKeywords.slice(0, 10),
        negativeKeywords: context.negativeKeywords.slice(0, 10),
      },
    });
  } catch (error) {
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_SEARCH_FAILED");
  }
}
