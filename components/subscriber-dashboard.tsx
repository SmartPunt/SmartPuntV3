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

function formatRaceTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function getCountdownText(iso: string, now: number) {
  const diff = new Date(iso).getTime() - now;

  if (diff <= 0) return "Race started";

  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}

function CollapsibleTipCard({
  tip,
  expanded,
  isActiveTip,
  now,
  onToggleExpanded,
}: {
  tip: any;
  expanded: boolean;
  isActiveTip: boolean;
  now: number;
  onToggleExpanded: () => void;
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getTipCardStyle(
        tip.type,
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{tip.race}</p>
          <h3 className="mt-1 text-2xl font-semibold text-zinc-950">
            {tip.horse}
          </h3>
        </div>
        <TipPill type={tip.type} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
        {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
        {isActiveTip ? <Badge tone="green">My Active Tip</Badge> : null}
        {tip.race_start_at ? <Badge tone="slate">{formatRaceTime(tip.race_start_at)}</Badge> : null}
      </div>

      {tip.race_start_at ? (
        <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-800">
            {getCountdownText(tip.race_start_at, now)}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700"
        >
          {expanded ? "Hide Commentary" : "View Commentary"}
        </button>

        {isActiveTip ? (
          <form action={removeTipActiveAction}>
            <input type="hidden" name="tip_id" value={tip.id} />
            <button className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200">
              Remove From Active
            </button>
          </form>
        ) : (
          <form action={markTipActiveAction}>
            <input type="hidden" name="tip_id" value={tip.id} />
            <button className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200">
              Mark Active
            </button>
          </form>
        )}
      </div>

      {expanded && (
        <div className="mt-4 rounded-2xl bg-white/70 p-4">
          <p className="text-sm text-zinc-700">
            {tip.commentary || "No commentary added yet."}
          </p>
        </div>
      )}
    </div>
  );
}

function WatchCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
      <h4 className="text-xl font-semibold text-zinc-950">{item.horse}</h4>
      <p className="text-sm text-zinc-600 mt-2">{item.commentary}</p>
    </div>
  );
}

function LongTermCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
      <h4 className="text-xl font-semibold text-zinc-950">{item.horse}</h4>
      <p className="text-sm text-zinc-600 mt-2">{item.commentary}</p>
    </div>
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

  const [filter, setFilter] = useState<TipFilter>("All");
  const [expandedTipIds, setExpandedTipIds] = useState<number[]>([]);
  const [activeTipIds] = useState<number[]>(initialActiveTipIds || []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function toggleExpanded(id: number) {
    setExpandedTipIds((prev) =>
      prev.includes(id)
        ? prev.filter((tipId) => tipId !== id)
        : [...prev, id],
    );
  }

  const filteredTips =
    filter === "All"
      ? suggestedTips
      : suggestedTips.filter((tip: any) => tip.type === filter);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* 🔥 CLEAN BLACK HEADER */}
        <div className="rounded-[32px] bg-black border border-white/10 p-8">

          <div className="flex flex-col lg:flex-row justify-between gap-6">

            <div>
              <img
                src="/header-logo.png"
                alt="Fortune on 5"
                className="w-full max-w-[520px] mb-4 object-contain"
              />
              <p className="text-sm text-gray-400">
                Logged in as {currentUser?.email}
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <Badge tone="green">Live updates on</Badge>

              <Link href="/my-resulted-tips">
                <button className="rounded-xl border border-white/10 px-4 py-2">
                  My Resulted Tips
                </button>
              </Link>

              <Link href="/pricing">
                <button className="rounded-xl border border-white/10 px-4 py-2">
                  View Plans
                </button>
              </Link>

              <form action={signOutAction}>
                <button className="rounded-xl border border-white/10 px-4 py-2">
                  Log out
                </button>
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
            <CollapsibleTipCard
              key={tip.id}
              tip={tip}
              expanded={expandedTipIds.includes(tip.id)}
              isActiveTip={activeTipIds.includes(tip.id)}
              now={now}
              onToggleExpanded={() => toggleExpanded(tip.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
