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
  const [expandedTipIds, setExpandedTipIds] = useState<number[]>([]);
  const [activeTipIds, setActiveTipIds] = useState<number[]>(initialActiveTipIds || []);

  function toggleExpanded(id: number) {
    setExpandedTipIds((prev) =>
      prev.includes(id)
        ? prev.filter((tipId) => tipId !== id)
        : [...prev, id]
    );
  }

  const filteredTips =
    filter === "All"
      ? suggestedTips
      : suggestedTips.filter((t: any) => t.type === filter);

  const activeTips = filteredTips.filter((t: any) => activeTipIds.includes(t.id));
  const availableTips = filteredTips.filter((t: any) => !activeTipIds.includes(t.id));

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* ✅ FIXED HEADER ONLY */}
        <div className="rounded-[32px] bg-black border border-white/10 p-8 mb-6">
          <div className="flex justify-between items-center">

            <div>
              <img
                src="/header-logo.png"
                alt="Fortune on 5"
                className="w-[520px] max-w-full mb-4 object-contain"
              />
              <p className="text-gray-400 text-sm">
                Logged in as {currentUser?.email}
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <Badge tone="green">Live updates on</Badge>

              <Link href="/my-resulted-tips">
                <button className="border border-white/10 px-4 py-2 rounded-xl">
                  My Resulted Tips
                </button>
              </Link>

              <Link href="/pricing">
                <button className="border border-white/10 px-4 py-2 rounded-xl">
                  View Plans
                </button>
              </Link>

              <form action={signOutAction}>
                <button className="border border-white/10 px-4 py-2 rounded-xl">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="flex gap-2 mb-6">
          <FilterButton label="All" active={filter === "All"} onClick={() => setFilter("All")} />
          <FilterButton label="Win" active={filter === "Win"} onClick={() => setFilter("Win")} />
          <FilterButton label="Place" active={filter === "Place"} onClick={() => setFilter("Place")} />
          <FilterButton label="All Up" active={filter === "All Up"} onClick={() => setFilter("All Up")} />
        </div>

        {/* ACTIVE TIPS */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">My Active Tips</h2>
          {activeTips.map((tip: any) => (
            <div key={tip.id} className="bg-white text-black p-4 rounded-xl mb-2">
              {tip.horse}
            </div>
          ))}
        </div>

        {/* AVAILABLE TIPS */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Available Tips</h2>
          {availableTips.map((tip: any) => (
            <div key={tip.id} className="bg-white text-black p-4 rounded-xl mb-2">
              {tip.horse}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
