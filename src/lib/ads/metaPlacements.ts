import type {
  FacebookPosition,
  FunnelStage,
  InstagramPosition,
  MetaChannelPreference,
  MetaPublisherPlatform,
  PlacementStrategy,
  PrimaryChannel,
  PrimaryPlacement,
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
    id: "INSTAGRAM_ONLY",
    label: "Instagram only",
    description: "Solo publisher_platforms: instagram (si la API lo permite)",
  },
  {
    id: "FACEBOOK_COMPLEMENT",
    label: "Facebook complementario",
    description: "Instagram como canal principal; Facebook Feed solo de apoyo",
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
    label: "Advantage+ placements",
    description: "Meta optimiza placements automáticamente",
    recommended: true,
  },
  {
    id: "MANUAL_INSTAGRAM_FOCUS",
    label: "Manual — foco Instagram",
    description: "Posiciones Instagram seleccionadas manualmente",
  },
  {
    id: "MANUAL_INSTAGRAM_ONLY",
    label: "Manual — solo Instagram",
    description: "Exclusivamente placements de Instagram",
  },
  {
    id: "MANUAL_ALL_META",
    label: "Manual — todo Meta",
    description: "Instagram + Facebook con control manual",
  },
];

export function isMaldivasBrand(
  businessName?: string,
  industry?: string,
  product?: string
): boolean {
  const text = `${businessName ?? ""} ${industry ?? ""} ${product ?? ""}`.toLowerCase();
  return (
    text.includes("maldivas") ||
    text.includes("outdoor premium") ||
    text.includes("muebles de exterior premium")
  );
}

export function defaultMetaChannelForBusiness(
  businessName?: string,
  industry?: string,
  product?: string
): MetaChannelPreference {
  return isMaldivasBrand(businessName, industry, product)
    ? "INSTAGRAM_PRIORITY"
    : "META_FULL";
}

export function resolvePlacementStrategy(
  channelPreference?: MetaChannelPreference,
  explicit?: PlacementStrategy
): PlacementStrategy {
  if (explicit) return explicit;
  switch (channelPreference) {
    case "META_FULL":
      return "ADVANTAGE_PLUS";
    case "INSTAGRAM_ONLY":
      return "MANUAL_INSTAGRAM_ONLY";
    case "INSTAGRAM_PRIORITY":
    case "FACEBOOK_COMPLEMENT":
      return "MANUAL_INSTAGRAM_FOCUS";
    default:
      return "ADVANTAGE_PLUS";
  }
}

export function resolvePrimaryChannel(
  channelPreference?: MetaChannelPreference,
  platform?: "META" | "GOOGLE"
): PrimaryChannel {
  if (platform === "GOOGLE") return "GOOGLE";
  switch (channelPreference) {
    case "INSTAGRAM_PRIORITY":
    case "INSTAGRAM_ONLY":
    case "FACEBOOK_COMPLEMENT":
      return "INSTAGRAM";
    case "META_FULL":
      return "META";
    default:
      return "MIXED";
  }
}

export function resolvePrimaryPlacement(
  funnelStage: FunnelStage,
  channelPreference?: MetaChannelPreference,
  platform?: "META" | "GOOGLE"
): PrimaryPlacement {
  if (platform === "GOOGLE") return "SEARCH";
  if (channelPreference === "META_FULL") return "MIXED";

  switch (funnelStage) {
    case "AWARENESS":
      return "REELS";
    case "LEADS":
      return "STORIES";
    case "REMARKETING":
      return "MIXED";
    case "TRAFFIC":
      return "FEED";
    default:
      return "MIXED";
  }
}

