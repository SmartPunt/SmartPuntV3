"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  markTipActiveAction,
  removeTipActiveAction,
  signOutAction,
} from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

/* ---------- TYPES (UNCHANGED) ---------- */

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  scratched?: boolean | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
};

type SuggestedTip = {
  id: number;
  meeting_id: number | null;
  race_id: number | null;
  horse_id: number | null;
  race_runner_id: number | null;
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string | null;
  commentary: string | null;
  result_comment: string | null;
  race_start_at: string | null;
  race_timezone: string | null;
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
};

/* ---------- HELPERS ---------- */

function formatRaceDateTime(value?: string | null, timezone?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone || "Australia/Perth",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTipCardStyle(type: string) {
  if (type === "Win") return "border-emerald-300/40 bg-emerald-50";
  if (type === "Place") return "border-sky-300/40 bg-sky-50";
  if (type === "All Up") return "border-pink-300/40 bg-pink-50";
  return "border-zinc-200 bg-white";
}

/* ---------- MAIN ---------- */

export default function SubscriberDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
  initialPublishedRaces,
  initialPublishedRunners,
  initialHorses,
  initialMeetings,
}: any) {
  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);

  const suggestedTips = useMemo(
    () => allTips.filter((tip) => tip.settled_at === null),
    [allTips],
  );

  const activeTipIdSet = useMemo(() => new Set(initialActiveTipIds), [initialActiveTipIds]);

  /* ✅ FIX 1: REMOVE ACTIVE TIPS FROM LIVE BOARD */
  const availableTips = useMemo(
    () => suggestedTips.filter((tip) => !activeTipIdSet.has(tip.id)),
    [suggestedTips, activeTipIdSet],
  );

  /* ✅ FIX 2: FEATURED DOES NOT REMOVE FROM BOARD */
  const featuredTip = availableTips[0] || null;
  const liveBoardTips = availableTips; // NOT slicing anymore

  function renderTipCard(tip: SuggestedTip, featured = false) {
    const isActive = activeTipIdSet.has(tip.id);
    const raceDateTime = formatRaceDateTime(tip.race_start_at, tip.race_timezone);

    return (
      <div
        key={tip.id}
        className={`rounded-[28px] border p-5 shadow-sm ${
          featured
            ? "border-amber-400/40 bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-lg"
            : getTipCardStyle(tip.type)
        }`}
      >
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-zinc-500">{tip.race}</p>
            <h3 className={`mt-1 font-bold text-zinc-950 ${featured ? "text-3xl" : "text-xl"}`}>
              {tip.horse}
            </h3>
          </div>
          <TipPill type={tip.type} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tip.confidence && <Badge tone="blue">{tip.confidence}</Badge>}
          {raceDateTime && <Badge tone="slate">{raceDateTime}</Badge>}
        </div>

        {tip.commentary && (
          <p className="mt-4 text-sm text-zinc-700">{tip.commentary}</p>
        )}

        <div className="mt-5">
          {isActive ? (
            <form action={removeTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button className="rounded-2xl border px-4 py-2 text-sm">
                Remove from Active
              </button>
            </form>
          ) : (
            <form action={markTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button className="rounded-2xl bg-black px-4 py-2 text-sm text-amber-300">
                Mark as Active
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* FEATURED */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">Featured Play</h2>
        {featuredTip && renderTipCard(featuredTip, true)}
      </div>

      {/* LIVE BOARD */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-3">Live Tips</h2>

        <div className="grid gap-4 md:grid-cols-2">
          {liveBoardTips.map((tip) => renderTipCard(tip))}
        </div>
      </div>
    </div>
  );
}
