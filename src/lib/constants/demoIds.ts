/** UUIDs válidos para modo demo / mock. Compatibles con columnas UUID de Supabase. */

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_BUSINESS_ID = "00000000-0000-0000-0000-000000000002";
export const DEMO_OBJECTIVE_ID = "00000000-0000-0000-0000-000000000003";
export const DEMO_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000004";
export const DEMO_BRAND_PROFILE_ID = "00000000-0000-0000-0000-000000000005";
export const DEMO_APPROVAL_ID = "00000000-0000-0000-0000-000000000006";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