function defaultInstagramForFunnel(
  funnelStage: FunnelStage,
  isMaldivas: boolean,
  channelPreference?: MetaChannelPreference
): InstagramPosition[] {
  if (channelPreference === "INSTAGRAM_ONLY") {
    return ["stream", "story", "reels", "explore"];
  }

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
        return ["stream", "story", "reels", "explore"];
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

function defaultFacebookPositions(
  channelPreference?: MetaChannelPreference
): FacebookPosition[] {
  if (
    channelPreference === "INSTAGRAM_ONLY" ||
    channelPreference === "INSTAGRAM_PRIORITY" ||
    channelPreference === "FACEBOOK_COMPLEMENT"
  ) {
    return ["feed"];
  }
  if (channelPreference === "META_FULL") {
    return ["feed", "story"];
  }
  return ["feed"];
}

export function resolveMetaPlacements(params: {
  funnelStage: FunnelStage;
  channelPreference?: MetaChannelPreference;
  placementStrategy?: PlacementStrategy;
  isMaldivas?: boolean;
  instagramPositions?: InstagramPosition[];
  facebookPositions?: FacebookPosition[];
}): {
  publisherPlatforms: MetaPublisherPlatform[];
  instagramPositions: InstagramPosition[];
  facebookPositions: FacebookPosition[];
  placementStrategy: PlacementStrategy;
  placements: string[];
  primaryChannel: PrimaryChannel;
  primaryPlacement: PrimaryPlacement;
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
  let facebookPositions: FacebookPosition[];

  if (placementStrategy === "ADVANTAGE_PLUS") {
    publisherPlatforms =
      preference === "INSTAGRAM_ONLY"
        ? ["instagram"]
        : ["facebook", "instagram", "audience_network"];
    instagramPositions = defaultInstagramForFunnel(
      params.funnelStage,
      isMaldivas,
      preference
    );
    facebookPositions =
      preference === "INSTAGRAM_ONLY"
        ? []
        : defaultFacebookPositions(preference);
  } else if (placementStrategy === "MANUAL_INSTAGRAM_ONLY") {
    publisherPlatforms = ["instagram"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas, "INSTAGRAM_ONLY");
    facebookPositions = [];
  } else if (preference === "INSTAGRAM_ONLY") {
    publisherPlatforms = ["instagram"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas, preference);
    facebookPositions = [];
  } else if (
    preference === "INSTAGRAM_PRIORITY" ||
    preference === "FACEBOOK_COMPLEMENT" ||
    isMaldivas
  ) {
    publisherPlatforms = ["instagram", "facebook"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas, preference);
    facebookPositions =
      params.facebookPositions ?? defaultFacebookPositions(preference);
  } else {
    publisherPlatforms = ["facebook", "instagram", "audience_network"];
    instagramPositions =
      params.instagramPositions ??
      defaultInstagramForFunnel(params.funnelStage, isMaldivas, preference);
    facebookPositions =
      params.facebookPositions ?? defaultFacebookPositions(preference);
  }

  const placements = toPlacementLabels(
    publisherPlatforms,
    instagramPositions,
    facebookPositions
  );

  return {
    publisherPlatforms,
    instagramPositions,
    facebookPositions,
    placementStrategy,
    placements,
    primaryChannel: resolvePrimaryChannel(preference, "META"),
    primaryPlacement: resolvePrimaryPlacement(
      params.funnelStage,
      preference,
      "META"
    ),
  };
}

export function toPlacementLabels(
  publishers: MetaPublisherPlatform[],
  instagramPositions: InstagramPosition[],
  facebookPositions: FacebookPosition[] = ["feed"]
): string[] {
  const labels: string[] = [];

  if (publishers.includes("instagram")) {
    for (const pos of instagramPositions) {
      const opt = INSTAGRAM_POSITION_OPTIONS.find((o) => o.id === pos);
      labels.push(opt?.label ?? `Instagram ${pos}`);
    }
  }

  if (publishers.includes("facebook")) {
    for (const pos of facebookPositions) {
      labels.push(pos === "feed" ? "Facebook Feed" : `Facebook ${pos}`);
    }
  }

  if (publishers.includes("audience_network")) {
    labels.push("Audience Network (monitorear CTR)");
  }

  if (publishers.includes("messenger")) {
    labels.push("Messenger");
  }

  return labels;
}

export function placementStrategyLabel(strategy?: PlacementStrategy): string {
  return (
    PLACEMENT_STRATEGY_OPTIONS.find((o) => o.id === strategy)?.label ??
    strategy ??
    "—"
  );
}

export function primaryChannelLabel(channel?: PrimaryChannel): string {
  const labels: Record<PrimaryChannel, string> = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    GOOGLE: "Google",
    META: "Meta",
    MIXED: "Mixto",
  };
  return channel ? labels[channel] : "—";
}

export function primaryPlacementLabel(placement?: PrimaryPlacement): string {
  const labels: Record<PrimaryPlacement, string> = {
    REELS: "Reels",
    STORIES: "Stories",
    FEED: "Feed",
    SEARCH: "Search",
    MIXED: "Mixto",
  };
  return placement ? labels[placement] : "—";
}

/** Payload para Meta API targeting (futuro / read_only) */
export function toMetaApiTargeting(plan: {
  publisherPlatforms?: MetaPublisherPlatform[];
  instagramPositions?: InstagramPosition[];
  facebookPositions?: FacebookPosition[];
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
    facebook_positions: plan.facebookPositions?.length
      ? plan.facebookPositions
      : plan.publisherPlatforms?.includes("facebook")
        ? ["feed"]
        : [],
  };
}

export function instagramPositionLabel(pos: InstagramPosition): string {
  return (
    INSTAGRAM_POSITION_OPTIONS.find((o) => o.id === pos)?.label ?? pos
  );
}

export function channelPlacementDisplayName(
  publisher: string,
  position: string
): { channel: string; placement: string } {
  if (publisher === "google") {
    return { channel: "Google", placement: "Search" };
  }
  if (publisher === "facebook") {
    return { channel: "Facebook", placement: position === "feed" ? "Feed" : position };
  }
  const map: Record<string, string> = {
    stream: "Feed",
    story: "Stories",
    reels: "Reels",
    explore: "Explore",
    profile_feed: "Profile Feed",
  };
  return {
    channel: "Instagram",
    placement: map[position] ?? position,
  };
}
