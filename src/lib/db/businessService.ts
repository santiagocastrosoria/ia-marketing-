import type { Repository } from "@/lib/db/repository";
import type { Business } from "@/lib/types/marketing";

export interface DefaultBusinessOptions {
  name?: string;
  industry?: string;
  website_url?: string;
  whatsapp_number?: string;
  default_location?: string;
}

/**
 * Obtiene el primer business del usuario o crea uno por defecto.
 * Nunca devuelve business_id null.
 */
export async function getOrCreateDefaultBusiness(
  repo: Repository,
  options: DefaultBusinessOptions = {}
): Promise<Business> {
  const existing = await repo.getBusinesses();
  if (existing.length > 0) {
    return existing[0];
  }

  if (options.name) {
    const byName = await repo.findBusinessByName(options.name);
    if (byName) return byName;
  }

  return repo.createBusiness({
    name: options.name ?? "Mi negocio",
    industry: options.industry ?? "",
    website_url: options.website_url,
    whatsapp_number: options.whatsapp_number,
    default_location: options.default_location,
  });
}

/**
 * Resuelve business_id: valida ownership si se pasa id, o get/create default.
 * Si businessId es inválido o de otro usuario (ej. localStorage viejo), hace fallback.
 */
export async function resolveBusinessId(
  repo: Repository,
  businessId?: string | null,
  defaults: DefaultBusinessOptions = {}
): Promise<Business> {
  if (businessId) {
    const business = await repo.getBusiness(businessId);
    if (business) return business;
    console.warn(
      `[resolveBusinessId] businessId ignorado (no existe o sin permisos): ${businessId}`
    );
  }

  if (defaults.name) {
    const byName = await repo.findBusinessByName(defaults.name);
    if (byName) return byName;
  }

  return getOrCreateDefaultBusiness(repo, defaults);
}
