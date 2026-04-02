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
          <p className="mt-1 text-xs text-zinc-600">Shown in your local timezone</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          {expanded ? "Hide Commentary" : "View Commentary"}
        </button>

        {isActiveTip ? (
          <form action={removeTipActiveAction}>
            <input type="hidden" name="tip_id" value={tip.id} />
            <button className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-zinc-800">
              Remove From Active
            </button>
          </form>
        ) : (
          <form action={markTipActiveAction}>
            <input type="hidden" name="tip_id" value={tip.id} />
            <button className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-zinc-800">
              Mark Active
            </button>
          </form>
        )}
      </div>

      {expanded ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-4">
          <p className="text-sm leading-6 text-zinc-700">
            {tip.commentary || "No commentary added yet."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WatchCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{item.race || "Watchlist"}</p>
          <h4 className="mt-1 text-xl font-semibold text-zinc-950">
            {item.horse || "Race note"}
          </h4>
        </div>
        <TipPill type={item.label} />
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.commentary || ""}</p>
    </div>
  );
}

function LongTermCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{item.title}</p>
          <h4 className="mt-1 text-xl font-semibold text-zinc-950">{item.horse}</h4>
        </div>
        <TipPill type="Long Term" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.bet_type ? <Badge tone="rose">{item.bet_type}</Badge> : null}
        {item.odds ? <Badge tone="slate">{item.odds}</Badge> : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.commentary || ""}</p>
    </div>
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
  const [expandedTipIds, setExpandedTipIds] = useState<number[]>([]);
  const [activeTipIds, setActiveTipIds] = useState<number[]>(initialActiveTipIds || []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setActiveTipIds(initialActiveTipIds || []);
  }, [initialActiveTipIds]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function toggleExpanded(id: number) {
    setExpandedTipIds((prev) =>
      prev.includes(id) ? prev.filter((tipId) => tipId !== id) : [...prev, id],
    );
  }

  const sortedTips = useMemo(() => {
    return [...suggestedTips].sort((a: any, b: any) => {
      const aTime = a.race_start_at ? new Date(a.race_start_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.race_start_at ? new Date(b.race_start_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [suggestedTips]);

  const filteredTips =
    filter === "All"
      ? sortedTips
      : sortedTips.filter((tip: any) => tip.type === filter);

  const activeTips = filteredTips.filter((tip: any) => activeTipIds.includes(tip.id));
  const availableTips = filteredTips.filter((tip: any) => !activeTipIds.includes(tip.id));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">

        {/* 🔥 CLEAN BLACK HEADER */}
        <div className="overflow-hidden rounded-[32px] bg-black border border-white/10 p-6 shadow-xl lg:p-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <img
                src="/header-logo.png"
                alt="Fortune on 5"
                className="mb-4 h-auto w-full max-w-[560px] object-contain"
              />
              <p className="mt-3 text-sm text-gray-400">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge tone="green">Live updates on</Badge>

              <Link
                href="/my-resulted-tips"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                My Resulted Tips
              </Link>

              <Link
                href="/pricing"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                View Plans
              </Link>

              <form action={signOutAction}>
                <button className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* REST OF YOUR DASHBOARD UNCHANGED BELOW */}
