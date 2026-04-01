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

function getTipCardStyle(type: string, featured = false) {
  if (featured) {
    return "border-[#D4AF37]/45 bg-[linear-gradient(180deg,rgba(212,175,55,0.08),rgba(17,17,24,0.96))] shadow-[0_0_0_1px_rgba(212,175,55,0.08),0_20px_60px_rgba(0,0,0,0.35)]";
  }

  if (type === "Win") {
    return "border-emerald-500/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.07),rgba(17,17,24,0.96))]";
  }
  if (type === "Place") {
    return "border-sky-500/25 bg-[linear-gradient(180deg,rgba(14,165,233,0.07),rgba(17,17,24,0.96))]";
  }
  if (type === "All Up") {
    return "border-violet-500/25 bg-[linear-gradient(180deg,rgba(139,92,246,0.08),rgba(17,17,24,0.96))]";
  }

  return "border-white/10 bg-[#111118]";
}

function getTypeAccent(type: string) {
  if (type === "Win") return "text-emerald-300";
  if (type === "Place") return "text-sky-300";
  if (type === "All Up") return "text-violet-300";
  return "text-amber-300";
}

function getPriorityLabel(tip: any) {
  const source = `${tip.note || ""} ${tip.commentary || ""}`.toLowerCase();

  if (source.includes("best bet")) return "Best Bet";
  if (source.includes("value")) return "Value Bet";
  if (source.includes("safe")) return "Safe Play";
  if (source.includes("watch")) return "Horse to Watch";

  if (tip.confidence === "High") return "Top Play";
  if (tip.confidence === "Medium") return "Live Chance";

  return null;
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
          ? "bg-[#D4AF37] text-black shadow-[0_8px_30px_rgba(212,175,55,0.25)]"
          : "border border-white/10 bg-white/5 text-[#EAEAF0] hover:bg-white/10"
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

  if (days > 0) return `Jump in ${days}d ${hours}h`;
  if (hours > 0) return `Jump in ${hours}h ${minutes}m`;
  return `Jump in ${minutes}m`;
}

function getCountdownTone(iso?: string, now?: number) {
  if (!iso || !now) return "border-white/10 bg-white/5 text-[#EAEAF0]";

  const diff = new Date(iso).getTime() - now;

  if (diff <= 0) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);

  if (totalMinutes <= 15) {
    return "border-[#D4AF37]/40 bg-[#D4AF37]/12 text-[#F6E7A8]";
  }

  if (totalMinutes <= 60) {
    return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  }

  return "border-white/10 bg-white/5 text-[#EAEAF0]";
}

