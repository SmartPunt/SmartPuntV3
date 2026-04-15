"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  markTipActiveAction,
  removeTipActiveAction,
  signOutAction,
} from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

type TipFilter = "All" | "Win" | "Place" | "All Up";

function getTipCardStyle(type: string) {
  if (type === "Win") return "border-emerald-300/50 bg-emerald-100";
  if (type === "Place") return "border-sky-300/50 bg-sky-100";
  if (type === "All Up") return "border-pink-300/50 bg-pink-100";
  return "border-amber-200/30 bg-white";
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: TipFilter;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-amber-300 text-zinc-950"
          : "border border-white/10 bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      {label}
    </button>
  );
}

function NavCount({
  count,
  active = false,
}: {
  count: number;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
        active ? "bg-zinc-950 text-amber-300" : "bg-white/15 text-white"
      }`}
    >
      {count}
    </span>
  );
}

export default function SubscriberDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
}: {
  currentUser: any;
  initialSuggestedTips: any[];
  initialWatchlistItems: any[];
  initialLongTermBets: any[];
  initialActiveTipIds: number[];
}) {
  const suggestedTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const [filter, setFilter] = useState<TipFilter>("All");

  const availableLiveTipsCount = suggestedTips.length;
  const watchlistCount = watchlistItems.length;
  const longTermCount = longTermBets.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">

        <div className="rounded-[32px] bg-black border border-white/10 p-6">

          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Premium Racing Club</h1>

            <form action={signOutAction}>
              <button className="text-sm">Log out</button>
            </form>
          </div>

          {/* ✅ NAV UPDATED HERE */}
          <div className="mt-4 flex flex-wrap gap-2">

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Live Tips
              <NavCount count={availableLiveTipsCount} active />
            </Link>

            <Link
              href="/published-races"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Race Fields
            </Link>

            <Link
              href="/watchlist"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Watchlist
              <NavCount count={watchlistCount} />
            </Link>

            <Link
              href="/long-term-bets"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Get On Early 🔥
              <NavCount count={longTermCount} />
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}
