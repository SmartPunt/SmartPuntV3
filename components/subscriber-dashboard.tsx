"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addUserBetAction,
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
  tip_angle: string | null;
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

type CalculatorTip = {
  id: number;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  race: string | null;
  horse: string | null;
  bet_type: string | null;
  confidence: string | null;
  score: number | string | null;
  win_percent: number | string | null;
  place_percent: number | string | null;
  race_gap: number | string | null;
  race_confidence_percent: number | string | null;
  race_confidence_tier: string | null;
  status: string | null;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  published_at: string | null;
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
  initialCalculatorTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialActiveTipIds,
initialActiveCalculatorTipIds,
initialActiveUserBetCount,
  initialPublishedRaces,
  initialPublishedRunners,
  initialHorses,
  initialMeetings,
}: {
  currentUser: any;
  initialSuggestedTips: SuggestedTip[];
  initialCalculatorTips: CalculatorTip[];
  initialWatchlistItems: WatchItem[];
  initialLongTermBets: LongTermBet[];
  initialActiveTipIds: number[];
initialActiveCalculatorTipIds: number[];
initialActiveUserBetCount: number;
  initialPublishedRaces: Race[];
  initialPublishedRunners: Runner[];
  initialHorses: Horse[];
  initialMeetings: Meeting[];
}) {
  const [customRaceId, setCustomRaceId] = useState("");
  const [customRunnerId, setCustomRunnerId] = useState("");
  const [customBetMessage, setCustomBetMessage] = useState("");
  const [customBetError, setCustomBetError] = useState("");
  const router = useRouter();
const [, startTransition] = useTransition();

  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);


  const activeCalculatorTipIdSet = useMemo(
  () => new Set(initialActiveCalculatorTipIds),
  [initialActiveCalculatorTipIds],
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
  const calculatorTips = useMemo(
  () =>
    initialCalculatorTips.filter((tip) => {
      if (tip.settled_at !== null) return false;

      if ((tip.status || "active") !== "active") return false;

      if (activeCalculatorTipIdSet.has(tip.id)) return false;

      if (!tip.race_runner_id) return true;

      const linkedRunner = runnerMap.get(tip.race_runner_id);

      if (!linkedRunner) return true;

      return linkedRunner.scratched !== true;
    }),
  [initialCalculatorTips, activeCalculatorTipIdSet, runnerMap],
);
const suggestedTips = useMemo(
  () =>
    allTips.filter((tip) => {
      if (tip.settled_at !== null) return false;

      if (!tip.race_runner_id) return true;

      const linkedRunner = runnerMap.get(tip.race_runner_id);

      if (!linkedRunner) return true;

      return linkedRunner.scratched !== true;
    }),
  [allTips, runnerMap],
);
  const horseMap = useMemo(
    () => new Map(initialHorses.map((horse) => [horse.id, horse])),
    [initialHorses],
  );

  const activeLiveTips = useMemo(
    () => suggestedTips.filter((tip) => activeTipIdSet.has(tip.id)),
    [suggestedTips, activeTipIdSet],
  );
const activeCalculatorTips = useMemo(
  () =>
    calculatorTips.filter((tip) =>
      activeCalculatorTipIdSet.has(tip.id),
    ),
  [calculatorTips, activeCalculatorTipIdSet],
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

async function addUserBetFormAction(formData: FormData) {
  const result = await addUserBetAction(formData);

  if (result?.success) {
    startTransition(() => {
      router.refresh();
    });
  }
}

  async function addCustomUserBetFormAction(formData: FormData) {
    setCustomBetMessage("");
    setCustomBetError("");

    const result = await addUserBetAction(formData);

    if (result.success) {
      setCustomRaceId("");
      setCustomRunnerId("");
      setCustomBetMessage("Added to My Bets.");
      return;
    }

    setCustomBetError(result.error || "Could not add this pick.");
  }

  function renderOddsInput(featured = false) {
    return (
      <label className={`text-xs font-semibold uppercase tracking-[0.12em] ${featured ? "text-amber-100/80" : "text-zinc-600"}`}>
        Odds taken
        <input
          type="number"
          name="odds_taken"
          min="1.01"
          step="0.01"
          required
          placeholder="e.g. 3.40"
          className={`mt-2 w-32 rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${
            featured
              ? "border-white/20 bg-white/10 text-white placeholder:text-white/45"
              : "border-zinc-300 bg-white text-zinc-950 placeholder:text-zinc-400"
          }`}
        />
      </label>
    );
  }

  function renderHeadTipperBetForm(tip: SuggestedTip, featured = false) {
    return (
      <form action={addUserBetFormAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="source" value="head_tipper" />
        <input type="hidden" name="suggested_tip_id" value={tip.id} />
        <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
        <input type="hidden" name="race_runner_id" value={tip.race_runner_id ?? ""} />
        <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
        <input type="hidden" name="horse" value={tip.horse} />
        <input type="hidden" name="race" value={tip.race} />
        <input type="hidden" name="bet_type" value={tip.type} />

        {renderOddsInput(featured)}

        <button
          className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            featured
              ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 text-black shadow-md hover:brightness-110"
              : "bg-black text-amber-300 hover:bg-zinc-900"
          }`}
        >
          Add To My Bets
        </button>
      </form>
    );
  }

  function renderCalculatorBetForm(tip: CalculatorTip) {
    return (
      <form action={addUserBetFormAction} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <input type="hidden" name="source" value="calculator" />
        <input type="hidden" name="calculator_tip_id" value={tip.id} />
        <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
        <input type="hidden" name="race_runner_id" value={tip.race_runner_id ?? ""} />
        <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
        <input type="hidden" name="horse" value={tip.horse || ""} />
        <input type="hidden" name="race" value={tip.race || ""} />
        <input type="hidden" name="bet_type" value={tip.bet_type || "Win"} />

        {renderOddsInput(false)}

        <button className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-black">
          Add Model Signal To My Bets
        </button>
      </form>
    );
  }

  function renderCustomBetBuilder() {
    const selectedRace = customRaceId
      ? initialPublishedRaces.find((race) => String(race.id) === customRaceId) || null
      : null;
    const selectedMeeting = selectedRace ? meetingMap.get(selectedRace.meeting_id) || null : null;
    const runners = selectedRace ? getRunnersForRace(selectedRace.id) : [];
    const selectedRunner = customRunnerId
      ? runners.find((runner) => String(runner.id) === customRunnerId) || null
      : null;
    const selectedHorse = selectedRunner ? horseMap.get(selectedRunner.horse_id) || null : null;

    return (
      <Panel className="bg-white/95">
        <div className="space-y-5 p-6 text-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Build my own pick</h2>
              <p className="text-sm text-zinc-500">
                Choose any horse from a current race, enter Win or Place, and record the odds you took.
              </p>
            </div>
            <Badge tone="slate">My Pick</Badge>
          </div>

          <form action={addCustomUserBetFormAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="source" value="subscriber" />
            <input
              type="hidden"
              name="race"
              value={selectedRace ? formatLinkedRaceLabel(selectedRace, selectedMeeting) || "Race" : "Race"}
            />

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Race</label>
              <select
                name="race_id"
                value={customRaceId}
                onChange={(event) => {
                  setCustomRaceId(event.target.value);
                  setCustomRunnerId("");
                }}
                required
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
              >
                <option value="">Choose race</option>
                {initialPublishedRaces.map((race) => {
                  const meeting = meetingMap.get(race.meeting_id) || null;
                  return (
                    <option key={race.id} value={race.id}>
                      {formatLinkedRaceLabel(race, meeting)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Horse</label>
              <select
                name="race_runner_id"
                value={customRunnerId}
                onChange={(event) => setCustomRunnerId(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
              >
                <option value="">Choose horse</option>
                {runners.map((runner) => {
                  const horse = horseMap.get(runner.horse_id);
                  return (
                    <option key={runner.id} value={runner.id}>
                      {horse?.horse_name || `Runner ${runner.id}`}
                    </option>
                  );
                })}
              </select>
            </div>

            <input type="hidden" name="horse_id" value={selectedHorse?.id ?? ""} />
            <input type="hidden" name="horse" value={selectedHorse?.horse_name || "Selected runner"} />

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Bet type</label>
              <select
                name="bet_type"
                required
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
              >
                <option value="Win">Win</option>
                <option value="Place">Place</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Odds taken</label>
              <input
                type="number"
                name="odds_taken"
                min="1.01"
                step="0.01"
                required
                placeholder="e.g. 4.20"
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 md:col-span-2 xl:col-span-4"
            >
              Add My Pick To My Bets
            </button>

            {customBetMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 md:col-span-2 xl:col-span-4">
                {customBetMessage}
              </div>
            ) : null}

            {customBetError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 md:col-span-2 xl:col-span-4">
                {customBetError}
              </div>
            ) : null}
          </form>
        </div>
      </Panel>
    );
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
          {tip.tip_angle ? <Badge tone="slate">{tip.tip_angle}</Badge> : null}
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

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="amber">Head Tipper</Badge>
            <Badge tone="slate">1 point stake</Badge>
          </div>

          {renderHeadTipperBetForm(tip, featured)}

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
                Remove legacy active marker
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  const displayName = currentUser.full_name || currentUser.email || "SmartPunt member";
  const latestHeadTipperPlays = availableTips.slice(0, 3);
  const latestCalculatorPlays = calculatorTips.slice(0, 3);
  const watchlistPreview = watchlistItems.slice(0, 3);
  const getOnEarlyPreview = longTermBets.slice(0, 3);
  const meetingPreview = upcomingPublishedRaces.slice(0, 5);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_30%),linear-gradient(180deg,#050505_0%,#0a0a0a_45%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-amber-300/20 bg-black/75 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_35px_rgba(245,158,11,0.28)]">
                <img src="/smartpunt-icon-512.png" alt="SmartPunt" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-300">SmartPunt</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Subscriber Dashboard</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/smartpunt-calculator-live-picks" className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-2.5 text-sm font-black text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110">
                Open Live Picks
              </Link>
              <form action={signOutAction}>
                <button className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-6">
          <section className="overflow-hidden rounded-[2.25rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.96),rgba(24,24,27,0.98),rgba(120,53,15,0.42))] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="relative p-6 sm:p-8 lg:p-10">
              <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.20),transparent_58%)] lg:block" />
              <div className="relative max-w-3xl">
                <Badge tone="amber">Premium Member</Badge>
                <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-amber-200/80">Welcome back, {displayName}</p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                  Your Racing <span className="text-amber-300">Command Centre</span>
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-200 sm:text-lg">
                  Live calculator picks, Head Tipper plays, your active bets, watchlist alerts and Get On Early angles — all in one premium SmartPunt hub.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/smartpunt-calculator-live-picks" className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-5 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/25 transition hover:brightness-110">
                    🏆 Open Live Picks
                  </Link>
                  <Link href="/my-active-tips" className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
                    My Active Tips
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/smartpunt-calculator-live-picks" className="group rounded-[1.75rem] border border-amber-300/25 bg-black/70 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-black/85">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Live Picks</p>
                  <p className="mt-3 text-4xl font-black text-white">{availableTips.length + calculatorTips.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Head Tipper + Calculator</p>
                </div>
                <span className="rounded-2xl bg-amber-400/15 px-3 py-2 text-2xl">◎</span>
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm font-bold text-amber-200 group-hover:text-amber-100">View Live Picks →</p>
            </Link>

            <Link href="/my-active-tips" className="group rounded-[1.75rem] border border-amber-300/25 bg-black/70 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-black/85">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">My Active Tips</p>
                  <p className="mt-3 text-4xl font-black text-white">{initialActiveUserBetCount}</p>
                  <p className="mt-2 text-sm text-zinc-400">Tips you’ve marked active</p>
                </div>
                <span className="rounded-2xl bg-amber-400/15 px-3 py-2 text-2xl">✓</span>
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm font-bold text-amber-200 group-hover:text-amber-100">View Active Tips →</p>
            </Link>

            <Link href="/my-resulted-tips" className="group rounded-[1.75rem] border border-amber-300/25 bg-black/70 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-black/85">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Resulted Tips</p>
                  <p className="mt-3 text-4xl font-black text-white">↗</p>
                  <p className="mt-2 text-sm text-zinc-400">Completed plays and results</p>
                </div>
                <span className="rounded-2xl bg-amber-400/15 px-3 py-2 text-2xl">🏆</span>
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm font-bold text-amber-200 group-hover:text-amber-100">View Results →</p>
            </Link>

            <Link href="/long-term-bets" className="group rounded-[1.75rem] border border-amber-300/25 bg-black/70 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-black/85">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Watchlist / Early</p>
                  <p className="mt-3 text-4xl font-black text-white">{watchlistItems.length + longTermBets.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Horses and early plays</p>
                </div>
                <span className="rounded-2xl bg-amber-400/15 px-3 py-2 text-2xl">☆</span>
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm font-bold text-amber-200 group-hover:text-amber-100">Open Get On Early →</p>
            </Link>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Panel className="border-amber-300/25 bg-black/72 text-white shadow-2xl shadow-black/30">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white">Latest Head Tipper Plays</h2>
                    <p className="mt-1 text-sm text-zinc-400">Fresh plays from the SmartPunt team.</p>
                  </div>
                  <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">View all</Link>
                </div>

                {latestHeadTipperPlays.length > 0 ? (
                  <div className="space-y-4">
                    {latestHeadTipperPlays.map((tip) => renderTipCard(tip))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-8 text-center">
                    <p className="text-lg font-black text-white">No Head Tipper plays live.</p>
                    <p className="mt-2 text-sm text-zinc-400">They’ll appear here as soon as they’re posted.</p>
                  </div>
                )}
              </div>
            </Panel>

            <Panel className="border-amber-300/25 bg-black/72 text-white shadow-2xl shadow-black/30">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white">Latest Calculator Plays</h2>
                    <p className="mt-1 text-sm text-zinc-400">Published SmartPunt model signals.</p>
                  </div>
                  <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">View all</Link>
                </div>

                {latestCalculatorPlays.length > 0 ? (
                  <div className="space-y-4">
                    {latestCalculatorPlays.map((tip, index) => (
                      <div key={tip.id} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 shadow-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-lg font-black text-black">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm text-zinc-400">{tip.race || "Race"}</p>
                              <h3 className="mt-1 text-xl font-black text-white">{tip.horse || "Unnamed horse"}</h3>
                            </div>
                          </div>
                          {tip.bet_type ? <TipPill type={tip.bet_type} /> : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {tip.score !== null && tip.score !== undefined ? <Badge tone="amber">Score {Math.round(Number(tip.score))}</Badge> : null}
                          {tip.win_percent !== null && tip.win_percent !== undefined ? <Badge tone="green">Win {Number(tip.win_percent)}%</Badge> : null}
                          {tip.place_percent !== null && tip.place_percent !== undefined ? <Badge tone="blue">Place {Number(tip.place_percent)}%</Badge> : null}
                          {tip.race_confidence_percent !== null && tip.race_confidence_percent !== undefined ? <Badge tone="slate">Race {Number(tip.race_confidence_percent)}%</Badge> : null}
                        </div>

                        {renderCalculatorBetForm(tip)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-8 text-center">
                    <p className="text-lg font-black text-white">No Calculator plays live.</p>
                    <p className="mt-2 text-sm text-zinc-400">Model signals will appear here once published.</p>
                  </div>
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <Panel className="border-amber-300/25 bg-black/72 text-white shadow-2xl shadow-black/30">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white">Watchlist Alerts</h2>
                    <p className="mt-1 text-sm text-zinc-400">Black book runners to keep an eye on.</p>
                  </div>
                  <Badge tone="blue">{watchlistItems.length}</Badge>
                </div>

                {watchlistPreview.length > 0 ? (
                  <div className="space-y-3">
                    {watchlistPreview.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-zinc-400">{item.race}</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <p className="font-black text-white">{item.horse}</p>
                          <TipPill type={item.label} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-zinc-400">No watchlist notes yet.</p>
                )}
              </div>
            </Panel>

            <Panel className="border-amber-300/25 bg-black/72 text-white shadow-2xl shadow-black/30">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white">Get On Early</h2>
                    <p className="mt-1 text-sm text-zinc-400">Longer-range plays worth noting.</p>
                  </div>
                  <Badge tone="rose">{longTermBets.length}</Badge>
                </div>

                {getOnEarlyPreview.length > 0 ? (
                  <div className="space-y-3">
                    {getOnEarlyPreview.map((bet) => (
                      <div key={bet.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-zinc-400">{bet.title}</p>
                        <p className="mt-1 font-black text-white">{bet.horse}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="amber">{bet.bet_type}</Badge>
                          {bet.odds ? <Badge tone="green">{bet.odds}</Badge> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-zinc-400">No Get On Early plays loaded.</p>
                )}
              </div>
            </Panel>

            <Panel className="border-amber-300/25 bg-black/72 text-white shadow-2xl shadow-black/30">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white">Upcoming Meetings</h2>
                    <p className="mt-1 text-sm text-zinc-400">Latest published race cards.</p>
                  </div>
                  <Badge tone="amber">{initialPublishedRaces.length}</Badge>
                </div>

                {meetingPreview.length > 0 ? (
                  <div className="space-y-3">
                    {meetingPreview.map((race) => {
                      const meeting = meetingMap.get(race.meeting_id) || null;
                      const runners = getRunnersForRace(race.id);

                      return (
                        <div key={race.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-white">{meeting?.meeting_name || "Meeting"}</p>
                              <p className="mt-1 text-sm text-zinc-400">R{race.race_number} · {race.distance_m || "—"}m</p>
                            </div>
                            <Badge tone="slate">{runners.length}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-zinc-400">No meetings published yet.</p>
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
            <div>{renderCustomBetBuilder()}</div>

            <Panel className="border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.92),rgba(24,24,27,0.95))] text-white shadow-2xl shadow-black/30">
              <div className="flex h-full flex-col justify-between gap-6 p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-amber-300">SmartPunt Edge</p>
                  <h2 className="mt-3 text-2xl font-black text-white">Premium racing intelligence</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Powered by race intelligence, data and performance review. Live picks are now your front door; this dashboard is your personal command centre.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/current-races" className="rounded-2xl border border-amber-300/30 px-4 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-300/10">
                    Current Races
                  </Link>
                  <Link href="/race-archive" className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
                    Race Archive
                  </Link>
                  <Link href="/fortune-on-5" className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
                    Fortune on 5
                  </Link>
                </div>
              </div>
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}
