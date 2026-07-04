import { getAdsMode, isReadOnlyMode } from "@/lib/utils/config";

/** Acciones de lectura permitidas en ADS_MODE=read_only */
export type MetaReadAction =
  | "TEST_CONNECTION"
  | "DEBUG_PERMISSIONS"
  | "READ_ACCOUNT"
  | "READ_CAMPAIGNS"
  | "READ_ADSETS"
  | "READ_ADS"
  | "READ_INSIGHTS";

/** Acciones de escritura — prohibidas en read_only */
export type MetaWriteAction =
  | "CREATE_CAMPAIGN"
  | "UPDATE_CAMPAIGN"
  | "ACTIVATE_CAMPAIGN"
  | "PAUSE_CAMPAIGN"
  | "CHANGE_BUDGET"
  | "CHANGE_PLACEMENTS"
  | "DELETE_ANYTHING"
  | "CREATE_ACTIVE_CAMPAIGN"
  | "APPLY_RECOMMENDATION_SPEND";

export type AdsModeAction = MetaReadAction | MetaWriteAction;

const WRITE_ACTIONS = new Set<MetaWriteAction>([
  "CREATE_CAMPAIGN",
  "UPDATE_CAMPAIGN",
  "ACTIVATE_CAMPAIGN",
  "PAUSE_CAMPAIGN",
  "CHANGE_BUDGET",
  "CHANGE_PLACEMENTS",
  "DELETE_ANYTHING",
  "CREATE_ACTIVE_CAMPAIGN",
  "APPLY_RECOMMENDATION_SPEND",
]);

export class ReadOnlyModeError extends Error {
  readonly code = "READ_ONLY_MODE" as const;

  constructor(
    public readonly action: AdsModeAction,
    message?: string
  ) {
    super(
      message ??
        `ADS_MODE=read_only — la acción "${action}" está prohibida. Solo lectura de Meta/Instagram.`
    );
    this.name = "ReadOnlyModeError";
  }
}

export class DraftOnlyNotImplementedError extends Error {
  readonly code = "DRAFT_ONLY_NOT_IMPLEMENTED" as const;

  constructor() {
    super("ADS_MODE=draft_only aún no está implementado.");
    this.name = "DraftOnlyNotImplementedError";
  }
}

export class LiveApprovalNotImplementedError extends Error {
  readonly code = "LIVE_APPROVAL_NOT_IMPLEMENTED" as const;

  constructor() {
    super("ADS_MODE=live_approval aún no está implementado.");
    this.name = "LiveApprovalNotImplementedError";
  }
}

/** En read_only bloquea escrituras. En draft_only/live_approval valida modo (stubs). */
export function assertReadOnlyModeAllows(action: AdsModeAction): void {
  const mode = getAdsMode();

  if (mode === "read_only" && WRITE_ACTIONS.has(action as MetaWriteAction)) {
    throw new ReadOnlyModeError(action);
  }

  if (mode === "draft_only" && WRITE_ACTIONS.has(action as MetaWriteAction)) {
    const allowedInDraft = new Set<MetaWriteAction>(["CREATE_CAMPAIGN"]);
    if (!allowedInDraft.has(action as MetaWriteAction)) {
      throw new DraftOnlyNotImplementedError();
    }
    throw new DraftOnlyNotImplementedError();
  }

  if (mode === "live_approval" && WRITE_ACTIONS.has(action as MetaWriteAction)) {
    throw new LiveApprovalNotImplementedError();
  }
}

export function isWriteAction(action: AdsModeAction): action is MetaWriteAction {
  return WRITE_ACTIONS.has(action as MetaWriteAction);
}

export function readOnlyBlockMessage(action: AdsModeAction): string {
  return `ADS_MODE=${getAdsMode()} — "${action}" no permitida en modo solo lectura.`;
}
