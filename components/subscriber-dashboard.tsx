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
initialVaultMatchCount = 0,
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
initialVaultMatchCount?: number;
}) {
  const [customRaceId, setCustomRaceId] = useState("");
  const [customRunnerId, setCustomRunnerId] = useState("");
  const [customBetType, setCustomBetType] = useState<
    "Win" | "Place" | "Each Way"
  >("Win");
  const [customBetMessage, setCustomBetMessage] = useState("");
  const [customBetError, setCustomBetError] = useState("");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const allTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

const today = getPerthDate(0);
const tomorrow = getPerthDate(1);

const [selectedDay, setSelectedDay] = useState<
  "today" | "tomorrow"
>("today");

const selectedDate =
  selectedDay === "today" ? today : tomorrow;

const selectedDayLabel =
  selectedDay === "today" ? "Today" : "Tomorrow";

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

const selectedDayRaces = useMemo(
  () =>
    initialPublishedRaces
      .filter((race) => {
        const meeting = meetingMap.get(
          Number(race.meeting_id),
        );

        return meeting?.meeting_date === selectedDate;
      })
      .sort((a, b) => {
        const meetingA =
          meetingMap.get(Number(a.meeting_id))
            ?.meeting_name || "";

        const meetingB =
          meetingMap.get(Number(b.meeting_id))
            ?.meeting_name || "";

        const meetingSort =
          meetingA.localeCompare(meetingB);

        if (meetingSort !== 0) {
          return meetingSort;
        }

        return (
          Number(a.race_number || 0) -
          Number(b.race_number || 0)
        );
      }),
  [
    initialPublishedRaces,
    meetingMap,
    selectedDate,
  ],
);
const todayRaces = useMemo(
  () =>
    initialPublishedRaces
      .filter((race) => {
        const meeting = meetingMap.get(
          Number(race.meeting_id),
        );

        return meeting?.meeting_date === today;
      })
      .sort((a, b) => {
        const meetingA =
          meetingMap.get(Number(a.meeting_id))
            ?.meeting_name || "";

        const meetingB =
          meetingMap.get(Number(b.meeting_id))
            ?.meeting_name || "";

        const meetingSort =
          meetingA.localeCompare(meetingB);

        if (meetingSort !== 0) {
          return meetingSort;
        }

        return (
          Number(a.race_number || 0) -
          Number(b.race_number || 0)
        );
      }),
  [
    initialPublishedRaces,
    meetingMap,
    today,
  ],
);
const allSelectedDaySuggestedTips = useMemo(
  () =>
    allTips.filter((tip) => {
      if (tip.settled_at !== null) return false;

      if (tip.race_start_at) {
        const tipDate = getDateOnlyInTimezone(
          tip.race_start_at,
          tip.race_timezone || "Australia/Perth",
        );

        if (
          tipDate &&
          tipDate !== selectedDate
        ) {
          return false;
        }
      }

      if (tip.race_id) {
        const race = raceMap.get(
          Number(tip.race_id),
        );

        const meeting = race
          ? meetingMap.get(
              Number(race.meeting_id),
            )
          : null;

        if (
          meeting?.meeting_date &&
          meeting.meeting_date !== selectedDate
        ) {
          return false;
        }
      }

      if (!tip.race_runner_id) {
        return true;
      }

      const linkedRunner = runnerMap.get(
        Number(tip.race_runner_id),
      );

      if (!linkedRunner) {
        return true;
      }

      return linkedRunner.scratched !== true;
    }),
  [
    allTips,
    meetingMap,
    raceMap,
    runnerMap,
    selectedDate,
  ],
);

const suggestedTips = useMemo(
  () =>
    allTips.filter((tip) => {
      if (tip.settled_at !== null) {
        return false;
      }

      if (activeTipIdSet.has(tip.id)) {
        return false;
      }

      if (tip.race_start_at) {
        const tipDate = getDateOnlyInTimezone(
          tip.race_start_at,
          tip.race_timezone || "Australia/Perth",
        );

        if (
          tipDate &&
          tipDate !== selectedDate
        ) {
          return false;
        }
      }

      if (tip.race_id) {
        const race = raceMap.get(
          Number(tip.race_id),
        );

        const meeting = race
          ? meetingMap.get(
              Number(race.meeting_id),
            )
          : null;

        if (
          meeting?.meeting_date &&
          meeting.meeting_date !== selectedDate
        ) {
          return false;
        }
      }

      if (!tip.race_runner_id) {
        return true;
      }

      const linkedRunner = runnerMap.get(
        Number(tip.race_runner_id),
      );

      if (!linkedRunner) {
        return true;
      }

      return linkedRunner.scratched !== true;
    }),
  [
    activeTipIdSet,
    allTips,
    meetingMap,
    raceMap,
    runnerMap,
    selectedDate,
  ],
);

  const allCalculatorTips = useMemo(() => {
    const calculationStartedAt =
      performance.now();

    const calculatedTips =
      getSubscriberCalculatorPlays({
races: selectedDayRaces,
        scoringRaces:
          initialScoringRaces.length
            ? initialScoringRaces
            : initialPublishedRaces,
        runners: initialPublishedRunners,
        scoringRunners:
          initialScoringRunners.length
            ? initialScoringRunners
            : initialPublishedRunners,
        horses: initialHorses,
        meetings: initialMeetings,
        jockeyProfiles:
          initialJockeyProfiles,
      }).filter((tip) => {
        if (!tip.race_runner_id) {
          return true;
        }

        const linkedRunner =
          runnerMap.get(
            Number(tip.race_runner_id),
          );

        if (!linkedRunner) {
          return true;
        }

        return (
          linkedRunner.scratched !== true
        );
      });

    console.info("[SmartPunt Performance]", {
      area: "subscriber-dashboard-client",
      stage:
        "calculate subscriber calculator plays",
      durationMs: Math.round(
        performance.now() -
          calculationStartedAt,
      ),
selectedDayRaceCount:
  selectedDayRaces.length,
      scoringRaceCount:
        initialScoringRaces.length,
      scoringRunnerCount:
        initialScoringRunners.length,
      calculatedTipCount:
        calculatedTips.length,
    });

    return calculatedTips;
  }, [
selectedDayRaces,
    initialPublishedRaces,
    initialPublishedRunners,
    initialScoringRaces,
    initialScoringRunners,
    initialHorses,
    initialMeetings,
    initialJockeyProfiles,
    runnerMap,
  ]);
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
  const byMeeting = new Map<
    number,
    {
      meeting: Meeting;
      raceCount: number;
    }
  >();

  selectedDayRaces.forEach((race) => {
    const meeting = meetingMap.get(
      Number(race.meeting_id),
    );

    if (!meeting) return;

    const existing = byMeeting.get(
      Number(meeting.id),
    );

    if (existing) {
      existing.raceCount += 1;
    } else {
      byMeeting.set(Number(meeting.id), {
        meeting,
        raceCount: 1,
      });
    }
  });

  return Array.from(byMeeting.values()).sort(
    (a, b) =>
      a.meeting.meeting_name.localeCompare(
        b.meeting.meeting_name,
      ),
  );
}, [meetingMap, selectedDayRaces]);

  const activeSuccessCount = initialResultedUserBets.filter((bet) => {
    const betType = String(bet.bet_type || "").toLowerCase();

    if (betType.includes("place")) return bet.placed === true;
    return bet.won === true;
  }).length;

  const resultedTotal = initialResultedUserBets.length;
  const strikeRate = resultedTotal
    ? Math.round((activeSuccessCount / resultedTotal) * 100)
    : 0;