function ActionButton({
  active,
  tipId,
}: {
  active: boolean;
  tipId: number;
}) {
  if (active) {
    return (
      <form action={removeTipActiveAction}>
        <input type="hidden" name="tip_id" value={tipId} />
        <button className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-[#EAEAF0] transition hover:bg-white/12">
          Remove From Active
        </button>
      </form>
    );
  }

  return (
    <form action={markTipActiveAction}>
      <input type="hidden" name="tip_id" value={tipId} />
      <button className="rounded-2xl bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-105">
        Mark Active
      </button>
    </form>
  );
}

function CollapsibleTipCard({
  tip,
  expanded,
  isActiveTip,
  now,
  onToggleExpanded,
  featured = false,
}: {
  tip: any;
  expanded: boolean;
  isActiveTip: boolean;
  now: number;
  onToggleExpanded: () => void;
  featured?: boolean;
}) {
  const priorityLabel = getPriorityLabel(tip);

  return (
    <div
      className={`rounded-[28px] border p-5 text-[#EAEAF0] transition duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/35 ${getTipCardStyle(
        tip.type,
        featured,
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[#A1A1AA]">{tip.race}</p>
          <h3
            className={`mt-1 font-semibold tracking-tight ${
              featured ? "text-3xl" : "text-2xl"
            }`}
          >
            {tip.horse}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`text-sm font-semibold ${getTypeAccent(tip.type)}`}>
              {tip.type}
            </span>
            {tip.confidence ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#D7D7DE]">
                {tip.confidence} confidence
              </span>
            ) : null}
            {priorityLabel ? (
              <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#F6E7A8]">
                {priorityLabel}
              </span>
            ) : null}
            {isActiveTip ? (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                My Active Tip
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <TipPill type={tip.type} />
        </div>
      </div>

      {tip.race_start_at ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 ${getCountdownTone(
            tip.race_start_at,
            now,
          )}`}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              {getCountdownText(tip.race_start_at, now)}
            </p>
            <p className="text-xs opacity-80">{formatRaceTime(tip.race_start_at)}</p>
          </div>
          <p className="mt-1 text-xs opacity-75">Shown in your local timezone</p>
        </div>
      ) : null}

      {tip.note ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A1A1AA]">
            Notes
          </p>
          <p className="mt-2 text-sm leading-6 text-[#D7D7DE]">{tip.note}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#EAEAF0] transition hover:bg-white/10"
        >
          {expanded ? "Hide Commentary" : "View Commentary"}
        </button>

        <ActionButton active={isActiveTip} tipId={tip.id} />
      </div>

      {expanded ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A1A1AA]">
            Commentary
          </p>
          <p className="mt-3 text-sm leading-7 text-[#D7D7DE]">
            {tip.commentary || "No commentary added yet."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WatchCard({ item }: { item: any }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#111118] p-5 text-[#EAEAF0]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#A1A1AA]">{item.race || "Watchlist"}</p>
          <h4 className="mt-1 text-xl font-semibold tracking-tight">
            {item.horse || "Race note"}
          </h4>
        </div>
        <TipPill type={item.label} />
      </div>

      <p className="mt-4 text-sm leading-7 text-[#D7D7DE]">
        {item.commentary || ""}
      </p>
    </div>
  );
}

function LongTermCard({ item }: { item: any }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#111118] p-5 text-[#EAEAF0]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#A1A1AA]">{item.title}</p>
          <h4 className="mt-1 text-xl font-semibold tracking-tight">{item.horse}</h4>
        </div>
        <TipPill type="Long Term" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.bet_type ? <Badge tone="rose">{item.bet_type}</Badge> : null}
        {item.odds ? <Badge tone="slate">{item.odds}</Badge> : null}
      </div>

      <p className="mt-4 text-sm leading-7 text-[#D7D7DE]">
        {item.commentary || ""}
      </p>
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
      const aTime = a.race_start_at
        ? new Date(a.race_start_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.race_start_at
        ? new Date(b.race_start_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [suggestedTips]);

  const filteredTips =
    filter === "All"
      ? sortedTips
      : sortedTips.filter((tip: any) => tip.type === filter);

  const activeTips = filteredTips.filter((tip: any) => activeTipIds.includes(tip.id));
  const availableTips = filteredTips.filter((tip: any) => !activeTipIds.includes(tip.id));

  const featuredTip = useMemo(() => {
    if (!availableTips.length) return null;

    const scored = [...availableTips].sort((a: any, b: any) => {
      const score = (tip: any) => {
        let value = 0;

        if ((tip.note || "").toLowerCase().includes("best bet")) value += 100;
        if (tip.confidence === "High") value += 50;
        if (tip.type === "Win") value += 20;
        if (tip.race_start_at) {
          const diff = new Date(tip.race_start_at).getTime() - now;
          if (diff > 0) value += Math.max(0, 1000000000 - diff) / 100000000;
        }

        return value;
      };

      return score(b) - score(a);
    });

    return scored[0];
  }, [availableTips, now]);

  const remainingAvailableTips = featuredTip
    ? availableTips.filter((tip: any) => tip.id !== featuredTip.id)
    : availableTips;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_22%),linear-gradient(180deg,#09090B_0%,#0B0B0F_45%,#111118_100%)] text-[#EAEAF0]">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden rounded-[36px] border border-[#D4AF37]/20 bg-[linear-gradient(135deg,rgba(17,17,24,0.98),rgba(24,24,32,0.98),rgba(212,175,55,0.18))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <img src="/logo.png" alt="Fortune on 5" className="mb-4 h-14 w-auto" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F6E7A8]">
                  Premium Access
                </span>
                <Badge tone="green">Live updates on</Badge>
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight lg:text-5xl">
                SmartPunt Subscriber Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#D7D7DE]/80 lg:text-base">
                Sharp daily tips, premium commentary, and race-day urgency built for punters who want the edge without the noise.
              </p>
              <p className="mt-4 text-sm text-[#B8B8C2]">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/my-resulted-tips"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#EAEAF0] transition hover:bg-white/10"
              >
                My Resulted Tips
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#EAEAF0] transition hover:bg-white/10"
              >
                View Plans
              </Link>
              <form action={signOutAction}>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#EAEAF0] transition hover:bg-white/10">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
            <div className="p-5">
              <p className="text-sm text-[#A1A1AA]">Live Tips</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-3xl font-semibold">{suggestedTips.length}</p>
                <Badge tone="green">Unsettled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
            <div className="p-5">
              <p className="text-sm text-[#A1A1AA]">My Active Tips</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-3xl font-semibold">{activeTipIds.length}</p>
                <Badge tone="amber">Saved</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
            <div className="p-5">
              <p className="text-sm text-[#A1A1AA]">Long-Term Live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-3xl font-semibold">{longTermBets.length}</p>
                <Badge tone="rose">Futures</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#EAEAF0]">Today’s Suggested Tips</h2>
              <p className="mt-1 text-sm text-[#B8B8C2]">
                Settled tips are moved off this page. Save what you’re taking and open commentary when you want the deeper read.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterButton label="All" active={filter === "All"} onClick={() => setFilter("All")} />
              <FilterButton label="Win" active={filter === "Win"} onClick={() => setFilter("Win")} />
              <FilterButton label="Place" active={filter === "Place"} onClick={() => setFilter("Place")} />
              <FilterButton label="All Up" active={filter === "All Up"} onClick={() => setFilter("All Up")} />
            </div>
          </div>

          {featuredTip ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-[#EAEAF0]">Featured Play</h3>
                  <p className="text-sm text-[#B8B8C2]">
                    Your strongest live look right now.
                  </p>
                </div>
                <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F6E7A8]">
                  Premium Highlight
                </span>
              </div>

              <CollapsibleTipCard
                tip={featuredTip}
                expanded={expandedTipIds.includes(featuredTip.id)}
                isActiveTip={false}
                now={now}
                featured={true}
                onToggleExpanded={() => toggleExpanded(featuredTip.id)}
              />
            </section>
          ) : null}

          <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">My Active Tips</h3>
                  <p className="text-sm text-[#A1A1AA]">Tips you’ve locked in to follow.</p>
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
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-[#A1A1AA]">
                    No active tips yet. Mark a tip active when you decide to take it.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Available Live Tips</h3>
                  <p className="text-sm text-[#A1A1AA]">Only unsettled tips are shown here.</p>
                </div>
                <Badge tone="blue">{remainingAvailableTips.length} shown</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {remainingAvailableTips.length ? (
                  remainingAvailableTips.map((tip: any) => (
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
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-[#A1A1AA]">
                    No live tips match this filter right now.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <div className="grid gap-8 xl:grid-cols-2">
            <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / Races to Watch</h3>
                    <p className="text-sm text-[#A1A1AA]">
                      Forgive runs, follow angles, and runners worth keeping on side.
                    </p>
                  </div>
                  <Badge tone="amber">{watchlistItems.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {watchlistItems.length ? (
                    watchlistItems.map((item: any) => <WatchCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-[#A1A1AA]">
                      No watchlist items posted yet.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="border border-white/10 bg-[#111118] text-[#EAEAF0]">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Long-Term Bets</h3>
                    <p className="text-sm text-[#A1A1AA]">
                      Longer-range betting angles and futures worth tracking.
                    </p>
                  </div>
                  <Badge tone="rose">{longTermBets.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {longTermBets.length ? (
                    longTermBets.map((item: any) => <LongTermCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-[#A1A1AA]">
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
