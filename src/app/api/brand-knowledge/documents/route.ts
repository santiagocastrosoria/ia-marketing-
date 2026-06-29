import { NextResponse } from "next/server";
import {
  addBrandDocument,
  getBrandKnowledgeContext,
} from "@/lib/brand/brandKnowledgeService";
import { resolveBusinessId } from "@/lib/db/businessService";
import { auditLog } from "@/lib/security/auditLogger";
import { apiErrorResponse } from "@/lib/api/apiError";
import { logApiError } from "@/lib/api/logApiError";
import { getAuthContext, unauthorizedResponse } from "@/lib/api/withAuth";
import type { BrandDocumentInput } from "@/lib/types/brand";

export async function GET(request: Request) {
  const route = "brand-knowledge/documents GET";
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

    const business = await resolveBusinessId(repo, businessId);
    const documents = await repo.getBrandDocuments(business.id);
    return NextResponse.json({ error: false, documents });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_DOCUMENTS_GET_FAILED");
  }
}

export async function POST(request: Request) {
  const route = "brand-knowledge/documents POST";
  try {
    const { userId, userEmail, repo } = await getAuthContext();
    const body = (await request.json()) as BrandDocumentInput;
    if (!body.business_id || !body.title) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "business_id y title son requeridos",
        },
        { status: 400 }
      );
    }

    const business = await resolveBusinessId(repo, body.business_id);
    console.info(`[${route}]`, { userId, userEmail, businessId: business.id });

    const context = await addBrandDocument(repo, {
      ...body,
      business_id: business.id,
    });

    await auditLog({
      userId,
      repo,
      action: "BRAND_DOCUMENT_ADDED",
      entityType: "brand_document",
      entityId: business.id,
      payload: { title: body.title, type: body.document_type },
    });

    return NextResponse.json({ error: false, context });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_DOCUMENT_SAVE_FAILED");
  }
}

export async function DELETE(request: Request) {
  const route = "brand-knowledge/documents DELETE";
  try {
    const { repo } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const businessId = searchParams.get("businessId");
    if (!id || !businessId) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "id y businessId requeridos",
        },
        { status: 400 }
      );
    }

    const business = await resolveBusinessId(repo, businessId);
    await repo.deleteBrandDocument(id);
    const context = await getBrandKnowledgeContext(repo, business.id);

    return NextResponse.json({ error: false, context });
  } catch (error) {
    logApiError(route, error);
    const unauth = unauthorizedResponse(error);
    if (unauth) return unauth;
    return apiErrorResponse(error, "BRAND_DOCUMENT_DELETE_FAILED");
  }
}
