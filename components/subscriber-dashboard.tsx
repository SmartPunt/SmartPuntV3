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

/* TYPES UNCHANGED */
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

type WatchItem = {
  id: number;
  race: string;
  horse: string;
  label: string;
  commentary: string | null;
  created_at: string;
  updated_at: string;
};

type LongTermBet = {
  id: number;
  title: string;
  horse: string;
  meeting: string | null;
  race_number: number | null;
  race_start_at: string | null;
  race_timezone: string | null;
  bet_type: string;
  odds: string;
  commentary: string | null;
  created_at: string;
  updated_at: string;
};

export default function SubscriberDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
}: {
  currentUser: any;
  initialSuggestedTips: SuggestedTip[];
  initialWatchlistItems: WatchItem[];
  initialLongTermBets: LongTermBet[];
  initialActiveTipIds: number[];
}) {

  // 🔥 REALTIME DATA
  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);

  // ✅ ONLY LIVE TIPS
  const suggestedTips = useMemo(
    () => allTips.filter((tip: any) => tip.settled_at === null),
    [allTips]
  );

  // 🔥 FIXED ACTIVE TIP LOGIC
  const activeTipIdSet = useMemo(
    () => new Set(initialActiveTipIds),
    [initialActiveTipIds]
  );

  const activeLiveTips = useMemo(
    () =>
      suggestedTips.filter((tip) =>
        activeTipIdSet.has(tip.id)
      ),
    [suggestedTips, activeTipIdSet]
  );

  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const featuredTip = suggestedTips[0] || null;
  const otherTips = suggestedTips.slice(1);

  function renderTipCard(tip: SuggestedTip) {
    const isActive = activeTipIdSet.has(tip.id);

    return (
      <div key={tip.id} className="rounded-[28px] border p-5 shadow-sm bg-white">
        <h3 className="text-xl font-bold text-black">{tip.horse}</h3>

        <div className="mt-4">
          {isActive ? (
            <form action={removeTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button className="text-sm text-red-600">
                Remove Active
              </button>
            </form>
          ) : (
            <form action={markTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button className="text-sm text-green-600">
                Mark Active
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="flex gap-3 mb-6">
        <Link href="/current-races">Current Races</Link>
        <Link href="/my-resulted-tips">My Resulted Tips</Link>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Panel>
          <div className="p-4">
            <p>Live Tips</p>
            <p className="text-2xl">{suggestedTips.length}</p>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <p>My Active Tips</p>
            {/* ✅ FIXED COUNT */}
            <p className="text-2xl">{activeLiveTips.length}</p>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <p>Watchlist</p>
            <p className="text-2xl">{watchlistItems.length}</p>
          </div>
        </Panel>
      </div>

      {/* LIVE TIPS */}
      <div className="grid gap-4">
        {suggestedTips.map((tip) => renderTipCard(tip))}
      </div>
    </div>
  );
}
