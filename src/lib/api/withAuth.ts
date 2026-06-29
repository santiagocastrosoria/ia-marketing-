import { AuthRequiredError, getAuthenticatedUser, requireUserId } from "@/lib/auth/getUserId";
import { createRepository, type Repository } from "@/lib/db/repository";
import { apiFail } from "@/lib/api/apiError";
import { NextResponse } from "next/server";

export async function getAuthContext(): Promise<{
  userId: string;
  userEmail?: string;
  repo: Repository;
}> {
  const user = await getAuthenticatedUser();
  const userId = user?.id ?? (await requireUserId());

  if (user) {
    console.info("[auth] session", { userId: user.id, email: user.email });
  }

  const repo = await createRepository(userId);
  return { userId, userEmail: user?.email, repo };
}

export function unauthorizedResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthRequiredError) {
    return apiFail(error.message, "UNAUTHORIZED", 401);
  }
  return null;
}
