"use client";

import { useState } from "react";
import type {
  CampaignPlan,
  InstagramPosition,
  MetaChannelPreference,
  PlacementStrategy,
} from "@/lib/types/marketing";
import {
  INSTAGRAM_POSITION_OPTIONS,
  META_CHANNEL_OPTIONS,
  PLACEMENT_STRATEGY_OPTIONS,
  instagramPositionLabel,
  resolveMetaPlacements,
} from "@/lib/ads/metaPlacements";
import { Button } from "@/components/ui/Button";

interface MetaPlacementPanelProps {
  campaign: CampaignPlan;
  onSave?: (updates: Partial<CampaignPlan>) => Promise<void>;
  readOnly?: boolean;
}

export function MetaPlacementPanel({
  campaign,
  onSave,
  readOnly = false,
}: MetaPlacementPanelProps) {
  const channel = campaign.metaChannelPreference ?? "INSTAGRAM_PRIORITY";
  const strategy = campaign.placementStrategy ?? "MANUAL_INSTAGRAM_FOCUS";
  const positions = campaign.instagramPositions ?? [];

  if (campaign.platform !== "META") return null;

  return (
    <div className="mt-4 rounded-lg border border-pink-200 bg-pink-50/50 p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-pink-800 uppercase tracking-wide">
          Placements Meta / Instagram
        </p>
        <p className="text-xs text-pink-700/80 mt-0.5">
          Estrategia:{" "}
          {PLACEMENT_STRATEGY_OPTIONS.find((o) => o.id === strategy)?.label ??
            strategy}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Canal</span>
          <p className="font-medium text-slate-800">
            {META_CHANNEL_OPTIONS.find((o) => o.id === channel)?.label}
          </p>
        </div>
        <div>
          <span className="text-slate-500">Publisher platforms</span>
          <p className="font-medium text-slate-800">
            {campaign.publisherPlatforms?.join(", ") ?? "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">
          Posiciones Instagram activas
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(positions.length ? positions : ["stream", "story", "reels"]).map(
            (pos) => (
              <span
                key={pos}
                className="rounded-full bg-white border border-pink-200 px-2.5 py-0.5 text-xs text-pink-900"
              >
                {instagramPositionLabel(pos as InstagramPosition)}
              </span>
            )
          )}
        </div>
      </div>

      {campaign.placements.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Placements</p>
          <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
            {campaign.placements.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && onSave && (
        <MetaPlacementEditor campaign={campaign} onSave={onSave} />
      )}
    </div>
  );
}

function MetaPlacementEditor({
  campaign,
  onSave,
}: {
  campaign: CampaignPlan;
  onSave: (updates: Partial<CampaignPlan>) => Promise<void>;
}) {
  const [channel, setChannel] = useState<MetaChannelPreference>(
    campaign.metaChannelPreference ?? "INSTAGRAM_PRIORITY"
  );
  const [strategy, setStrategy] = useState<PlacementStrategy>(
    campaign.placementStrategy ?? "MANUAL_INSTAGRAM_FOCUS"
  );
  const [positions, setPositions] = useState<InstagramPosition[]>(
    campaign.instagramPositions ?? ["stream", "story", "reels"]
  );
  const [saving, setSaving] = useState(false);

  const togglePosition = (pos: InstagramPosition) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const resolved = resolveMetaPlacements({
      funnelStage: campaign.funnelStage,
      channelPreference: channel,
      placementStrategy: strategy,
      instagramPositions: positions,
    });
    await onSave({
      metaChannelPreference: channel,
      placementStrategy: resolved.placementStrategy,
      publisherPlatforms: resolved.publisherPlatforms,
      instagramPositions: resolved.instagramPositions,
      placements: resolved.placements,
    });
    setSaving(false);
  };

  return (
    <div className="border-t border-pink-200 pt-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600">Canal Meta</label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          value={channel}
          onChange={(e) =>
            setChannel(e.target.value as MetaChannelPreference)
          }
        >
          {META_CHANNEL_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">
          Estrategia de placement
        </label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          value={strategy}
          onChange={(e) =>
            setStrategy(e.target.value as PlacementStrategy)
          }
        >
          {PLACEMENT_STRATEGY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.recommended ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      {strategy !== "ADVANTAGE_PLUS" && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Posiciones Instagram
          </p>
          <div className="flex flex-wrap gap-2">
            {INSTAGRAM_POSITION_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={positions.includes(opt.id)}
                  onChange={() => togglePosition(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando…" : "Actualizar placements"}
      </Button>
    </div>
  );
}
