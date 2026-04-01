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
    <div className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(tip.type)}`}>
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-zinc-500">{tip.race}</p>
          <h3 className="text-2xl font-semibold text-zinc-950">{tip.horse}</h3>
        </div>
        <TipPill type={tip.type} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tip.confidence && <Badge tone="blue">{tip.confidence}</Badge>}
        {tip.note && <Badge tone="amber">{tip.note}</Badge>}
      </div>

      {tip.race_start_at && (
        <div className="mt-3 bg-white/70 p-3 rounded-xl">
          {getCountdownText(tip.race_start_at, now)}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={onToggleExpanded}>Commentary</button>
      </div>

      {expanded && <div className="mt-3">{tip.commentary}</div>}
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

  const [filter, setFilter] = useState<TipFilter>("All");
  const [expanded, setExpanded] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* HEADER */}
        <div className="rounded-[32px] p-8 border border-[#D4AF37]/20 bg-[linear-gradient(180deg,#111118,rgba(17,17,24,0.95))] relative overflow-hidden">

          {/* subtle gold glow */}
          <div className="absolute right-0 top-0 h-full w-[40%] bg-gradient-to-l from-[#D4AF37]/20 to-transparent pointer-events-none" />

          <div className="flex justify-between items-center">

            <div>
              <img
                src="/header-logo.png"
                className="w-[420px] object-contain mb-4"
              />

              <p className="text-gray-400 text-sm">
                Logged in as {currentUser?.email}
              </p>
            </div>

            <div className="flex gap-3">
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
          {suggestedTips.map((tip: any) => (
            <CollapsibleTipCard
              key={tip.id}
              tip={tip}
              expanded={expanded.includes(tip.id)}
              isActiveTip={false}
              now={now}
              onToggleExpanded={() =>
                setExpanded((prev) =>
                  prev.includes(tip.id)
                    ? prev.filter((id) => id !== tip.id)
                    : [...prev, tip.id]
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
