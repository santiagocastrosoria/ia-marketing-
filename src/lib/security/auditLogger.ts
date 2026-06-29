import { createRepository } from "@/lib/db/repository";
import type { Repository } from "@/lib/db/repository";

export async function auditLog(params: {
  userId: string;
  repo?: Repository;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const repo = params.repo ?? (await createRepository(params.userId));
  await repo.createAuditLog({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    payload: params.payload,
  });
}
