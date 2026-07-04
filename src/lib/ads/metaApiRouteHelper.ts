import { apiFail } from "@/lib/api/apiError";
import { getMetaIntegrationStatus } from "@/lib/ads/metaConfig";
import {
  META_ADS_READ_PERMISSION_MESSAGE,
  META_ADS_READ_PERMISSION_SUGGESTION,
} from "@/lib/ads/metaApiState";
import {
  MetaApiError,
  MetaConfigError,
  MetaPermissionError,
} from "@/lib/ads/metaRealService";
import type { NextResponse } from "next/server";

/** Respuesta JSON consistente para errores Meta en rutas API. */
export function metaApiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof MetaPermissionError) {
    return apiFail(META_ADS_READ_PERMISSION_MESSAGE, error.code, 403, {
      details: String(error.details ?? ""),
      suggestion: META_ADS_READ_PERMISSION_SUGGESTION,
      meta: getMetaIntegrationStatus(false, error.message),
    });
  }

  if (error instanceof MetaConfigError) {
    return apiFail(error.message, error.code, 400, {
      meta: getMetaIntegrationStatus(false, error.message),
    });
  }

  if (error instanceof MetaApiError) {
    return apiFail(error.message, error.code, 502, {
      details: String(error.details ?? ""),
      meta: getMetaIntegrationStatus(false, error.message),
    });
  }

  return null;
}
