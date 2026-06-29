import type {
  FunnelStage,
  InstagramPosition,
  MetaChannelPreference,
  MetaPublisherPlatform,
  PlacementStrategy,
} from "@/lib/types/marketing";

/** Posiciones Instagram soportadas por Meta Marketing API (instagram_positions) */
export const INSTAGRAM_POSITION_OPTIONS: {
  id: InstagramPosition;
  label: string;
  apiValue: string;
  description: string;
}[] = [
  {
    id: "stream",
    label: "Instagram Feed",
    apiValue: "stream",
    description: "Publicaciones en el feed principal",
  },
  {
    id: "story",
    label: "Instagram Stories",
    apiValue: "story",
    description: "Historias a pantalla completa",
  },
  {
    id: "reels",
    label: "Instagram Reels",
    apiValue: "reels",
    description: "Video corto vertical — ideal para calentamiento",
  },
  {
    id: "explore",
    label: "Instagram Explore / Search",
    apiValue: "explore",
    description: "Descubrimiento en Explorar y búsqueda",
  },
  {
    id: "profile_feed",
    label: "Instagram Profile Feed",
    apiValue: "profile_feed",
    description: "Feed del perfil de la marca",
  },
];

export const META_CHANNEL_OPTIONS: {
  id: MetaChannelPreference;
  label: string;
  description: string;
}[] = [
  {
    id: "META_FULL",
    label: "Meta completo",
    description: "Facebook + Instagram + placements automáticos de Meta",
  },
  {
    id: "INSTAGRAM_PRIORITY",
    label: "Instagram prioritario",
    description: "Mayor peso en Instagram; Facebook como complemento",
  },
  {
    id: "FACEBOOK_PRIORITY",
    label: "Facebook prioritario",
    description: "Mayor peso en Facebook Feed",
  },
  {
    id: "INSTAGRAM_ONLY",
    label: "Solo Instagram",
    description: "Solo publisher_platforms: instagram (si la API lo permite)",
  },
];

export const PLACEMENT_STRATEGY_OPTIONS: {
  id: PlacementStrategy;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    id: "ADVANTAGE_PLUS",
    label: "Advantage+ placements (recomendado)",
    description: "Meta optimiza placements automáticamente",
    recommended: true,
  },
  {
    id: "MANUAL_INSTAGRAM_FOCUS",
    label: "Manual — foco Instagram",
    description: "Posiciones Instagram seleccionadas manualmente",
  },
  {
    id: "MANUAL_ALL_META",
    label: "Manual — todo Meta",
    description: "Instagram + Facebook con control manual",
  },
];

export function isMaldivasBrand(
  businessName?: string,
  industry?: string
): boolean {
  const text = `${businessName ?? ""} ${industry ?? ""}`.toLowerCase();
  return text.includes("maldivas") || text.includes("outdoor premium");
}

export function resolvePlacementStrategy(
  channelPreference?: MetaChannelPreference,
  explicit?: PlacementStrategy
): PlacementStrategy {
  if (explicit) return explicit;
  if (channelPreference === "META_FULL") return "ADVANTAGE_PLUS";
  return "MANUAL_INSTAGRAM_FOCUS";
}

