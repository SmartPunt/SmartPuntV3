"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addUserBetAction, signOutAction } from "@/lib/actions";
import { TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";
import { getSubscriberCalculatorPlays } from "@/lib/calculator/subscriber-calculator-plays";

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
  runner_number?: number | null;
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
  runner_number?: number | null;
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
  runner_number?: number | null;
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
  calculator_tip_id?: number | null;
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

type ResultedUserBet = {
  id: number;
  won: boolean | null;
  placed: boolean | null;
  bet_type: string | null;
  settled_at: string | null;
};

type LiveFortuneFive = {
  id: number;
  title: string;
  description: string | null;
  published_date: string;
  status: string;
  settled_at: string | null;
};

function getPerthDate(offsetDays = 0) {
  const perthNow = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Australia/Perth",
    }),
  );

  perthNow.setDate(perthNow.getDate() + offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(perthNow);
}

function getDateOnlyInTimezone(value?: string | null, timezone = "Australia/Perth") {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return null;
  }
}

function formatRaceTime(value?: string | null, timezone?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone || "Australia/Perth",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

function confidenceRank(value?: string | null) {
  const confidence = String(value || "").toLowerCase();

  if (confidence.includes("high")) return 3;
  if (confidence.includes("medium")) return 2;
  if (confidence.includes("low")) return 1;

  return 0;
}

function tipHref(raceId?: number | null) {
  return raceId
    ? `/smartpunt-calculator-live-picks?raceId=${raceId}`
    : "/smartpunt-calculator-live-picks";
}

function smallPill(children: React.ReactNode, tone: "gold" | "green" | "blue" | "dark" = "dark") {
  const classes = {
    gold: "border-amber-300/40 bg-amber-300/12 text-amber-200",
    green: "border-emerald-300/35 bg-emerald-400/10 text-emerald-200",
    blue: "border-sky-300/35 bg-sky-400/10 text-sky-200",
    dark: "border-white/10 bg-white/5 text-zinc-300",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes[tone]}`}>
      {children}
    </span>
  );
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
  initialActiveCalculatorRunnerIds = [],
  initialActiveUserBetCount,
  initialPublishedRaces,
  initialPublishedRunners,
  initialScoringRaces = [],
  initialScoringRunners = [],
  initialHorses,
  initialMeetings,
  initialJockeyProfiles = [],
  initialResultedUserBets = [],
  initialLiveFortuneFives = [],
}: {
  currentUser: any;
  initialSuggestedTips: SuggestedTip[];
  initialCalculatorTips: CalculatorTip[];
  initialWatchlistItems: WatchItem[];
  initialLongTermBets: LongTermBet[];
  initialActiveTipIds: number[];
  initialActiveCalculatorTipIds: number[];
  initialActiveCalculatorRunnerIds?: number[];
  initialActiveUserBetCount: number;
  initialPublishedRaces: Race[];
  initialPublishedRunners: Runner[];
  initialScoringRaces?: Race[];
  initialScoringRunners?: Runner[];
  initialHorses: Horse[];
  initialMeetings: Meeting[];
  initialJockeyProfiles?: any[];
  initialResultedUserBets?: ResultedUserBet[];
  initialLiveFortuneFives?: LiveFortuneFive[];
}) {
  const [customRaceId, setCustomRaceId] = useState("");
  const [customRunnerId, setCustomRunnerId] = useState("");
  const [customBetMessage, setCustomBetMessage] = useState("");
  const [customBetError, setCustomBetError] = useState("");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const today = getPerthDate(0);

  const meetingMap = useMemo(
    () => new Map(initialMeetings.map((meeting) => [Number(meeting.id), meeting])),
    [initialMeetings],
  );

  const raceMap = useMemo(
    () => new Map(initialPublishedRaces.map((race) => [Number(race.id), race])),
    [initialPublishedRaces],
  );

  const runnerMap = useMemo(
    () => new Map(initialPublishedRunners.map((runner) => [Number(runner.id), runner])),
    [initialPublishedRunners],
  );

  const horseMap = useMemo(
    () => new Map(initialHorses.map((horse) => [Number(horse.id), horse])),
    [initialHorses],
  );

  const activeTipIdSet = useMemo(() => new Set(initialActiveTipIds), [initialActiveTipIds]);
  const activeCalculatorTipIdSet = useMemo(
    () => new Set(initialActiveCalculatorTipIds),
    [initialActiveCalculatorTipIds],
  );

  const activeCalculatorRunnerIdSet = useMemo(
    () => new Set(initialActiveCalculatorRunnerIds.map((id) => Number(id)).filter(Boolean)),
    [initialActiveCalculatorRunnerIds],
  );

  const todayRaces = useMemo(
    () =>
      initialPublishedRaces
        .filter((race) => {
          const meeting = meetingMap.get(Number(race.meeting_id));
          return meeting?.meeting_date === today;
        })
        .sort((a, b) => {
          const meetingA = meetingMap.get(Number(a.meeting_id))?.meeting_name || "";
          const meetingB = meetingMap.get(Number(b.meeting_id))?.meeting_name || "";
          const meetingSort = meetingA.localeCompare(meetingB);
          if (meetingSort !== 0) return meetingSort;
          return Number(a.race_number || 0) - Number(b.race_number || 0);
        }),
    [initialPublishedRaces, meetingMap, today],
  );

  const allTodaySuggestedTips = useMemo(
    () =>
      allTips.filter((tip) => {
        if (tip.settled_at !== null) return false;

        if (tip.race_start_at) {
          const tipDate = getDateOnlyInTimezone(tip.race_start_at, tip.race_timezone || "Australia/Perth");
          if (tipDate && tipDate !== today) return false;
        }

        if (tip.race_id) {
          const race = raceMap.get(Number(tip.race_id));
          const meeting = race ? meetingMap.get(Number(race.meeting_id)) : null;
          if (meeting?.meeting_date && meeting.meeting_date !== today) return false;
        }

        if (!tip.race_runner_id) return true;

        const linkedRunner = runnerMap.get(Number(tip.race_runner_id));

        if (!linkedRunner) return true;

        return linkedRunner.scratched !== true;
      }),
    [allTips, meetingMap, raceMap, runnerMap, today],
  );

  const suggestedTips = useMemo(
    () =>
      allTips.filter((tip) => {
        if (tip.settled_at !== null) return false;

        if (activeTipIdSet.has(tip.id)) return false;

        if (tip.race_start_at) {
          const tipDate = getDateOnlyInTimezone(tip.race_start_at, tip.race_timezone || "Australia/Perth");
          if (tipDate && tipDate !== today) return false;
        }

        if (tip.race_id) {
          const race = raceMap.get(Number(tip.race_id));
          const meeting = race ? meetingMap.get(Number(race.meeting_id)) : null;
          if (meeting?.meeting_date && meeting.meeting_date !== today) return false;
        }

        if (!tip.race_runner_id) return true;

        const linkedRunner = runnerMap.get(Number(tip.race_runner_id));

        if (!linkedRunner) return true;

        return linkedRunner.scratched !== true;
      }),
    [activeTipIdSet, allTips, meetingMap, raceMap, runnerMap, today],
  );

  const allCalculatorTips = useMemo(
    () =>
      getSubscriberCalculatorPlays({
        races: todayRaces,
        scoringRaces: initialScoringRaces.length
          ? initialScoringRaces
          : initialPublishedRaces,
        runners: initialPublishedRunners,
        scoringRunners: initialScoringRunners.length
          ? initialScoringRunners
          : initialPublishedRunners,
        horses: initialHorses,
        meetings: initialMeetings,
        jockeyProfiles: initialJockeyProfiles,
      }).filter((tip) => {
        if (!tip.race_runner_id) return true;

        const linkedRunner = runnerMap.get(Number(tip.race_runner_id));
        if (!linkedRunner) return true;

        return linkedRunner.scratched !== true;
      }),
    [
      todayRaces,
      initialPublishedRaces,
      initialPublishedRunners,
      initialScoringRaces,
      initialScoringRunners,
      initialHorses,
      initialMeetings,
      initialJockeyProfiles,
      runnerMap,
    ],
  );

  const calculatorTips = useMemo(
    () =>
      allCalculatorTips.filter((tip) => {
        if (
          tip.race_runner_id &&
          activeCalculatorRunnerIdSet.has(Number(tip.race_runner_id))
        ) {
          return false;
        }

        return true;
      }),
    [activeCalculatorRunnerIdSet, allCalculatorTips],
  );

  const topHeadTipperPlays = useMemo(
    () =>
      [...suggestedTips]
        .sort((a, b) => {
          const confidenceGap = confidenceRank(b.confidence) - confidenceRank(a.confidence);
          if (confidenceGap !== 0) return confidenceGap;

          const aTime = a.race_start_at ? new Date(a.race_start_at).getTime() : 0;
          const bTime = b.race_start_at ? new Date(b.race_start_at).getTime() : 0;
          return aTime - bTime;
        })
        .map((tip) => {
  const runner = tip.race_runner_id
    ? runnerMap.get(Number(tip.race_runner_id))
    : null;

  return {
    ...tip,
    runner_number: runner?.runner_number ?? null,
  };
})
.slice(0, 3),
[suggestedTips, runnerMap],
  );

  const topCalculatorPlays = useMemo(
    () =>
      [...calculatorTips]
        .sort((a, b) => {
          const aStrength =
            Number(a.race_confidence_percent || 0) * 2 +
            Number(a.score || 0) +
            Number(a.place_percent || 0) +
            Number(a.win_percent || 0);

          const bStrength =
            Number(b.race_confidence_percent || 0) * 2 +
            Number(b.score || 0) +
            Number(b.place_percent || 0) +
            Number(b.win_percent || 0);

          return bStrength - aStrength;
        })
        .map((tip) => {
  const runner = tip.race_runner_id
    ? runnerMap.get(Number(tip.race_runner_id))
    : null;

  return {
    ...tip,
    runner_number: runner?.runner_number ?? null,
  };
})
.slice(0, 3),
[calculatorTips, runnerMap],
  );

  const meetingSummary = useMemo(() => {
    const byMeeting = new Map<number, { meeting: Meeting; raceCount: number }>();

    todayRaces.forEach((race) => {
      const meeting = meetingMap.get(Number(race.meeting_id));
      if (!meeting) return;

      const existing = byMeeting.get(Number(meeting.id));
      if (existing) {
        existing.raceCount += 1;
      } else {
        byMeeting.set(Number(meeting.id), { meeting, raceCount: 1 });
      }
    });

    return Array.from(byMeeting.values()).sort((a, b) =>
      a.meeting.meeting_name.localeCompare(b.meeting.meeting_name),
    );
  }, [meetingMap, todayRaces]);

  const activeSuccessCount = initialResultedUserBets.filter((bet) => {
    const betType = String(bet.bet_type || "").toLowerCase();

    if (betType.includes("place")) return bet.placed === true;
    return bet.won === true;
  }).length;

  const resultedTotal = initialResultedUserBets.length;
  const strikeRate = resultedTotal
    ? Math.round((activeSuccessCount / resultedTotal) * 100)
    : 0;

  const livePicksCount = allTodaySuggestedTips.length + allCalculatorTips.length;
  const watchEarlyCount = watchlistItems.length + longTermBets.length;
  const displayName = currentUser.full_name || currentUser.email || "SmartPunt member";

  function getRunnersForRace(raceId: number) {
    return initialPublishedRunners.filter((runner) => Number(runner.race_id) === Number(raceId));
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

  function renderOddsInput(dark = true) {
    return (
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
        Odds taken
        <input
          type="number"
          name="odds_taken"
          min="1.01"
          step="0.01"
          required
          placeholder="e.g. 3.40"
          className={`mt-2 w-28 rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${
            dark
              ? "border-white/15 bg-white/8 text-white placeholder:text-zinc-500"
              : "border-zinc-300 bg-white text-zinc-950 placeholder:text-zinc-400"
          }`}
        />
      </label>
    );
  }

function renderHeadTipperBetForm(tip: SuggestedTip) {
  return (
    <form action={addUserBetFormAction} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="source" value="head_tipper" />
      <input type="hidden" name="suggested_tip_id" value={tip.id} />
      <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
      <input type="hidden" name="race_runner_id" value={tip.race_runner_id ?? ""} />
      <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
      <input type="hidden" name="horse" value={tip.horse} />
      <input type="hidden" name="race" value={tip.race} />
      <input type="hidden" name="bet_type" value={tip.type} />

      {renderOddsInput(true)}

      <button className="rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-3 py-2 text-xs font-black text-black shadow-md shadow-amber-500/20 transition hover:brightness-110">
        Add
      </button>
    </form>
  );
}

  function renderCalculatorBetForm(tip: CalculatorTip) {
    return (
      <form action={addUserBetFormAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="source" value="calculator" />
        <input
          type="hidden"
          name="calculator_tip_id"
          value={tip.calculator_tip_id ?? ""}
        />
        <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
        <input type="hidden" name="race_runner_id" value={tip.race_runner_id ?? ""} />
        <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
        <input type="hidden" name="horse" value={tip.horse || ""} />
        <input type="hidden" name="race" value={tip.race || ""} />
        <input type="hidden" name="bet_type" value={tip.bet_type || "Win"} />

        {renderOddsInput(true)}

        <button className="rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-3 py-2 text-xs font-black text-black shadow-md shadow-amber-500/20 transition hover:brightness-110">
          Add
        </button>
      </form>
    );
  }

  function renderCustomBetBuilder() {
    const selectedRace = customRaceId
      ? todayRaces.find((race) => String(race.id) === customRaceId) || null
      : null;
    const selectedMeeting = selectedRace ? meetingMap.get(Number(selectedRace.meeting_id)) || null : null;
    const runners = selectedRace ? getRunnersForRace(selectedRace.id) : [];
    const selectedRunner = customRunnerId
      ? runners.find((runner) => String(runner.id) === customRunnerId) || null
      : null;
    const selectedHorse = selectedRunner ? horseMap.get(Number(selectedRunner.horse_id)) || null : null;

    return (
      <section className="rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(145deg,rgba(0,0,0,0.9),rgba(24,24,27,0.88))] p-5 text-white shadow-2xl shadow-black/40 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">My Pick Builder</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Build My Own Pick</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Choose any horse from today’s current races, enter Win or Place, and record the odds you took.
            </p>
          </div>
          {smallPill(`${todayRaces.length} races`, "gold")}
        </div>

        <form action={addCustomUserBetFormAction} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="source" value="subscriber" />
          <input
            type="hidden"
            name="race"
            value={selectedRace ? formatLinkedRaceLabel(selectedRace, selectedMeeting) || "Race" : "Race"}
          />

          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Race
            <select
              name="race_id"
              value={customRaceId}
              onChange={(event) => {
                setCustomRaceId(event.target.value);
                setCustomRunnerId("");
              }}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
            >
              <option value="">Choose race</option>
              {todayRaces.map((race) => {
                const meeting = meetingMap.get(Number(race.meeting_id)) || null;
                return (
                  <option key={race.id} value={race.id} className="bg-black text-white">
{meeting?.meeting_name || "Meeting"} • Race {race.race_number}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Horse
            <select
              name="race_runner_id"
              value={customRunnerId}
              onChange={(event) => setCustomRunnerId(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
            >
              <option value="">Choose horse</option>
              {runners
                .filter((runner) => runner.scratched !== true)
                .map((runner) => {
                  const horse = horseMap.get(Number(runner.horse_id));
                  return (
                    <option key={runner.id} value={runner.id} className="bg-black text-white">
{runner.runner_number ? `[${runner.runner_number}] ` : ""}
{horse?.horse_name || `Runner ${runner.id}`}
                    </option>
                  );
                })}
            </select>
          </label>

          <input type="hidden" name="horse_id" value={selectedHorse?.id ?? ""} />
          <input type="hidden" name="horse" value={selectedHorse?.horse_name || "Selected runner"} />

          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Bet type
            <select
              name="bet_type"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
            >
              <option value="Win" className="bg-black text-white">Win</option>
              <option value="Place" className="bg-black text-white">Place</option>
            </select>
          </label>

          <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Odds taken
            <input
              type="number"
              name="odds_taken"
              min="1.01"
              step="0.01"
              required
              placeholder="e.g. 4.20"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
            />
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110 sm:col-span-2 xl:col-span-4"
          >
            Add My Pick To My Bets
          </button>

          {customBetMessage ? (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200 sm:col-span-2 xl:col-span-4">
              {customBetMessage}
            </div>
          ) : null}

          {customBetError ? (
            <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200 sm:col-span-2 xl:col-span-4">
              {customBetError}
            </div>
          ) : null}
        </form>
      </section>
    );
  }


  function renderHeadTipperCard(tip: SuggestedTip, index: number) {
    const time = formatRaceTime(tip.race_start_at, tip.race_timezone);
    const race = tip.race_id ? raceMap.get(Number(tip.race_id)) || null : null;
    const meeting = race ? meetingMap.get(Number(race.meeting_id)) || null : null;

    return (
      <article
        key={tip.id}
        className="overflow-hidden rounded-[1.75rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(0,0,0,0.86),rgba(24,24,27,0.92))] shadow-xl shadow-black/30"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 text-sm font-black text-black shadow-lg shadow-amber-500/20">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
                {meeting?.meeting_name || tip.race || "Race"} {race ? `R${race.race_number}` : ""}
              </p>
              <h3 className="mt-1 truncate text-xl font-black leading-tight text-white">
                <div className="flex items-center gap-2">
  {tip.runner_number ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 to-amber-500 text-xs font-black text-black">
      {tip.runner_number}
    </span>
  ) : null}

  <span>{tip.horse}</span>
</div>
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                <TipPill type={tip.type} />
                {tip.confidence ? smallPill(tip.confidence, "gold") : null}
                {time ? smallPill(time) : null}
              </div>
            </div>
          </div>

          {tip.commentary || tip.note ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
              {tip.commentary || tip.note}
            </p>
          ) : null}

          <div className="mt-4">
            <Link
              href={tipHref(tip.race_id)}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-300/15"
            >
              View Race
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/35 px-4 pb-4 pt-3">
          {renderHeadTipperBetForm(tip)}
        </div>
      </article>
    );
  }

  function renderCalculatorCard(tip: CalculatorTip, index: number) {
    return (
      <article
        key={tip.id}
        className="overflow-hidden rounded-[1.75rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(0,0,0,0.86),rgba(24,24,27,0.92))] shadow-xl shadow-black/30"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 text-sm font-black text-black shadow-lg shadow-amber-500/20">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
                {tip.race || "Race"}
              </p>
              <h3 className="mt-1 truncate text-xl font-black leading-tight text-white">
                <div className="flex items-center gap-2">
  {tip.runner_number ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 to-amber-500 text-xs font-black text-black">
      {tip.runner_number}
    </span>
  ) : null}

  <span>{tip.horse || "Unnamed horse"}</span>
</div>
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {tip.bet_type ? <TipPill type={tip.bet_type} /> : null}
                {tip.score !== null && tip.score !== undefined ? smallPill(`Score ${Math.round(Number(tip.score))}`, "gold") : null}
                {tip.place_percent !== null && tip.place_percent !== undefined ? smallPill(`Place ${Number(tip.place_percent)}%`, "blue") : null}
                {tip.win_percent !== null && tip.win_percent !== undefined ? smallPill(`Win ${Number(tip.win_percent)}%`, "green") : null}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={tipHref(tip.race_id)}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-300/15"
            >
              View Race
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/35 px-4 pb-4 pt-3">
          {renderCalculatorBetForm(tip)}
        </div>
      </article>
    );
  }

  function renderStatCard({
    href,
    eyebrow,
    value,
    label,
    cta,
    icon,
  }: {
    href: string;
    eyebrow: string;
    value: string | number;
    label: string;
    cta: string;
    icon: string;
  }) {
    return (
      <Link
        href={href}
        className="group relative overflow-hidden rounded-[1.6rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(0,0,0,0.9),rgba(24,24,27,0.86))] p-4 shadow-xl shadow-black/30 transition active:scale-[0.99] hover:border-amber-300/45"
      >
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl transition group-hover:bg-amber-300/18" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
              {eyebrow}
            </p>
            <span className="text-lg">{icon}</span>
          </div>

          <p className="mt-3 text-4xl font-black leading-none tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 min-h-[2rem] text-xs font-semibold leading-4 text-zinc-400">
            {label}
          </p>
          <p className="mt-4 border-t border-white/10 pt-3 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
            {cta} →
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(217,119,6,0.12),transparent_26%),linear-gradient(180deg,#030303_0%,#09090b_45%,#020617_100%)] text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 lg:px-8">
        <header className="sticky top-2 z-20 rounded-[1.75rem] border border-amber-300/20 bg-black/82 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_28px_rgba(245,158,11,0.25)]">
                <img src="/smartpunt-icon-512.png" alt="SmartPunt" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">SmartPunt</p>
                <h1 className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">My Dashboard</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/smartpunt-calculator-live-picks" className="rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-3 py-2 text-[11px] font-black text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110">
                Live Picks
              </Link>
              <form action={signOutAction}>
                <button className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-white/10">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mt-4 space-y-5 pb-8">
          <section className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.96),rgba(24,24,27,0.98),rgba(146,64,14,0.32))] shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
            <div className="relative p-5 sm:p-8">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-l from-amber-300/50 to-transparent" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  {smallPill("Premium Member", "gold")}
                  {smallPill(`${livePicksCount} Live Picks Today`, "green")}
                </div>
                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/80">
                  Welcome back, {displayName}
                </p>
                <h2 className="mt-2 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
                  Your Racing <span className="text-amber-300">Command Centre</span>
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-200 sm:text-base">
                  Fast access to today's SmartPunt plays, your active bets, race cards and personal strike rate — tuned for iPhone.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                  <Link href="/smartpunt-calculator-live-picks" className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-amber-500/25 transition hover:brightness-110">
                    Open Live Picks
                  </Link>
                  <Link href="/my-active-tips" className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/15">
                    My Active Tips
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {initialLiveFortuneFives.length > 0 ? (
            <Link
              href="/fortune-on-5"
              className="group relative block overflow-hidden rounded-[2rem] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(0,0,0,0.96),rgba(69,26,3,0.86),rgba(180,83,9,0.42))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] transition active:scale-[0.99] hover:border-amber-200/60 sm:p-6"
            >
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl transition group-hover:bg-amber-300/30" />
              <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

              <div className="relative flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-200/40 bg-amber-300/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
                      Fortune On 5
                    </span>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                      {initialLiveFortuneFives.length} Live
                    </span>
                  </div>

                  <h2 className="mt-3 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {initialLiveFortuneFives[0]?.title || "Today’s 5-Leg Multi"}
                  </h2>

                  <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-amber-50/75">
                    {initialLiveFortuneFives[0]?.description ||
                      "Five SmartPunt selections are ready. View the full multi and enter your accepted odds."}
                  </p>

                  <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-amber-200">
                    View Fortune On 5 →
                  </p>
                </div>

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-200/30 bg-black/35 text-3xl shadow-lg shadow-black/30">
                  🏆
                </div>
              </div>
            </Link>
          ) : null}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {renderStatCard({
              href: "/smartpunt-calculator-live-picks",
              eyebrow: "Live Picks",
              value: livePicksCount,
              label: "Today's opportunities",
              cta: "View",
              icon: "🏇",
            })}

            {renderStatCard({
              href: "/my-active-tips",
              eyebrow: "My Active Tips",
              value: initialActiveUserBetCount,
              label: "Currently following",
              cta: "Open",
              icon: "🎯",
            })}

            {renderStatCard({
              href: "/my-resulted-tips",
              eyebrow: "My Strike Rate",
              value: resultedTotal ? `${strikeRate}%` : "—",
              label: resultedTotal ? `${activeSuccessCount}/${resultedTotal} successful` : "No results yet",
              cta: "Results",
              icon: "📈",
            })}

            {renderStatCard({
              href: "/long-term-bets",
              eyebrow: "Watchlist / Early",
              value: watchEarlyCount,
              label: "Alerts and early plays",
              cta: "Open",
              icon: "👀",
            })}
          </section>

          {renderCustomBetBuilder()}

<section className="grid min-w-0 gap-4 overflow-hidden lg:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">⭐ Top Head Tipper Plays</h2>
                  <p className="mt-1 text-sm text-zinc-400">Today's strongest head tipper opportunities.</p>
                </div>
                <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">All</Link>
              </div>

              <div className="mt-5 space-y-3">
                {topHeadTipperPlays.length > 0 ? (
                  topHeadTipperPlays.map((tip, index) => renderHeadTipperCard(tip, index))
                ) : (
                  <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400">
                    No Head Tipper plays live for today.
                  </p>
                )}
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">🔥 Best Calculator Plays</h2>
                  <p className="mt-1 text-sm text-zinc-400">The model's strongest current signals.</p>
                </div>
                <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">All</Link>
              </div>

              <div className="mt-5 space-y-3">
                {topCalculatorPlays.length > 0 ? (
                  topCalculatorPlays.map((tip, index) => renderCalculatorCard(tip, index))
                ) : (
                  <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400">
                    No Calculator plays live for today.
                  </p>
                )}
              </div>
            </section>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Upcoming Meetings</h2>
                <p className="mt-1 text-sm text-zinc-400">Today's published meetings and race counts.</p>
              </div>
              {smallPill(`${todayRaces.length} races`, "gold")}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {meetingSummary.length > 0 ? (
                meetingSummary.map(({ meeting, raceCount }) => (
                  <div key={meeting.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black uppercase tracking-wide text-white">{meeting.meeting_name}</p>
                        <p className="mt-1 text-xs text-zinc-400">{meeting.track_condition || "Condition TBA"}</p>
                      </div>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-sm font-black text-amber-200">
                        {raceCount}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400 sm:col-span-2">
                  No meetings published for today.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.92),rgba(24,24,27,0.95))] p-5 shadow-2xl shadow-black/30">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">SmartPunt Edge</p>
            <h2 className="mt-3 text-2xl font-black text-white">Premium racing intelligence</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Live Picks is your front door. My Dashboard is your fast iPhone command centre for your bets, strike rate and today's meetings.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/smartpunt-calculator-live-picks" className="rounded-2xl border border-amber-300/30 px-4 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-300/10">
                Live Picks
              </Link>
              <Link href="/my-active-tips" className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Active Tips
              </Link>
              <Link href="/my-resulted-tips" className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Resulted Tips
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
