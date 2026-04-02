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
          <h3 className="mt-1 text-2xl font-semibold text-zinc-950">{tip.horse}</h3>
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
        <div className="relative overflow-hidden rounded-[32px] bg-black shadow-xl border border-white/10 min-h-[260px] lg:min-h-[300px]">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="absolute left-[34%] top-1/2 w-[460px] max-w-none -translate-y-1/2 opacity-90 pointer-events-none select-none lg:w-[520px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.12)_35%,rgba(0,0,0,0.55)_100%)]" />

          <div className="relative z-10 flex h-full min-h-[260px] flex-col justify-between p-5 lg:min-h-[300px] lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <Badge tone="green">Live updates on</Badge>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/my-resulted-tips"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  My Resulted Tips
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  View Plans
                </Link>
                <form action={signOutAction}>
                  <button className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                    Log out
                  </button>
                </form>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="rounded-2xl bg-black/28 p-4 backdrop-blur-[1px]">
                <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  Premium Racing Club
                </h1>
                <p className="mt-2 text-sm text-zinc-200 lg:text-base">
                  Sharp daily tips, expert insight, and longer-range plays.
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Live Tips</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{suggestedTips.length}</p>
                <Badge tone="green">Unsettled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">My Active Tips</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{activeTips.length}</p>
                <Badge tone="amber">Saved</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Long-term live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{longTermBets.length}</p>
                <Badge tone="rose">Futures</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Today’s Suggested Tips</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Settled tips are moved off this page. Open commentary when needed and save the tips you’re taking.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterButton label="All" active={filter === "All"} onClick={() => setFilter("All")} />
              <FilterButton label="Win" active={filter === "Win"} onClick={() => setFilter("Win")} />
              <FilterButton label="Place" active={filter === "Place"} onClick={() => setFilter("Place")} />
              <FilterButton label="All Up" active={filter === "All Up"} onClick={() => setFilter("All Up")} />
            </div>
          </div>

          <Panel className="text-zinc-950">
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">My Active Tips</h3>
                  <p className="text-sm text-zinc-500">Tips you’ve saved to follow.</p>
                </div>
                <Badge tone="green">{activeTips.length} active</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {activeTips.length ? (
                  activeTips.map((tip: any) => (
                    <CollapsibleTipCard
                      key={tip.id}
                      tip={tip}
                      expanded={expandedTipIds.includes(tip.id)}
                      isActiveTip={true}
                      now={now}
                      onToggleExpanded={() => toggleExpanded(tip.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No active tips yet. Mark a tip active when you decide to take it.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Available Live Tips</h3>
                  <p className="text-sm text-zinc-500">Only unsettled tips are shown here.</p>
                </div>
                <Badge tone="blue">{availableTips.length} shown</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {availableTips.length ? (
                  availableTips.map((tip: any) => (
                    <CollapsibleTipCard
                      key={tip.id}
                      tip={tip}
                      expanded={expandedTipIds.includes(tip.id)}
                      isActiveTip={false}
                      now={now}
                      onToggleExpanded={() => toggleExpanded(tip.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No live tips match this filter right now.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <div className="grid gap-8 xl:grid-cols-2">
            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                    <p className="text-sm text-zinc-500">
                      Smart observations, forgive runs, and runners to keep on side.
                    </p>
                  </div>
                  <Badge tone="amber">{watchlistItems.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {watchlistItems.length ? (
                    watchlistItems.map((item: any) => <WatchCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                      No watchlist items posted yet.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Long-term bets</h3>
                    <p className="text-sm text-zinc-500">
                      Longer-range betting angles and futures worth tracking.
                    </p>
                  </div>
                  <Badge tone="rose">{longTermBets.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {longTermBets.length ? (
                    longTermBets.map((item: any) => <LongTermCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                      No long-term bets posted yet.
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
