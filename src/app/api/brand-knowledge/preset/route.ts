import { NextResponse } from "next/server";
import {
  addBrandDocument,
  getBrandKnowledgeContext,
  reindexBusinessKnowledge,
  upsertBrandProfile,
} from "@/lib/brand/brandKnowledgeService";
import { resolveBusinessId } from "@/lib/db/businessService";
import { auditLog } from "@/lib/security/auditLogger";
import { apiErrorResponse } from "@/lib/api/apiError";
import { logApiError } from "@/lib/api/logApiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import {
  MALDIVAS_BRAND_DOCUMENTS,
  MALDIVAS_BRAND_PROFILE,
} from "@/lib/utils/maldivas-brand-preset";

export async function POST(request: Request) {
  const route = "brand-knowledge/preset POST";
  try {
    const { userId, userEmail, repo } = await getAuthContext();
    const { businessId, businessName } = await request.json();

    const business = await resolveBusinessId(repo, businessId, {
      name: businessName ?? "Maldivas Outdoor",
      industry: "Muebles de exterior premium",
      website_url: "https://maldivasoutdoor.com",
      whatsapp_number: "https://wa.me/5493510000000",
    });

    console.info(`[${route}]`, { userId, userEmail, businessId: business.id });

    await upsertBrandProfile(repo, {
      business_id: business.id,
      ...MALDIVAS_BRAND_PROFILE,
    });

    const existingDocs = await repo.getBrandDocuments(business.id);
    if (existingDocs.length === 0) {
      for (const doc of MALDIVAS_BRAND_DOCUMENTS) {
        await addBrandDocument(repo, { business_id: business.id, ...doc });
      }
    } else {
      await reindexBusinessKnowledge(repo, business.id);
    }

    const context = await getBrandKnowledgeContext(repo, business.id);

    await auditLog({
      userId,
      repo,
      action: "BRAND_PRESET_LOADED",
      entityType: "brand_profile",
      entityId: business.id,
      payload: { preset: "maldivas" },
    });

    return NextResponse.json({
      error: false,
      context,
      businessId: business.id,
    });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_PRESET_FAILED");
  }
}