const livePicksCount =
  allSelectedDaySuggestedTips.length +
  allCalculatorTips.length;
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
      setCustomBetType("Win");
      setCustomBetMessage("Added to My Bets.");
      router.refresh();
      return;
    }

    setCustomBetError(result.error || "Could not add this pick.");
  }

  function renderBetInputs(betType: string, dark = true) {
    const normalisedBetType = String(betType || "Win")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ");

    const isEachWay =
      normalisedBetType === "each way" ||
      normalisedBetType === "eachway" ||
      normalisedBetType.includes("each way");

const inputClasses = dark
  ? "border-white/15 bg-zinc-950 text-white placeholder:text-zinc-500"
  : "border-zinc-300 bg-white text-zinc-950 placeholder:text-zinc-400";

    if (isEachWay) {
      return (
        <div className="grid w-full grid-cols-2 gap-2">
          <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            Win odds
            <input
              type="number"
              name="win_odds_taken"
              min="1.01"
              step="0.01"
              required
              placeholder="5.00"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
          </label>

          <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            Win stake
            <input
              type="number"
              name="win_stake_points"
              min="0.01"
              step="0.01"
              required
              placeholder="10"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
          </label>

          <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            Place odds
            <input
              type="number"
              name="place_odds_taken"
              min="1.01"
              step="0.01"
              required
              placeholder="2.00"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
          </label>

          <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            Place stake
            <input
              type="number"
              name="place_stake_points"
              min="0.01"
              step="0.01"
              required
              placeholder="10"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
          </label>
        </div>
      );
    }

    return (
      <div className="grid w-full grid-cols-2 gap-2">
        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
          Odds taken
          <input
            type="number"
            name="odds_taken"
            min="1.01"
            step="0.01"
            required
            placeholder="3.40"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
        </label>

        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
          Stake
          <input
            type="number"
            name="stake_points"
            min="0.01"
            step="0.01"
            required
            placeholder="10"
className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:border-amber-400 ${inputClasses}`}
style={
  dark
    ? {
        colorScheme: "dark",
        backgroundColor: "#09090b",
        color: "#ffffff",
        WebkitTextFillColor: "#ffffff",
        opacity: 1,
      }
    : {
        colorScheme: "light",
        backgroundColor: "#ffffff",
        color: "#18181b",
        WebkitTextFillColor: "#18181b",
        opacity: 1,
      }
}
/>
        </label>
      </div>
    );
  }

function renderHeadTipperBetForm(tip: SuggestedTip) {
  return (
    <form
      action={addUserBetFormAction}
      className="mt-4 grid gap-3"
    >
      <input type="hidden" name="source" value="head_tipper" />
      <input type="hidden" name="suggested_tip_id" value={tip.id} />
      <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
      <input
        type="hidden"
        name="race_runner_id"
        value={tip.race_runner_id ?? ""}
      />
      <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
      <input type="hidden" name="horse" value={tip.horse} />
      <input type="hidden" name="race" value={tip.race} />
      <input type="hidden" name="bet_type" value={tip.type} />

      {renderBetInputs(tip.type, true)}

      <button className="w-full rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-3 py-2.5 text-xs font-black text-black shadow-md shadow-amber-500/20 transition hover:brightness-110">
        Add To My Tips
      </button>
    </form>
  );
}

  function renderCalculatorBetForm(tip: CalculatorTip) {
    const betType = tip.bet_type || "Win";

    return (
      <form
        action={addUserBetFormAction}
        className="mt-4 grid gap-3"
      >
        <input type="hidden" name="source" value="calculator" />
        <input
          type="hidden"
          name="calculator_tip_id"
          value={tip.calculator_tip_id ?? ""}
        />
        <input type="hidden" name="race_id" value={tip.race_id ?? ""} />
        <input
          type="hidden"
          name="race_runner_id"
          value={tip.race_runner_id ?? ""}
        />
        <input type="hidden" name="horse_id" value={tip.horse_id ?? ""} />
        <input type="hidden" name="horse" value={tip.horse || ""} />
        <input type="hidden" name="race" value={tip.race || ""} />
        <input type="hidden" name="bet_type" value={betType} />

        {renderBetInputs(betType, true)}

        <button className="w-full rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-3 py-2.5 text-xs font-black text-black shadow-md shadow-amber-500/20 transition hover:brightness-110">
          Add To My Tips
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
              className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 outline-none focus:border-amber-400"
              style={{
                colorScheme: "light",
                backgroundColor: "#f4f4f5",
                color: "#18181b",
                WebkitTextFillColor: "#18181b",
              }}
            >
              <option value="">Choose race</option>

              {todayRaces.map((race) => {
                const meeting =
                  meetingMap.get(Number(race.meeting_id)) || null;

                return (
                  <option key={race.id} value={race.id}>
                    {meeting?.meeting_name || "Meeting"} • Race{" "}
                    {race.race_number}
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
              onChange={(event) =>
                setCustomRunnerId(event.target.value)
              }
              required
              className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 outline-none focus:border-amber-400"
              style={{
                colorScheme: "light",
                backgroundColor: "#f4f4f5",
                color: "#18181b",
                WebkitTextFillColor: "#18181b",
              }}
            >
              <option value="">Choose horse</option>

              {runners
                .filter((runner) => runner.scratched !== true)
                .map((runner) => {
                  const horse = horseMap.get(
                    Number(runner.horse_id),
                  );

                  return (
                    <option key={runner.id} value={runner.id}>
                      {runner.runner_number
                        ? `[${runner.runner_number}] `
                        : ""}
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
              value={customBetType}
              onChange={(event) =>
                setCustomBetType(
                  event.target.value as "Win" | "Place" | "Each Way",
                )
              }
              required
              className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 outline-none focus:border-amber-400"
              style={{
                colorScheme: "light",
                backgroundColor: "#f4f4f5",
                color: "#18181b",
                WebkitTextFillColor: "#18181b",
              }}
            >
              <option value="Win">Win</option>
              <option value="Place">Place</option>
              <option value="Each Way">Each Way</option>
            </select>
          </label>

          <div className="sm:col-span-2 xl:col-span-1">
            {renderBetInputs(customBetType, true)}
          </div>

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
  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1">
    <img
      src="/maverick/maverick-shield.png"
      alt="The Maverick"
      className="h-4 w-4 object-contain"
    />
    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-amber-200">
      The Maverick
    </span>
  </div>

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
                <h1 className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">Member Dashboard</h1>
              </div>
            </div>

<div className="flex shrink-0 items-center gap-2">
  {["admin", "staff_admin"].includes(
    String(currentUser.role || ""),
  ) ? (
    <Link
      href="/mobile-admin"
      className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-300/15"
    >
      Admin
    </Link>
  ) : null}

  <form action={signOutAction}>
    <button className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-white/10">
      Log out
    </button>
  </form>
</div>
          </div>
        </header>

        <main className="mt-4 space-y-5 pb-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/30 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.65)]">

<div className="pointer-events-none absolute inset-0 overflow-hidden">
<img
  src="/maverick/maverick-watermark.png"
  alt=""
  aria-hidden="true"
  className="absolute left-1/2 top-1/2 w-[240px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] sm:w-[340px] sm:opacity-[0.10] lg:w-[420px] select-none"
/>

  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />

  <div className="absolute bottom-0 right-0 h-px w-3/4 bg-gradient-to-l from-amber-300/60 to-transparent" />
</div>

            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {smallPill("Premium Member", "gold")}
                {smallPill(`${livePicksCount} Live Picks Today`, "green")}

                {initialLiveFortuneFives.length > 0 ? (
                  <span className="rounded-full border border-amber-200/40 bg-amber-300/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100">
                    Fortune on 5 Live
                  </span>
                ) : null}
              </div>

              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/80">
                Welcome back, {displayName}
              </p>

              <h2 className="mt-2 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
                Today&apos;s Edge
                <span className="block text-amber-300">
                  Starts Here.
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-200 sm:text-base">
                Your premium racing intelligence for today&apos;s meetings,
                Maverick selections, Calculator plays and active bets.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-sm sm:max-w-xl">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">
                    {meetingSummary.length}
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    Meetings
                  </p>
                </div>

                <div className="border-x border-white/10 text-center">
                  <p className="text-2xl font-black text-white">
                    {selectedDayRaces.length}
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    Races
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-black text-amber-300">
                    {livePicksCount}
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    Opportunities
                  </p>
                </div>
              </div>

              {initialLiveFortuneFives.length > 0 ? (
                <Link
                  href="/fortune-on-5"
                  className="group mt-5 block max-w-2xl rounded-[1.5rem] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.42),rgba(0,0,0,0.65))] p-4 transition hover:border-amber-200/60 hover:bg-amber-300/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/35 bg-black/65 shadow-[0_0_22px_rgba(251,191,36,0.2)]">
                      <img
                        src="/maverick/maverick-shield.png"
                        alt="The Maverick"
                        className="h-full w-full object-contain p-1"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200">
                        Created by The Maverick
                      </p>

                      <h3 className="mt-1 truncate text-xl font-black text-white">
                        {initialLiveFortuneFives[0]?.title ||
                          "Fortune on 5"}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-amber-50/70">
                        {initialLiveFortuneFives[0]?.description ||
                          "The Maverick’s premium daily five-leg multi is ready."}
                      </p>
                    </div>

                    <span className="shrink-0 text-xl font-black text-amber-300 transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="mt-5 max-w-2xl rounded-[1.5rem] border border-dashed border-white/15 bg-black/25 p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/maverick/maverick-shield.png"
                      alt="The Maverick"
                      className="h-10 w-10 object-contain opacity-70"
                    />

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        The Maverick
                      </p>
                      <p className="mt-1 text-sm font-bold text-zinc-300">
                        Today&apos;s Fortune on 5 has not been published yet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <Link
                  href="/smartpunt-calculator-live-picks"
                  className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-amber-500/25 transition hover:brightness-110"
                >
                  Open Live Picks
                </Link>

                <Link
                  href="/my-active-tips"
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/15"
                >
                  My Active Tips
                </Link>

                <Link
                  href="/the-vault"
                  className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-300/15"
                >
                  The Vault
                </Link>
              </div>
            </div>
          </section>

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
  href: "/the-vault",
  eyebrow: "The Vault",
  value: initialVaultMatchCount,
  label:
    initialVaultMatchCount === 1
      ? "1 live Vault match"
      : `${initialVaultMatchCount} live Vault matches`,
  cta: "Open",
  icon: initialVaultMatchCount > 0 ? "🔔" : "🏦",
})}
          </section>

{renderCustomBetBuilder()}

<section className="rounded-[1.75rem] border border-amber-300/20 bg-black/82 p-2 shadow-xl shadow-black/30">
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => setSelectedDay("today")}
      className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
        selectedDay === "today"
          ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 text-black shadow-lg shadow-amber-500/20"
          : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
      }`}
    >
      Today
    </button>

    <button
      type="button"
      onClick={() => setSelectedDay("tomorrow")}
      className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
        selectedDay === "tomorrow"
          ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 text-black shadow-lg shadow-amber-500/20"
          : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
      }`}
    >
      Tomorrow
    </button>
  </div>
</section>

<section className="grid min-w-0 gap-4 overflow-hidden lg:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">🛡️ Top Maverick Plays</h2>
                  <p className="mt-1 text-sm text-zinc-400">{selectedDayLabel}'s strongest Maverick selections.</p>
                </div>
                <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">All</Link>
              </div>

              <div className="mt-5 space-y-3">
                {topHeadTipperPlays.length > 0 ? (
                  topHeadTipperPlays.map((tip, index) => renderHeadTipperCard(tip, index))
                ) : (
                  <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400">
                    No Maverick selections live for {selectedDayLabel.toLowerCase()}.
                  </p>
                )}
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white">🔥 Best Calculator Plays</h2>
                  <p className="mt-1 text-sm text-zinc-400">The model's strongest signals for {selectedDayLabel.toLowerCase()}.</p>
                </div>
                <Link href="/smartpunt-calculator-live-picks" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/10">All</Link>
              </div>

              <div className="mt-5 space-y-3">
                {topCalculatorPlays.length > 0 ? (
                  topCalculatorPlays.map((tip, index) => renderCalculatorCard(tip, index))
                ) : (
                  <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400">
                   No Calculator plays live for {selectedDayLabel.toLowerCase()}.
                  </p>
                )}
              </div>
            </section>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
            <div className="flex items-center justify-between gap-3">
<div>
  <h2 className="text-xl font-black uppercase tracking-tight text-white">
    Upcoming Meetings
  </h2>
  <p className="mt-1 text-sm text-zinc-400">
    {selectedDayLabel}'s published meetings and race counts.
  </p>
</div>

{smallPill(
  `${selectedDayRaces.length} races`,
  "gold",
)}
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
No meetings published for {selectedDayLabel.toLowerCase()}.
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
  <Link
    href="/smartpunt-calculator-live-picks"
    className="rounded-2xl border border-amber-300/30 px-4 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-300/10"
  >
    Live Picks
  </Link>

  <Link
    href="/my-active-tips"
    className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
  >
    Active Tips
  </Link>

  <Link
    href="/my-resulted-tips"
    className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
  >
    Resulted Tips
  </Link>

  <Link
    href="/long-term-bets"
    className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
  >
    Watchlist / Get On Early
    {watchEarlyCount > 0 ? ` (${watchEarlyCount})` : ""}
  </Link>
</div>
          </section>
        </main>
      </div>
    </div>
  );
}

