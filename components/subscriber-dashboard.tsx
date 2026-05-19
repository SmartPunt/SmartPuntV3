"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);

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
  const activeCalculatorTipIdSet = useMemo(
  () => new Set(initialActiveCalculatorTipIds),
  [initialActiveCalculatorTipIds],
);
const calculatorTips = useMemo(
  () =>
    initialCalculatorTips.filter(
      (tip) =>
        tip.settled_at === null &&
        (tip.status || "active") === "active" &&
        !activeCalculatorTipIdSet.has(tip.id),
    ),
  [initialCalculatorTips, activeCalculatorTipIdSet],
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
    await addUserBetAction(formData);
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
<p className="mt-2 text-2xl font-bold text-white">
  {initialActiveUserBetCount}
</p>
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
                    <Badge tone="green">{availableTips.length} head tipper tips</Badge>
                    <Badge tone="blue">{calculatorTips.length} calculator signals</Badge>
                    <Badge tone="blue">{watchlistItems.length} watchlist notes</Badge>
                    <Badge tone="amber">{longTermBets.length} get on early</Badge>
<Badge tone="rose">
  {initialActiveUserBetCount} active tips
</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
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
                    Calculator signals
                  </p>
                  <p className="mt-2 text-3xl font-bold">{calculatorTips.length}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Model-rated plays separate from the Head Tipper.
                  </p>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    My active tips
                  </p>
<p className="mt-2 text-3xl font-bold">
  {initialActiveUserBetCount}
</p>
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
<Badge tone="rose">
  {initialActiveUserBetCount}
</Badge>
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
                      <h2 className="text-xl font-semibold">SmartPunt Calculator signals</h2>
                      <p className="text-sm text-zinc-500">
                        Model-rated opportunities published separately from Head Tipper selections.
                      </p>
                    </div>
                    <Badge tone="blue">Model Signal</Badge>
                  </div>

                  {calculatorTips.length > 0 ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      {calculatorTips.map((tip) => (
                        <div
                          key={tip.id}
                          className="rounded-[24px] border border-sky-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-sky-200/80">{tip.race || "Race"}</p>
                              <h3 className="mt-1 text-2xl font-bold text-white">
                                {tip.horse || "Unnamed horse"}
                              </h3>
                            </div>
                            <Badge tone="blue">Calculator</Badge>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {tip.bet_type ? <Badge tone="green">{tip.bet_type}</Badge> : null}
                            {tip.score !== null && tip.score !== undefined ? (
                              <Badge tone="amber">Score {Math.round(Number(tip.score))}</Badge>
                            ) : null}
                            {tip.win_percent !== null && tip.win_percent !== undefined ? (
                              <Badge tone="green">Win {Number(tip.win_percent)}%</Badge>
                            ) : null}
                            {tip.place_percent !== null && tip.place_percent !== undefined ? (
                              <Badge tone="blue">Place {Number(tip.place_percent)}%</Badge>
                            ) : null}
                            {tip.race_confidence_percent !== null && tip.race_confidence_percent !== undefined ? (
                              <Badge tone="slate">Race confidence {Number(tip.race_confidence_percent)}%</Badge>
                            ) : null}
                          </div>

                          <p className="mt-4 text-sm leading-6 text-slate-200">
                            This is a SmartPunt Calculator signal. It is tracked separately from Head Tipper selections.
                          </p>

                          {renderCalculatorBetForm(tip)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                      <p className="text-lg font-semibold text-zinc-900">No calculator signals published yet.</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Once the model publishes a play, it’ll appear here as a separate channel.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div>{renderCustomBetBuilder()}</div>

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
