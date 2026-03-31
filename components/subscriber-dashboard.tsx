"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

type TipFilter = "All" | "Win" | "Place" | "All Up";

function getTipCardStyle(type: string) {
  if (type === "Win") {
    return "border-emerald-300/50 bg-emerald-100";
  }

  if (type === "Place") {
    return "border-sky-300/50 bg-sky-100";
  }

  if (type === "All Up") {
    return "border-pink-300/50 bg-pink-100";
  }

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

  if (diff <= 0) {
    return "Race started";
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}

function calculateSuccessStats(tips: any[]) {
  const now = new Date();

  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const isThisMonth = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  };

  const settled = tips.filter((tip) => typeof tip.successful === "boolean");
  const settledToday = settled.filter((tip) => isToday(tip.race_start_at || tip.created_at));
  const settledThisMonth = settled.filter((tip) =>
    isThisMonth(tip.race_start_at || tip.created_at),
  );

  const pct = (items: any[]) =>
    items.length ? Math.round((items.filter((tip) => tip.successful).length / items.length) * 100) : 0;

  return {
    day: { rate: pct(settledToday), total: settledToday.length },
    month: { rate: pct(settledThisMonth), total: settledThisMonth.length },
    all: { rate: pct(settled), total: settled.length },
  };
}

function CollapsibleTipCard({
  tip,
  expanded,
  isActiveTip,
  now,
  onToggleExpanded,
  onMarkActive,
  onRemoveActive,
}: {
  tip: any;
  expanded: boolean;
  isActiveTip: boolean;
  now: number;
  onToggleExpanded: () => void;
  onMarkActive: () => void;
  onRemoveActive: () => void;
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
        {isActiveTip ? <Badge tone="green">Active Tip</Badge> : null}
        {tip.race_start_at ? <Badge tone="slate">{formatRaceTime(tip.race_start_at)}</Badge> : null}
        {tip.finishing_position ? <Badge tone="slate">Placed {tip.finishing_position}</Badge> : null}
        {tip.successful === true ? <Badge tone="green">Successful</Badge> : null}
        {tip.successful === false ? <Badge tone="rose">Unsuccessful</Badge> : null}
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
          <button
            type="button"
            onClick={onRemoveActive}
            className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-zinc-800"
          >
            Remove From Active
          </button>
        ) : (
          <button
            type="button"
            onClick={onMarkActive}
            className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-zinc-800"
          >
            Mark Active
          </button>
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
}: {
  currentUser: any;
  initialSuggestedTips: any[];
  initialWatchlistItems: any[];
  initialLongTermBets: any[];
}) {
  const suggestedTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const stats = useMemo(() => calculateSuccessStats(suggestedTips), [suggestedTips]);

  const [filter, setFilter] = useState<TipFilter>("All");
  const [expandedTipIds, setExpandedTipIds] = useState<number[]>([]);
  const [activeTipIds, setActiveTipIds] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());

  const storageKey = useMemo(() => {
    return `smartpunt-active-tips-${currentUser?.id || currentUser?.email || "subscriber"}`;
  }, [currentUser]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        setActiveTipIds(JSON.parse(saved));
      }
    } catch {
      setActiveTipIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(activeTipIds));
    } catch {
      // ignore localStorage issues
    }
  }, [activeTipIds, storageKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function toggleExpanded(id: number) {
    setExpandedTipIds((prev) =>
      prev.includes(id) ? prev.filter((tipId) => tipId !== id) : [...prev, id],
    );
  }

  function markActive(id: number) {
    setActiveTipIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeActive(id: number) {
    setActiveTipIds((prev) => prev.filter((tipId) => tipId !== id));
  }

  const sortedTips = [...suggestedTips].sort((a: any, b: any) => {
    const aTime = a.race_start_at ? new Date(a.race_start_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.race_start_at ? new Date(b.race_start_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const filteredTips =
    filter === "All"
      ? sortedTips
      : sortedTips.filter((tip: any) => tip.type === filter);

  const activeTips = filteredTips.filter((tip: any) => activeTipIds.includes(tip.id));
  const availableTips = filteredTips.filter((tip: any) => !activeTipIds.includes(tip.id));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#171717,#3f3f46,#ca8a04)] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">SmartPunt</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight">Premium Racing Club</h1>
              <p className="mt-2 text-sm text-amber-100/85">
                Sharp daily tips, expert insight, and longer-range plays.
              </p>
              <p className="mt-3 text-sm text-amber-100/70">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge tone="green">Live updates on</Badge>
              <Link
                href="/pricing"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                View Plans
              </Link>
              <form action={signOutAction}>
                <button className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Today success</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.day.rate}%</p>
                <Badge tone="green">{stats.day.total} settled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Month success</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.month.rate}%</p>
                <Badge tone="amber">{stats.month.total} settled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">All-time success</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.all.rate}%</p>
                <Badge tone="rose">{stats.all.total} settled</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Today’s Suggested Tips</h2>
              <p className="mt-1 text-sm text-amber-100/70">
                Filter by bet type, open commentary when needed, and move bets you’re taking into Active Tips.
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
                  <h3 className="text-xl font-semibold">Active Tips</h3>
                  <p className="text-sm text-zinc-500">
                    Tips you’ve marked as acted on.
                  </p>
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
                      onMarkActive={() => markActive(tip.id)}
                      onRemoveActive={() => removeActive(tip.id)}
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
                  <h3 className="text-xl font-semibold">Available Tips</h3>
                  <p className="text-sm text-zinc-500">
                    Compact list view. Open any tip to read the full commentary.
                  </p>
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
                      onMarkActive={() => markActive(tip.id)}
                      onRemoveActive={() => removeActive(tip.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No tips match this filter right now.
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
