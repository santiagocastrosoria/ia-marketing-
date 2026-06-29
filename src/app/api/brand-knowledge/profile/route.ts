import { NextResponse } from "next/server";
import {
  getBrandKnowledgeContext,
  upsertBrandProfile,
  validateBrandKnowledge,
} from "@/lib/brand/brandKnowledgeService";
import { resolveBusinessId } from "@/lib/db/businessService";
import { auditLog } from "@/lib/security/auditLogger";
import { apiErrorResponse } from "@/lib/api/apiError";
import { logApiError } from "@/lib/api/logApiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { BrandProfileInput } from "@/lib/types/brand";

export async function GET(request: Request) {
  const route = "brand-knowledge/profile GET";
  try {
    const { userId, userEmail, repo } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");

    if (!businessIdParam) {
      const businesses = await repo.getBusinesses();
      console.info(`[${route}]`, { userId, userEmail, businessCount: businesses.length });
      return NextResponse.json({ error: false, businesses });
    }

    const business = await resolveBusinessId(repo, businessIdParam);
    const context = await getBrandKnowledgeContext(repo, business.id);
    const validation = validateBrandKnowledge(context.profile, context.documents);

    return NextResponse.json({ error: false, context, validation, businessId: business.id });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_PROFILE_GET_FAILED");
  }
}

export async function POST(request: Request) {
  const route = "brand-knowledge/profile POST";
  try {
    const { userId, userEmail, repo } = await getAuthContext();
    const body = await request.json();
    const { businessId, businessName, profile } = body as {
      businessId?: string;
      businessName?: string;
      profile: Omit<BrandProfileInput, "business_id">;
    };

    const business = await resolveBusinessId(repo, businessId, {
      name: businessName ?? "Mi negocio",
      industry: profile.main_products?.slice(0, 80),
    });

    console.info(`[${route}]`, { userId, userEmail, businessId: business.id });

    const context = await upsertBrandProfile(repo, {
      business_id: business.id,
      ...profile,
    });

    await auditLog({
      userId,
      repo,
      action: "BRAND_PROFILE_UPDATED",
      entityType: "brand_profile",
      entityId: context.profile?.id ?? business.id,
      payload: { businessId: business.id },
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
    return apiErrorResponse(error, "BRAND_PROFILE_SAVE_FAILED");
  }
}
