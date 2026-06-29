import { DEMO_USER_ID } from "@/lib/constants/demoIds";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isDemoUserEnabled,
  isSupabaseConfigured,
} from "@/lib/utils/config";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export class AuthRequiredError extends Error {
  constructor(message = "Debes iniciar sesión para continuar") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Obtiene usuario de la sesión activa (cookies), sin fallback demo.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.id && isValidUuid(data.user.id)) {
      return {
        id: data.user.id,
        email: data.user.email ?? undefined,
      };
    }
  } catch {
    // Sin sesión
  }

  return null;
}

/**
 * @deprecated Usar getAuthenticatedUser()
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}

/**
 * Resuelve user_id para operaciones de backend.
 * - Usuario autenticado → auth.user.id
 * - Sin auth + ENABLE_DEMO_USER (no producción) → DEMO_USER_ID
 * - Sin auth + sin Supabase + demo deshabilitado → null
 * - Producción sin auth → null
 */
export async function getUserId(): Promise<string | null> {
  const sessionUser = await getAuthenticatedUser();
  if (sessionUser) return sessionUser.id;

  if (isDemoUserEnabled()) {
    return resolveDemoUserId();
  }

  return null;
}

/** Exige usuario autenticado o demo habilitado. Lanza AuthRequiredError si no hay sesión válida. */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new AuthRequiredError();
  }
  return userId;
}

/** Síncrono — solo para mock store cuando demo está habilitado o no hay Supabase */
export function getDemoUserId(): string {
  return resolveDemoUserId();
}

function resolveDemoUserId(): string {
  const envOverride = process.env.DEMO_USER_ID;
  if (envOverride && isValidUuid(envOverride)) {
    return envOverride;
  }
  return DEMO_USER_ID;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
