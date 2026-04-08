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

function getUrgencyMeta(iso: string, now: number) {
  const diff = new Date(iso).getTime() - now;

  if (diff <= 0) {
    return {
      label: "Race underway",
      tone: "red" as const,
    };
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);

  if (totalMinutes <= 10) {
    return {
      label: `Jumps in ${totalMinutes} min`,
      tone: "red" as const,
    };
  }

  if (totalMinutes <= 30) {
    return {
      label: `Jumping soon · ${totalMinutes} min`,
      tone: "amber" as const,
    };
  }

  if (totalMinutes <= 120) {
    return {
      label: `Coming up · ${totalMinutes} min`,
      tone: "blue" as const,
    };
  }

  return {
    label: getCountdownText(iso, now),
    tone: "slate" as const,
  };
}

function pickBestBet(tips: any[]) {
  if (!tips.length) return null;

  const noteHasBest = (tip: any) =>
    typeof tip.note === "string" && tip.note.toLowerCase().includes("best bet");

  const explicitBest = tips.find(noteHasBest);
  if (explicitBest) return explicitBest;

  const highConfidenceWin = tips.find(
    (tip: any) => tip.type === "Win" && tip.confidence === "High",
  );
  if (highConfidenceWin) return highConfidenceWin;

  const anyWin = tips.find((tip: any) => tip.type === "Win");
  if (anyWin) return anyWin;

  return tips[0];
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
  const urgency = tip.race_start_at ? getUrgencyMeta(tip.race_start_at, now) : null;

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
        {urgency ? <Badge tone={urgency.tone}>{urgency.label}</Badge> : null}
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
  const bestBetTip = useMemo(() => pickBestBet(filteredTips), [filteredTips]);

  const availableLiveTipsCount = suggestedTips.filter(
    (tip: any) => !activeTipIds.includes(tip.id),
  ).length;
  const watchlistCount = watchlistItems.length;
  const longTermCount = longTermBets.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="relative overflow-hidden rounded-[32px] bg-black shadow-xl border border-white/10 min-h-[180px] lg:min-h-[300px]">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="absolute left-1/2 top-[45%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-95 pointer-events-none select-none sm:w-[400px] lg:top-[42%] lg:w-[943px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.46)_100%)]" />

          <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between p-4 lg:min-h-[300px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="green">Live updates on</Badge>

              <div className="ml-auto flex flex-col items-end gap-2 lg:gap-3">
                <Link
                  href="/my-resulted-tips"
                  className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                >
                  My Resulted Tips
                </Link>
                <Link
                  href="/pricing"
                  className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                >
                  View Plans
                </Link>
                <form action={signOutAction}>
                  <button className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm">
                    Log out
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-auto">
              <div className="rounded-2xl bg-black/18 px-4 py-3 backdrop-blur-[1px] lg:px-5 lg:py-4">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-white lg:gap-x-5">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-4xl">
                    Premium Racing Club
                  </h1>
                  <p className="text-sm text-zinc-200 lg:text-base">
                    Sharp daily tips, expert insight, and longer-range plays.
                  </p>
                  <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                    Logged in as {currentUser.full_name || currentUser.email}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-zinc-950"
                  >
                    <span>Live Tips</span>
                    <NavCount count={availableLiveTipsCount} active />
                  </Link>
                  <Link
                    href="/watchlist"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <span>Horses / Races to Watch</span>
                    <NavCount count={watchlistCount} />
                  </Link>
                  <Link
                    href="/long-term-bets"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <span>Long-Term Bets</span>
                    <NavCount count={longTermCount} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {bestBetTip ? (
          <div className="mt-6">
            <div className="overflow-hidden rounded-[28px] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(18,18,18,0.98),rgba(44,33,10,0.98))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">Best Bet</Badge>
                    <TipPill type={bestBetTip.type} />
                    {bestBetTip.confidence ? (
                      <Badge tone="blue">{bestBetTip.confidence} confidence</Badge>
                    ) : null}
                    {bestBetTip.race_start_at ? (
                      <Badge tone={getUrgencyMeta(bestBetTip.race_start_at, now).tone}>
                        {getUrgencyMeta(bestBetTip.race_start_at, now).label}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-4 text-sm uppercase tracking-[0.22em] text-amber-200/75">
                    Featured play
                  </p>

                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-white lg:text-4xl">
                    {bestBetTip.horse}
                  </h2>

                  <p className="mt-2 text-base text-zinc-300">
                    {bestBetTip.race}
                  </p>

                  <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-200">
                    {bestBetTip.commentary || bestBetTip.note || "Today’s standout play."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {activeTipIds.includes(bestBetTip.id) ? (
                      <form action={removeTipActiveAction}>
                        <input type="hidden" name="tip_id" value={bestBetTip.id} />
                        <button className="rounded-2xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
                          Remove From Active
                        </button>
                      </form>
                    ) : (
                      <form action={markTipActiveAction}>
                        <input type="hidden" name="tip_id" value={bestBetTip.id} />
                        <button className="rounded-2xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
                          Mark Active
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/25 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/75">
                    Race urgency
                  </p>

                  {bestBetTip.race_start_at ? (
                    <>
                      <p className="mt-4 text-3xl font-bold text-white">
                        {getCountdownText(bestBetTip.race_start_at, now).replace("Starts in ", "")}
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {formatRaceTime(bestBetTip.race_start_at)}
                      </p>
                      <div className="mt-4">
                        <Badge tone={getUrgencyMeta(bestBetTip.race_start_at, now).tone}>
                          {getUrgencyMeta(bestBetTip.race_start_at, now).label}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-300">
                      Race time not set yet.
                    </p>
                  )}

                  <div className="mt-6 rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Why this is featured
                    </p>
                    <p className="mt-3 text-sm leading-7 text-zinc-200">
                      Highest-priority play surfaced for quick action. Strongest match is chosen from today’s visible tips, preferring explicit Best Bet tags first, then high-confidence win selections.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
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
              <p className="text-sm text-zinc-500">Watchlist Live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{watchlistItems.length}</p>
                <Badge tone="blue">Track</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Long-Term Live</p>
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

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                    <p className="text-sm text-zinc-500">
                      This section has moved to its own page for a cleaner subscriber feed.
                    </p>
                  </div>
                  <Badge tone="amber">{watchlistItems.length} live</Badge>
                </div>

                <div className="mt-5 rounded-[24px] border border-amber-200/30 bg-white p-5">
                  <p className="text-sm leading-6 text-zinc-600">
                    Smart observations, forgive runs, and runners to keep on side now live on their
                    own dedicated page.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/watchlist"
                      className="inline-flex rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                    >
                      Open Watchlist Page
                    </Link>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Long-term bets</h3>
                    <p className="text-sm text-zinc-500">
                      Longer-range betting angles now have their own dedicated page too.
                    </p>
                  </div>
                  <Badge tone="rose">{longTermBets.length} live</Badge>
                </div>

                <div className="mt-5 rounded-[24px] border border-amber-200/30 bg-white p-5">
                  <p className="text-sm leading-6 text-zinc-600">
                    Futures and longer-range plays are now separated from the daily tips feed so the
                    main page stays sharper.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/long-term-bets"
                      className="inline-flex rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                    >
                      Open Long-Term Bets Page
                    </Link>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
