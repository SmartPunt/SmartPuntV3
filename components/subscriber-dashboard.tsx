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

function FilterButton({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
        active
          ? "bg-amber-300 text-black"
          : "border border-white/10 bg-white/10 text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function SubscriberDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
}: any) {
  const suggestedTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState<number[]>([]);
  const [activeTipIds] = useState(initialActiveTipIds || []);

  const filteredTips =
    filter === "All"
      ? suggestedTips
      : suggestedTips.filter((t: any) => t.type === filter);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* ✅ BLACK HEADER ONLY CHANGE */}
        <div className="rounded-[32px] bg-black border border-white/10 p-8">
          <div className="flex justify-between items-center">

            <div>
              <img
                src="/header-logo.png"
                className="w-[500px] max-w-full mb-4"
              />
              <p className="text-gray-400 text-sm">
                Logged in as {currentUser?.email}
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <Badge tone="green">Live updates on</Badge>

              <Link href="/my-resulted-tips">My Resulted Tips</Link>
              <Link href="/pricing">View Plans</Link>

              <form action={signOutAction}>
                <button>Log out</button>
              </form>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="mt-6 flex gap-2">
          <FilterButton label="All" active={filter === "All"} onClick={() => setFilter("All")} />
          <FilterButton label="Win" active={filter === "Win"} onClick={() => setFilter("Win")} />
          <FilterButton label="Place" active={filter === "Place"} onClick={() => setFilter("Place")} />
          <FilterButton label="All Up" active={filter === "All Up"} onClick={() => setFilter("All Up")} />
        </div>

        {/* TIPS */}
        <div className="mt-6 space-y-4">
          {filteredTips.map((tip: any) => (
            <div key={tip.id} className="bg-white text-black p-4 rounded-xl">
              {tip.horse}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