export function resolveMetaPlacements(params: {
  funnelStage: FunnelStage;
  channelPreference?: MetaChannelPreference;
  placementStrategy?: PlacementStrategy;
  isMaldivas?: boolean;
  instagramPositions?: InstagramPosition[];
}): {
  publisherPlatforms: MetaPublisherPlatform[];
  instagramPositions: InstagramPosition[];
  placementStrategy: PlacementStrategy;
  placements: string[];
} {
  const isMaldivas = params.isMaldivas ?? false;
  const preference =
    params.channelPreference ??
    (isMaldivas ? "INSTAGRAM_PRIORITY" : "META_FULL");

  const placementStrategy = resolvePlacementStrategy(
    preference,
    params.placementStrategy
  );

  let publisherPlatforms: MetaPublisherPlatform[];
  let instagramPositions: InstagramPosition[];

  if (placementStrategy === "ADVANTAGE_PLUS") {
    publisherPlatforms =
      preference === "INSTAGRAM_ONLY"
        ? ["instagram"]
        : preference === "FACEBOOK_PRIORITY"
          ? ["facebook", "instagram"]
          : ["facebook", "instagram", "audience_network"];

    instagramPositions = defaultInstagramForFunnel(
      params.funnelStage,
      isMaldivas
    );
  } else if (preference === "INSTAGRAM_ONLY") {
    publisherPlatforms = ["instagram"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas);
  } else if (preference === "FACEBOOK_PRIORITY") {
    publisherPlatforms = ["facebook", "instagram"];
    instagramPositions = params.instagramPositions ?? ["stream"];
  } else if (preference === "INSTAGRAM_PRIORITY" || isMaldivas) {
    publisherPlatforms = ["instagram", "facebook"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas);
  } else {
    publisherPlatforms = ["facebook", "instagram", "audience_network"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas);
  }

  const placements = toPlacementLabels(publisherPlatforms, instagramPositions);

  return {
    publisherPlatforms,
    instagramPositions,
    placementStrategy,
    placements,
  };
}

function defaultInstagramForFunnel(
  funnelStage: FunnelStage,
  isMaldivas: boolean
): InstagramPosition[] {
  if (isMaldivas) {
    switch (funnelStage) {
      case "AWARENESS":
        return ["reels", "story"];
      case "LEADS":
        return ["stream", "story"];
      case "REMARKETING":
        return ["story", "stream", "reels"];
      case "TRAFFIC":
        return ["stream", "story"];
      default:
        return ["stream", "story", "reels"];
    }
  }

  switch (funnelStage) {
    case "AWARENESS":
      return ["reels", "story", "explore"];
    case "LEADS":
      return ["stream", "story"];
    case "REMARKETING":
      return ["story", "stream"];
    default:
      return ["stream", "story", "reels"];
  }
}

export function toPlacementLabels(
  publishers: MetaPublisherPlatform[],
  instagramPositions: InstagramPosition[]
): string[] {
  const labels: string[] = [];

  if (publishers.includes("instagram")) {
    for (const pos of instagramPositions) {
      const opt = INSTAGRAM_POSITION_OPTIONS.find((o) => o.id === pos);
      labels.push(opt?.label ?? `Instagram ${pos}`);
    }
  }

  if (publishers.includes("facebook")) {
    labels.push("Facebook Feed");
  }

  if (publishers.includes("audience_network")) {
    labels.push("Audience Network (monitorear CTR)");
  }

  if (publishers.includes("messenger")) {
    labels.push("Messenger");
  }

  return labels;
}

/** Payload para Meta API targeting (futuro / read_only) */
export function toMetaApiTargeting(plan: {
  publisherPlatforms?: MetaPublisherPlatform[];
  instagramPositions?: InstagramPosition[];
  placementStrategy?: PlacementStrategy;
}) {
  if (plan.placementStrategy === "ADVANTAGE_PLUS") {
    return {
      targeting_automation: { advantage_placement: true },
    };
  }

  return {
    publisher_platforms: plan.publisherPlatforms ?? ["instagram", "facebook"],
    instagram_positions: (plan.instagramPositions ?? ["stream", "story"]).map(
      (p) => INSTAGRAM_POSITION_OPTIONS.find((o) => o.id === p)?.apiValue ?? p
    ),
    facebook_positions: plan.publisherPlatforms?.includes("facebook")
      ? ["feed"]
      : [],
  };
}

export function instagramPositionLabel(pos: InstagramPosition): string {
  return (
    INSTAGRAM_POSITION_OPTIONS.find((o) => o.id === pos)?.label ?? pos
  );
}
