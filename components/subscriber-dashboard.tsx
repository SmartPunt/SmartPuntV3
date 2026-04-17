"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  markTipActiveAction,
  removeTipActiveAction,
  signOutAction,
} from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  scratched?: boolean | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
};

type SuggestedTip = {
  id: number;
  meeting_id: number | null;
  race_id: number | null;
  horse_id: number | null;
  race_runner_id: number | null;
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string | null;
  commentary: string | null;
  result_comment: string | null;
  race_start_at: string | null;
  race_timezone: string | null;
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
};

type WatchItem = {
  id: number;
  race: string;
  horse: string;
  label: string;
  commentary: string | null;
  created_at: string;
  updated_at: string;
};

type LongTermBet = {
  id: number;
  title: string;
  horse: string;
  meeting: string | null;
  race_number: number | null;
  race_start_at: string | null;
  race_timezone: string | null;
  bet_type: string;
  odds: string;
  commentary: string | null;
  created_at: string;
  updated_at: string;
};

function formatRaceDateTime(value?: string | null, timezone?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone || "Australia/Perth",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

function formatMeetingDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getTipCardStyle(type: string) {
  if (type === "Win") return "border-emerald-300/40 bg-emerald-50";
  if (type === "Place") return "border-sky-300/40 bg-sky-50";
  if (type === "All Up") return "border-pink-300/40 bg-pink-50";
  return "border-zinc-200 bg-white";
}

function formatLinkedRaceLabel(race: Race | null, meeting: Meeting | null) {
  if (!race) return null;
  return `${meeting?.meeting_name || "Meeting"} R${race.race_number} ${race.race_name}`;
}

export default function SubscriberDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
  initialPublishedRaces,
  initialPublishedRunners,
  initialHorses,
  initialMeetings,
}: {
  currentUser: any;
  initialSuggestedTips: SuggestedTip[];
  initialWatchlistItems: WatchItem[];
  initialLongTermBets: LongTermBet[];
  initialActiveTipIds: number[];
  initialPublishedRaces: Race[];
  initialPublishedRunners: Runner[];
  initialHorses: Horse[];
  initialMeetings: Meeting[];
}) {
  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);

  const suggestedTips = useMemo(
    () => allTips.filter((tip) => tip.settled_at === null),
    [allTips],
  );

  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const activeTipIdSet = useMemo(() => new Set(initialActiveTipIds), [initialActiveTipIds]);

  const meetingMap = useMemo(
    () => new Map(initialMeetings.map((meeting) => [meeting.id, meeting])),
    [initialMeetings],
  );

  const raceMap = useMemo(
    () => new Map(initialPublishedRaces.map((race) => [race.id, race])),
    [initialPublishedRaces],
  );

  const runnerMap = useMemo(
    () => new Map(initialPublishedRunners.map((runner) => [runner.id, runner])),
    [initialPublishedRunners],
  );

  const horseMap = useMemo(
    () => new Map(initialHorses.map((horse) => [horse.id, horse])),
    [initialHorses],
  );

  const activeLiveTips = useMemo(
    () => suggestedTips.filter((tip) => activeTipIdSet.has(tip.id)),
    [suggestedTips, activeTipIdSet],
  );

  const availableTips = useMemo(
    () => suggestedTips.filter((tip) => !activeTipIdSet.has(tip.id)),
    [suggestedTips, activeTipIdSet],
  );

  const featuredTip = availableTips[0] || null;
  const liveBoardTips = availableTips.slice(1);

  const upcomingPublishedRaces = useMemo(() => {
    return [...initialPublishedRaces]
      .sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [initialPublishedRaces]);

  function getLinkedRunner(tip: SuggestedTip) {
    if (!tip.race_runner_id) return null;
    return runnerMap.get(tip.race_runner_id) || null;
  }

  function getLinkedRace(tip: SuggestedTip) {
    if (!tip.race_id) return null;
    return raceMap.get(tip.race_id) || null;
  }

  function getLinkedMeeting(tip: SuggestedTip) {
    if (!tip.meeting_id) return null;
    return meetingMap.get(tip.meeting_id) || null;
  }

  function getLinkedHorse(tip: SuggestedTip) {
    if (!tip.horse_id) return null;
    return horseMap.get(tip.horse_id) || null;
  }

  function getTipsForRace(raceId: number) {
    return availableTips.filter((tip) => tip.race_id === raceId);
  }

  function getRunnersForRace(raceId: number) {
    return initialPublishedRunners.filter((runner) => runner.race_id === raceId);
  }

  function renderLinkedRaceBadges(tip: SuggestedTip) {
    const runner = getLinkedRunner(tip);
    const badges: React.ReactNode[] = [];

    if (!runner) return null;

    if (runner.barrier !== null && runner.barrier !== undefined) {
      badges.push(
        <Badge key="barrier" tone="blue">
          Barrier {runner.barrier}
        </Badge>,
      );
    }

    if (runner.market_price !== null && runner.market_price !== undefined) {
      badges.push(
        <Badge key="price" tone="green">
          ${runner.market_price}
        </Badge>,
      );
    }

    if (runner.weight_kg !== null && runner.weight_kg !== undefined) {
      badges.push(
        <Badge key="weight" tone="amber">
          {runner.weight_kg}kg
        </Badge>,
      );
    }

    if (runner.form_last_6) {
      badges.push(
        <Badge key="form" tone="slate">
          {runner.form_last_6}
        </Badge>,
      );
    }

    return badges.length ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null;
  }

  function renderTipCard(tip: SuggestedTip, featured = false) {
    const linkedRace = getLinkedRace(tip);
    const linkedMeeting = getLinkedMeeting(tip);
    const linkedHorse = getLinkedHorse(tip);
    const linkedRaceLabel = formatLinkedRaceLabel(linkedRace, linkedMeeting);
    const raceDateTime = formatRaceDateTime(tip.race_start_at, tip.race_timezone);
    const isActive = activeTipIdSet.has(tip.id);

    return (
      <div
        key={tip.id}
        className={`rounded-[28px] border p-5 shadow-sm ${
          featured
            ? "border-amber-300/40 bg-[linear-gradient(135deg,rgba(17,17,17,1),rgba(39,39,42,0.98),rgba(202,138,4,0.22))] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            : getTipCardStyle(tip.type)
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-sm ${featured ? "text-amber-100/75" : "text-zinc-500"}`}>
              {tip.race}
            </p>
            <h3
              className={`mt-1 font-bold ${
                featured ? "text-3xl text-white" : "text-xl text-zinc-950"
              }`}
            >
              {tip.horse}
            </h3>

            {linkedRaceLabel ? (
              <p
                className={`mt-2 text-sm font-medium ${
                  featured ? "text-amber-100/85" : "text-zinc-700"
                }`}
              >
                Linked field: {linkedRaceLabel}
              </p>
            ) : null}

            {linkedHorse?.sex || linkedHorse?.age ? (
              <p className={`mt-1 text-sm ${featured ? "text-amber-100/70" : "text-zinc-500"}`}>
                {[linkedHorse.sex, linkedHorse.age ? `${linkedHorse.age}yo` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          <TipPill type={tip.type} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
          {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
          {raceDateTime ? <Badge tone="slate">{raceDateTime}</Badge> : null}
          {tip.race_runner_id ? <Badge tone="green">Linked runner</Badge> : null}
          {featured ? <Badge tone="amber">Best on board</Badge> : null}
        </div>

        {renderLinkedRaceBadges(tip)}

        {tip.commentary ? (
          <p className={`mt-4 text-sm leading-7 ${featured ? "text-zinc-100" : "text-zinc-700"}`}>
            {tip.commentary}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {isActive ? (
            <form action={removeTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  featured
                    ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Remove from My Active Tips
              </button>
            </form>
          ) : (
            <form action={markTipActiveAction}>
              <input type="hidden" name="tip_id" value={tip.id} />
              <button
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  featured
                    ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 text-black shadow-md hover:brightness-110"
                    : "bg-black text-amber-300 hover:bg-zinc-900"
                }`}
              >
                Mark as Active
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-black/80 p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Badge tone="amber">Premium Member</Badge>
              </div>

              <div className="mt-4">
                <p className="text-lg font-bold text-white">
                  {currentUser.full_name || currentUser.email}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  SmartPunt subscriber dashboard
                </p>
              </div>

              <div className="mt-6 space-y-2">
                <Link
                  href="/current-races"
                  className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Current Races
                </Link>
                <Link
                  href="/my-active-tips"
                  className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  My Active Tips
                </Link>
                <Link
                  href="/my-resulted-tips"
                  className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  My Resulted Tips
                </Link>
                <Link
                  href="/race-archive"
                  className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Race Archive
                </Link>
                <Link
                  href="/long-term-bets"
                  className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Get On Early
                </Link>
                <form action={signOutAction}>
                  <button className="w-full rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15">
                    Log out
                  </button>
                </form>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Live Tips
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{availableTips.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Active Tips
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{activeLiveTips.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Published Races
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{initialPublishedRaces.length}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
              <img
                src="/header-logo.png"
                alt="Fortune on 5"
                className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

              <div className="relative z-10 flex min-h-[220px] flex-col justify-end p-4 lg:min-h-[280px] lg:p-8">
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                      Fortune on 5 premium race tips
                    </h1>
                    <p className="text-sm text-zinc-200 lg:text-base">
                      Sharp tips, live races, and your own punting lane in one spot.
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="green">{availableTips.length} live tips</Badge>
                    <Badge tone="blue">{watchlistItems.length} watchlist notes</Badge>
                    <Badge tone="amber">{longTermBets.length} get on early</Badge>
                    <Badge tone="rose">{activeLiveTips.length} active tips</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Live tips
                  </p>
                  <p className="mt-2 text-3xl font-bold">{availableTips.length}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Current SmartPunt plays ready to follow.
                  </p>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    My active tips
                  </p>
                  <p className="mt-2 text-3xl font-bold">{activeLiveTips.length}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Tips you’ve accepted and moved off the live board.
                  </p>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Linked race fields
                  </p>
                  <p className="mt-2 text-3xl font-bold">
                    {availableTips.filter((tip) => tip.race_runner_id).length}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Tips tied directly to actual runners and race fields.
                  </p>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Published races
                  </p>
                  <p className="mt-2 text-3xl font-bold">{initialPublishedRaces.length}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Race-day board now connected to the dashboard.
                  </p>
                </div>
              </Panel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Featured play</h2>
                      <p className="text-sm text-zinc-500">
                        The headliner on the board right now.
                      </p>
                    </div>
                    <Badge tone="amber">Top shelf</Badge>
                  </div>

                  {featuredTip ? (
                    renderTipCard(featuredTip, true)
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                      <p className="text-lg font-semibold text-zinc-900">No live tips just yet.</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Once the head tipper posts one, it’ll land here.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">My punting lane</h2>
                      <p className="text-sm text-zinc-500">
                        Your active plays and quick links in one tidy strip.
                      </p>
                    </div>
                    <Badge tone="rose">{activeLiveTips.length}</Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-amber-200/30 bg-zinc-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Active tips
                      </p>
                      <p className="mt-2 text-3xl font-bold text-zinc-950">{activeLiveTips.length}</p>
                      <p className="mt-2 text-sm text-zinc-600">
                        Accepted tips move off the live board and into your own page.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href="/my-active-tips"
                          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                        >
                          Open My Active Tips
                        </Link>
                        <Link
                          href="/my-resulted-tips"
                          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          View My Resulted Tips
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-950">Watchlist</h3>
                          <p className="text-sm text-zinc-500">
                            Horses and races worth keeping in the black book.
                          </p>
                        </div>
                        <Badge tone="blue">{watchlistItems.length}</Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {watchlistItems.length > 0 ? (
                          watchlistItems.slice(0, 2).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-zinc-500">{item.race}</p>
                                  <p className="mt-1 text-base font-semibold text-zinc-950">
                                    {item.horse}
                                  </p>
                                </div>
                                <TipPill type={item.label} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-zinc-500">No watchlist notes yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            <div>
              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Today’s live races</h2>
                      <p className="text-sm text-zinc-500">
                        Quick race-day view tied directly into your published race board.
                      </p>
                    </div>
                    <Link
                      href="/current-races"
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Open Current Races
                    </Link>
                  </div>

                  {upcomingPublishedRaces.length > 0 ? (
                    <div className="grid gap-5 lg:grid-cols-3">
                      {upcomingPublishedRaces.map((race) => {
                        const meeting = meetingMap.get(race.meeting_id) || null;
                        const raceTips = getTipsForRace(race.id);
                        const runners = getRunnersForRace(race.id);
                        const topTip = raceTips[0] || null;

                        return (
                          <div
                            key={race.id}
                            className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-zinc-500">
                                  {meeting?.meeting_name || "Meeting"}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-zinc-950">
                                  R{race.race_number} {race.race_name}
                                </p>
                              </div>
                              <Badge tone="amber">{race.distance_m || "—"}m</Badge>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {meeting?.track_condition ? (
                                <Badge tone="blue">{meeting.track_condition}</Badge>
                              ) : null}
                              {formatMeetingDate(meeting?.meeting_date) ? (
                                <Badge tone="slate">{formatMeetingDate(meeting?.meeting_date)}</Badge>
                              ) : null}
                              <Badge tone="green">{runners.length} runners</Badge>
                            </div>

                            {topTip ? (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                  Top linked tip
                                </p>
                                <p className="mt-2 text-base font-semibold text-zinc-950">
                                  {topTip.horse}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge tone="green">{topTip.type}</Badge>
                                  {topTip.confidence ? (
                                    <Badge tone="blue">{topTip.confidence}</Badge>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-sm text-zinc-600">
                                  No linked live tip on this race yet.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                      <p className="text-lg font-semibold text-zinc-900">No published races yet.</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Once races are published, they’ll appear here for a quick race-day scan.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div>
              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Live board</h2>
                      <p className="text-sm text-zinc-500">
                        Every current SmartPunt play in one spot, excluding the featured headliner.
                      </p>
                    </div>
                    <Badge tone="green">{liveBoardTips.length}</Badge>
                  </div>

                  {liveBoardTips.length > 0 ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      {liveBoardTips.map((tip) => renderTipCard(tip))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                      <p className="text-lg font-semibold text-zinc-900">
                        No additional live tips on the board right now.
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Accepted tips move to My Active Tips until they result.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div>
              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Get On Early</h2>
                      <p className="text-sm text-zinc-500">
                        Futures and longer-range angles worth locking in early.
                      </p>
                    </div>
                    <Badge tone="rose">{longTermBets.length}</Badge>
                  </div>

                  {longTermBets.length > 0 ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      {longTermBets.map((bet) => {
                        const raceDateTime = formatRaceDateTime(bet.race_start_at, bet.race_timezone);

                        return (
                          <div
                            key={bet.id}
                            className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-zinc-500">{bet.title}</p>
                                <p className="mt-1 text-xl font-semibold text-zinc-950">{bet.horse}</p>
                              </div>
                              <TipPill type="Get On Early" />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge tone="amber">{bet.bet_type}</Badge>
                              {bet.odds ? <Badge tone="green">{bet.odds}</Badge> : null}
                              {bet.meeting ? <Badge tone="blue">{bet.meeting}</Badge> : null}
                              {bet.race_number ? <Badge tone="slate">R{bet.race_number}</Badge> : null}
                              {raceDateTime ? <Badge tone="slate">{raceDateTime}</Badge> : null}
                            </div>

                            {bet.commentary ? (
                              <p className="mt-4 text-sm leading-7 text-zinc-700">
                                {bet.commentary}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No get on early bets loaded yet.</p>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
