import type {
  MarketingObjective,
  MetaChannelPreference,
  PlacementStrategy,
} from "@/lib/types/marketing";

const META_TAG = /\[meta_settings:([^\]]+)\]/;

export interface MetaObjectiveSettings {
  metaChannelPreference?: MetaChannelPreference;
  placementStrategy?: PlacementStrategy;
}

export function stripMetaSettings(text: string): string {
  return text.replace(META_TAG, "").trim();
}

export function encodeMetaInRestrictions(
  restrictions: string | undefined,
  settings: MetaObjectiveSettings
): string {
  const cleaned = stripMetaSettings(restrictions ?? "");
  if (!settings.metaChannelPreference && !settings.placementStrategy) {
    return cleaned;
  }
  const tag = `[meta_settings:${JSON.stringify(settings)}]`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

export function decodeMetaFromRestrictions(
  restrictions?: string | null
): MetaObjectiveSettings {
  if (!restrictions) return {};
  const match = restrictions.match(META_TAG);
  if (!match) return {};
  try {
    return JSON.parse(match[1]) as MetaObjectiveSettings;
  } catch {
    return {};
  }
}

export function hydrateObjectiveMeta(
  objective: MarketingObjective
): MarketingObjective {
  const fromRestrictions = decodeMetaFromRestrictions(objective.restrictions);
  return {
    ...objective,
    restrictions: stripMetaSettings(objective.restrictions ?? "") || undefined,
    meta_channel_preference:
      objective.meta_channel_preference ??
      fromRestrictions.metaChannelPreference,
    placement_strategy:
      objective.placement_strategy ?? fromRestrictions.placementStrategy,
  };
}

export function visibleRestrictions(restrictions?: string | null): string {
  return stripMetaSettings(restrictions ?? "");
}
