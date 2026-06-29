import type { UTMParams } from "@/lib/types/marketing";

export interface UTMBuilderInput {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export function buildUTM(input: UTMBuilderInput): UTMParams {
  const params: UTMParams = {
    utm_source: sanitize(input.source),
    utm_medium: sanitize(input.medium),
    utm_campaign: sanitize(input.campaign),
  };

  if (input.content) params.utm_content = sanitize(input.content);
  if (input.term) params.utm_term = sanitize(input.term);

  return params;
}

export function utmToQueryString(utm: UTMParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(utm)) {
    if (value) parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join("&");
}

export function appendUTM(baseUrl: string, utm: UTMParams): string {
  const query = utmToQueryString(utm);
  if (!query) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${query}`;
}

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 100);
}

export function buildCampaignUTM(
  platform: "meta" | "google",
  campaignSlug: string,
  content?: string,
  term?: string
): UTMParams {
  return buildUTM({
    source: platform,
    medium: platform === "meta" ? "paid_social" : "paid_search",
    campaign: campaignSlug,
    content,
    term,
  });
}
