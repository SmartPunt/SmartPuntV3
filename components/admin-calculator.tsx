"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  publishSmartPuntCalculatorTipAction,
  signOutAction,
} from "@/lib/actions";
import {
  buildHorseHistory,
  calculateRaceConfidence,
  calculateRaceScores,
  formatFormLine,
  getFactorStatus,
  getCalculatorTipThresholds,
  getSelectedHorseSummary,
  getQualifiedCalculatorTip,
  roundScore,
  type Horse,
  type JockeyProfile,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";

type CalculatorTip = {
  id: number;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  runner_number?: number | null;
  bet_type: string | null;
  status: string | null;
  published_at: string | null;
};
type CalculatorPredictionSnapshot = {
  id: number;
  race_id: number;
  runner_id: number;
  horse_id: number | null;

  scoring_version: string | null;

  score: number | string;
  rank: number;
  win_percent: number;
  place_percent: number;

  recent_form_score: number | string;
  distance_score: number | string;
  track_score: number | string;
  condition_score: number | string;
  barrier_score: number | string;
  weight_score: number | string;
  jockey_score: number | string;
  trainer_score: number | string;

  is_smartpunt_tip: boolean | null;
  smartpunt_tip_type: string | null;

  race_gap: number | string | null;
  race_confidence_tier: string | null;
  race_confidence_percent: number | string | null;
  suggested_bet: string | null;

  audit_json: any;

  predicted_at: string | null;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
};
type CalculatorTipEvolutionRow = {
  id: number;
  race_id: number;
  runner_id: number | null;
  horse_id: number | null;

  event_type: string | null;
  reason_code: string | null;

  previous_tip: string | null;
  new_tip: string | null;

  previous_runner_id: number | null;
  new_runner_id: number | null;
  previous_horse_id: number | null;
  new_horse_id: number | null;

  previous_score: number | string | null;
  new_score: number | string | null;

  previous_gap: number | string | null;
  new_gap: number | string | null;

  previous_confidence_percent: number | string | null;
  new_confidence_percent: number | string | null;

  previous_confidence_tier: string | null;
  new_confidence_tier: string | null;

  change_reasons_json: unknown;
  scoring_version: string | null;
  changed_at: string;
};
type SpecialistAlert = {
  horseName: string;
  label: string;
  detail: string;
  strength: "proven" | "emerging";
};

type RaceEdgeLeader = {
  horseName: string;
  signalCount: number;
  provenCount: number;
  emergingCount: number;
  signals: SpecialistAlert[];
};

type SpecialistAlertInput = {
  race: Race;
  meeting: Meeting | undefined;
  scoredRunners: ReturnType<typeof calculateRaceScores>;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
};

function getPerthDate(offsetDays = 0) {
  const perthParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(perthParts.find((part) => part.type === "year")?.value);
  const month = Number(perthParts.find((part) => part.type === "month")?.value);
  const day = Number(perthParts.find((part) => part.type === "day")?.value);

  const perthCalendarDate = new Date(
    Date.UTC(year, month - 1, day + offsetDays, 12),
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(perthCalendarDate);
}

function getSpecialistDistanceBucket(distance?: number | null) {
  if (!distance) return "Unknown";
  if (distance <= 1200) return "1000–1200m";
  if (distance <= 1400) return "1201–1400m";
  if (distance <= 1600) return "1401–1600m";
  if (distance <= 1800) return "1601–1800m";
  if (distance <= 2200) return "1801–2200m";
  return "2200m+";
}

function getSpecialistConditionBucket(condition?: string | null) {
  const value = String(condition || "").toLowerCase();

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  if (value.startsWith("synthetic")) return "Synthetic";
  return "Other";
}

function getDistanceSpecialistLabel(distanceBucket: string, emerging = false) {
  const prefix = emerging ? "Emerging " : "";

  if (distanceBucket === "1000–1200m") return `${prefix}Sprint Specialist`;
  if (distanceBucket === "1201–1400m")
    return `${prefix}Short Course Specialist`;
  if (distanceBucket === "1401–1600m") return `${prefix}Mile Specialist`;
  if (distanceBucket === "1601–1800m")
    return `${prefix}Middle Distance Specialist`;
  if (distanceBucket === "1801–2200m") return `${prefix}Staying Specialist`;
  if (distanceBucket === "2200m+")
    return emerging ? "Emerging Stayer" : "Stayer";

  return `${prefix}Distance Specialist`;
}

function getConditionSpecialistLabel(
  conditionBucket: string,
  emerging = false,
) {
  const prefix = emerging ? "Emerging " : "";

  if (conditionBucket === "Heavy") return `${prefix}Heavy Tracker`;
  if (conditionBucket === "Soft") return `${prefix}Wet Tracker`;
  if (conditionBucket === "Good") return `${prefix}Good Track Performer`;
  if (conditionBucket === "Synthetic") return `${prefix}Synthetic Performer`;

  return `${prefix}Condition Specialist`;
}

function getSpecialistRunStats<
  T extends { finishing_position?: number | null },
>(runs: T[]) {
  const wins = runs.filter((run) => run.finishing_position === 1).length;
  const places = runs.filter((run) => {
    const position = run.finishing_position;
    return position !== null && position !== undefined && position <= 3;
  }).length;
  const placeRate = runs.length ? places / runs.length : 0;

  return {
    runs: runs.length,
    wins,
    places,
    placeRate,
  };
}

function formatSpecialistPlaceRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildSetupMatchedSpecialistAlerts({
  race,
  meeting,
  scoredRunners,
  races,
  runners,
  horses,
  meetings,
}: SpecialistAlertInput) {
  const raceDistanceBucket = getSpecialistDistanceBucket(race.distance_m);
  const raceConditionBucket = getSpecialistConditionBucket(
    meeting?.track_condition || null,
  );
  const alerts: SpecialistAlert[] = [];
  const seen = new Set<string>();

  function addAlert(alert: SpecialistAlert) {
    const key = `${alert.horseName}-${alert.label}`;
    if (seen.has(key)) return;

    seen.add(key);
    alerts.push(alert);
  }

  scoredRunners.forEach((runner) => {
    const horse = horses.find(
      (item) => Number(item.id) === Number(runner.horse_id),
    );
    const horseName = horse?.horse_name || runner.horse_name;
    const historyRuns = buildHorseHistory(
      runner.horse_id,
      runners,
      races,
      meetings,
      race.id,
    );

    if (raceDistanceBucket !== "Unknown") {
      const distanceRuns = historyRuns.filter(
        (run) =>
          getSpecialistDistanceBucket(run.race?.distance_m) ===
          raceDistanceBucket,
      );
      const stats = getSpecialistRunStats(distanceRuns);

      if (stats.runs >= 5 && stats.placeRate >= 0.5) {
        addAlert({
          horseName,
          label: getDistanceSpecialistLabel(raceDistanceBucket),
          detail: `${stats.runs} runs at ${raceDistanceBucket} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "proven",
        });
      } else if (stats.runs >= 3 && stats.placeRate >= 0.66) {
        addAlert({
          horseName,
          label: getDistanceSpecialistLabel(raceDistanceBucket, true),
          detail: `${stats.runs} runs at ${raceDistanceBucket} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "emerging",
        });
      }
    }

    if (meeting?.meeting_name) {
      const trackRuns = historyRuns.filter(
        (run) => run.meeting?.meeting_name === meeting.meeting_name,
      );
      const stats = getSpecialistRunStats(trackRuns);

      if (stats.runs >= 5 && stats.placeRate >= 0.5) {
        addAlert({
          horseName,
          label: `${meeting.meeting_name} Specialist`,
          detail: `${stats.runs} runs at ${meeting.meeting_name} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "proven",
        });
      } else if (stats.runs >= 3 && stats.placeRate >= 0.66) {
        addAlert({
          horseName,
          label: `Emerging ${meeting.meeting_name} Specialist`,
          detail: `${stats.runs} runs at ${meeting.meeting_name} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "emerging",
        });
      }
    }

    if (raceConditionBucket !== "Other") {
      const conditionRuns = historyRuns.filter(
        (run) =>
          getSpecialistConditionBucket(run.meeting?.track_condition) ===
          raceConditionBucket,
      );
      const stats = getSpecialistRunStats(conditionRuns);

      if (stats.runs >= 5 && stats.placeRate >= 0.5) {
        addAlert({
          horseName,
          label: getConditionSpecialistLabel(raceConditionBucket),
          detail: `${stats.runs} runs on ${raceConditionBucket} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "proven",
        });
      } else if (stats.runs >= 3 && stats.placeRate >= 0.66) {
        addAlert({
          horseName,
          label: getConditionSpecialistLabel(raceConditionBucket, true),
          detail: `${stats.runs} runs on ${raceConditionBucket} • ${stats.wins} wins • ${stats.places} places • ${formatSpecialistPlaceRate(stats.placeRate)} place rate`,
          strength: "emerging",
        });
      }
    }
  });

  return alerts
    .sort((a, b) => {
      const strengthScore = { proven: 2, emerging: 1 };
      return strengthScore[b.strength] - strengthScore[a.strength];
    })
    .slice(0, 8);
}

function buildRaceEdgeLeaders(alerts: SpecialistAlert[]): RaceEdgeLeader[] {
  const grouped = new Map<string, RaceEdgeLeader>();

  alerts.forEach((alert) => {
    const existing = grouped.get(alert.horseName);

    if (existing) {
      existing.signalCount += 1;
      existing.provenCount += alert.strength === "proven" ? 1 : 0;
      existing.emergingCount += alert.strength === "emerging" ? 1 : 0;
      existing.signals.push(alert);
      return;
    }

    grouped.set(alert.horseName, {
      horseName: alert.horseName,
      signalCount: 1,
      provenCount: alert.strength === "proven" ? 1 : 0,
      emergingCount: alert.strength === "emerging" ? 1 : 0,
      signals: [alert],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    if (b.provenCount !== a.provenCount) return b.provenCount - a.provenCount;
    return a.horseName.localeCompare(b.horseName);
  });
}

type RaceDayFilter = "yesterday" | "today" | "tomorrow";

type DayDates = {
  yesterday: string;
  today: string;
  tomorrow: string;
};

function getRaceDayLabel(value: RaceDayFilter) {
  if (value === "yesterday") return "Yesterday";
  if (value === "tomorrow") return "Tomorrow";
  return "Today";
}

function matchesRaceDay(
  meeting: Meeting | undefined,
  raceDayFilter: RaceDayFilter,
  dayDates: DayDates,
) {
  if (!meeting?.meeting_date) return false;
  return meeting.meeting_date === dayDates[raceDayFilter];
}

function getAuditStatusLabel(status?: string | null) {
  if (status === "strong") return "Strong evidence";
  if (status === "supported") return "Supported";
  if (status === "limited") return "Limited evidence";
  if (status === "fallback") return "Fallback used";
  if (status === "neutral") return "Neutral";
  if (status === "risk") return "Risk";
  return "Audit";
}

function getAuditStatusClass(status?: string | null) {
  if (status === "strong" || status === "supported") {
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "limited" || status === "fallback" || status === "neutral") {
    return "border-amber-400/35 bg-amber-500/10 text-amber-200";
  }

  if (status === "risk") {
    return "border-red-400/35 bg-red-500/10 text-red-200";
  }

  return "border-zinc-500/35 bg-zinc-500/10 text-zinc-200";
}

function getAuditDotClass(status?: string | null) {
  if (status === "strong" || status === "supported") return "bg-emerald-400";
  if (status === "risk") return "bg-red-400";
  if (status === "limited" || status === "fallback" || status === "neutral")
    return "bg-amber-300";
  return "bg-zinc-400";
}

function formatImportedAt(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
function formatEvolutionTime(value?: string | null) {
  if (!value) return "Time not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getEvolutionReasonLabel(value?: string | null) {
  if (value === "initial_state") return "Initial calculator state";
  if (value === "tip_added") return "Calculator tip added";
  if (value === "tip_removed") return "Calculator tip removed";
  if (value === "tip_type_changed") return "Tip type changed";
  if (value === "selected_runner_changed") return "Selected runner changed";
  if (value === "score_increased") return "Top score increased";
  if (value === "score_decreased") return "Top score decreased";
  if (value === "confidence_increased") return "Race confidence increased";
  if (value === "confidence_decreased") return "Race confidence decreased";
  if (value === "gap_increased") return "Race gap increased";
  if (value === "gap_decreased") return "Race gap decreased";
  return "Calculator state changed";
}

function getEvolutionReasons(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object" &&
        "label" in item &&
        typeof item.label === "string"
      ) {
        return item.label.trim();
      }

      return "";
    })
    .filter(Boolean);
}
export default function AdminCalculator({
  races,
  runners,
  horses,
  meetings,
  jockeyProfiles,
  calculatorTips = [],
  calculatorPredictions = [],
  calculatorTipEvolution = [],
  dayDates,
}: {
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
  jockeyProfiles: JockeyProfile[];
  calculatorTips?: CalculatorTip[];
  calculatorPredictions?: CalculatorPredictionSnapshot[];
  calculatorTipEvolution?: CalculatorTipEvolutionRow[];
  dayDates?: DayDates;
}) {
  const [search, setSearch] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [strongestBetMode, setStrongestBetMode] = useState<"win" | "place">(
    "win",
  );

  const [raceDayFilter, setRaceDayFilter] = useState<RaceDayFilter>("today");
  const [showTipsOnly, setShowTipsOnly] = useState(false);
  const [showSpecialistsOnly, setShowSpecialistsOnly] = useState(false);
  const [minimumConfidence, setMinimumConfidence] = useState("all");
  const [selectedAuditRunnerId, setSelectedAuditRunnerId] = useState<
    number | null
  >(null);

  const activeDayDates = useMemo<DayDates>(
    () =>
      dayDates || {
        yesterday: getPerthDate(-1),
        today: getPerthDate(0),
        tomorrow: getPerthDate(1),
      },
    [dayDates],
  );

  const selectedRaceDayLabel = getRaceDayLabel(raceDayFilter);

  const predictionSnapshotsByRaceId = useMemo(() => {
    const map = new Map<number, CalculatorPredictionSnapshot[]>();

    calculatorPredictions.forEach((prediction) => {
      const raceId = Number(prediction.race_id);
      const existing = map.get(raceId) || [];

      existing.push(prediction);
      map.set(raceId, existing);
    });

    map.forEach((racePredictions) => {
      racePredictions.sort(
        (a, b) => Number(a.rank || 0) - Number(b.rank || 0),
      );
    });

    return map;
  }, [calculatorPredictions]);

  function buildHistoricalScoredRunners(race: Race) {
    const predictions =
      predictionSnapshotsByRaceId.get(Number(race.id)) || [];

    if (!predictions.length) {
      return null;
    }

    const meeting = meetings.find(
      (item) => Number(item.id) === Number(race.meeting_id),
    );

    return predictions.map((prediction) => {
      const runner = runners.find(
        (item) => Number(item.id) === Number(prediction.runner_id),
      );

      const horse = horses.find(
        (item) =>
          Number(item.id) ===
          Number(prediction.horse_id || runner?.horse_id),
      );

      const weightKg =
        runner?.weight_kg !== null && runner?.weight_kg !== undefined
          ? Number(runner.weight_kg)
          : null;

      const apprenticeClaim =
        runner?.apprentice_claim_kg !== null &&
        runner?.apprentice_claim_kg !== undefined
          ? Number(runner.apprentice_claim_kg)
          : 0;

      return {
        ...(runner || {}),

        id: Number(prediction.runner_id),
        race_id: Number(prediction.race_id),
        horse_id:
          prediction.horse_id !== null &&
          prediction.horse_id !== undefined
            ? Number(prediction.horse_id)
            : Number(runner?.horse_id || 0),

        horse_name: horse?.horse_name || "Unknown horse",

        meeting_name: meeting?.meeting_name || "",
        meeting_date: meeting?.meeting_date || "",
        track_condition: meeting?.track_condition || null,
race_name: race.race_name || "",
race_number: Number(race.race_number || 0),
distance_m: Number(race.distance_m || 0),
        score: Number(prediction.score || 0),
        rank: Number(prediction.rank || 0),

        winPercent: Number(prediction.win_percent || 0),
        placePercent: Number(prediction.place_percent || 0),

        components: {
          recentForm: Number(prediction.recent_form_score || 0),
          distance: Number(prediction.distance_score || 0),
          track: Number(prediction.track_score || 0),
          condition: Number(prediction.condition_score || 0),
          barrier: Number(prediction.barrier_score || 0),
          weight: Number(prediction.weight_score || 0),
          jockey: Number(prediction.jockey_score || 0),
          trainer: Number(prediction.trainer_score || 0),

          consistency: Number(
            prediction.audit_json?.sections?.consistency?.score || 0,
          ),

          powerRating: Number(
            prediction.audit_json?.overall?.powerRating || 0,
          ),

          powerAdjustment: Number(
            prediction.audit_json?.overall?.powerAdjustment || 0,
          ),
        },

        audit: prediction.audit_json || null,

        effectiveWeight:
          weightKg !== null
            ? Math.max(0, weightKg - apprenticeClaim)
            : null,

        smartpunt_power_rating:
          horse?.smartpunt_power_rating ?? null,

        verdict:
          prediction.is_smartpunt_tip === true
            ? `${prediction.smartpunt_tip_type || "Tip"} Tip`
            : "No Bet",

        historicalPrediction: prediction,
      };
    }) as ReturnType<typeof calculateRaceScores>;
  }

  function getStoredRaceConfidence(
    race: Race | null,
    scored: ReturnType<typeof calculateRaceScores>,
    trackCondition?: string | null,
  ) {
    if (!race || String(race.status || "") !== "closed") {
      return null;
    }

    const prediction =
      predictionSnapshotsByRaceId.get(Number(race.id))?.[0] || null;

    if (!prediction) {
      return null;
    }

    const calculatedShape = calculateRaceConfidence(scored, {
      trackCondition: trackCondition || null,
      raceName: race.race_name || "",
      placeTerms: race.place_terms || "top_3",
    });

    return {
      ...calculatedShape,
tier:
  (prediction.race_confidence_tier as
    | "Low"
    | "Medium"
    | "High"
    | "Elite") ?? calculatedShape.tier,
      confidencePercent: Number(
        prediction.race_confidence_percent ||
          calculatedShape.confidencePercent ||
          0,
      ),
      gap: Number(
        prediction.race_gap ??
          calculatedShape.gap ??
          0,
      ),
      suggestedBet:
        prediction.suggested_bet ||
        calculatedShape.suggestedBet,
      volatility: "Historical snapshot",
      summary:
        "Stored pre-settlement calculator snapshot. Scores, ranking, confidence and tip decision are frozen from race day.",
    };
  }

  function getStoredQualifiedTip(
    race: Race | null,
    scored: ReturnType<typeof calculateRaceScores>,
    storedRaceConfidence: ReturnType<
      typeof calculateRaceConfidence
    > | null,
  ) {
    if (
      !race ||
      String(race.status || "") !== "closed" ||
      !storedRaceConfidence
    ) {
      return null;
    }

    const predictions =
      predictionSnapshotsByRaceId.get(Number(race.id)) || [];

    const tipPrediction = predictions.find(
      (prediction) => prediction.is_smartpunt_tip === true,
    );

    if (!tipPrediction) {
      return null;
    }

    const runner =
      scored.find(
        (item) =>
          Number(item.id) === Number(tipPrediction.runner_id),
      ) || null;

    if (!runner) {
      return null;
    }

    const type =
      String(tipPrediction.smartpunt_tip_type || "")
        .toLowerCase()
        .includes("place")
        ? "Place"
        : "Win";

    return {
      runner,
      type,
      gap: Number(tipPrediction.race_gap || 0),
      raceConfidence: storedRaceConfidence,
      qualifiesAsStrongWin: false,
      qualifiesAsStrongPlace: false,
    };
  }

  const publishedRaces = useMemo(
    () =>
      races.filter((race) =>
        ["published", "closed"].includes(String(race.status || "")),
      ),
    [races],
  );

  const dayPublishedRaces = useMemo(
    () =>
      publishedRaces.filter((race) => {
        const meeting = meetings.find((item) => item.id === race.meeting_id);
        return matchesRaceDay(meeting, raceDayFilter, activeDayDates);
      }),
    [activeDayDates, meetings, publishedRaces, raceDayFilter],
  );

  const orderedPublishedRaces = useMemo(
    () =>
      [...dayPublishedRaces].sort((a, b) => {
        const meetingA = meetings.find((item) => item.id === a.meeting_id);
        const meetingB = meetings.find((item) => item.id === b.meeting_id);

        const dateCompare = String(meetingA?.meeting_date || "").localeCompare(
          String(meetingB?.meeting_date || ""),
        );

        if (dateCompare !== 0) return dateCompare;

        const meetingCompare = String(
          meetingA?.meeting_name || "",
        ).localeCompare(String(meetingB?.meeting_name || ""));

        if (meetingCompare !== 0) return meetingCompare;

        return Number(a.race_number || 0) - Number(b.race_number || 0);
      }),
    [dayPublishedRaces, meetings],
  );

  const matchingHorses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    return horses
      .filter((horse) => horse.horse_name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [horses, search]);

  const selectedHorse = useMemo(() => {
    const exact = horses.find(
      (horse) => horse.horse_name.toLowerCase() === search.trim().toLowerCase(),
    );

    if (exact) return exact;

    return matchingHorses[0] || null;
  }, [horses, matchingHorses, search]);

const horseRace = useMemo(() => {
  if (!selectedHorse) return null;

  const matchingRace = orderedPublishedRaces.find((race) =>
    runners.some(
      (runner) =>
        Number(runner.horse_id) === Number(selectedHorse.id) &&
        Number(runner.race_id) === Number(race.id),
    ),
  );

  return matchingRace || null;
}, [orderedPublishedRaces, runners, selectedHorse]);

  const activeRace = useMemo(() => {
    if (selectedRaceId) {
      return (
        orderedPublishedRaces.find(
          (race) => String(race.id) === selectedRaceId,
        ) ||
        orderedPublishedRaces[0] ||
        null
      );
    }

    return horseRace || orderedPublishedRaces[0] || null;
  }, [horseRace, orderedPublishedRaces, selectedRaceId]);

  const scoredRunnersByRaceId = useMemo(() => {
    const racesToScore = new Map<number, Race>();

    dayPublishedRaces.forEach((race) => {
      racesToScore.set(Number(race.id), race);
    });

    if (activeRace) {
      racesToScore.set(Number(activeRace.id), activeRace);
    }

    const scoredByRaceId = new Map<
      number,
      ReturnType<typeof calculateRaceScores>
    >();

    racesToScore.forEach((race, raceId) => {
      const historicalScoredRunners =
        String(race.status || "") === "closed"
          ? buildHistoricalScoredRunners(race)
          : null;

      if (historicalScoredRunners?.length) {
        scoredByRaceId.set(raceId, historicalScoredRunners);
        return;
      }

      scoredByRaceId.set(
        raceId,
        calculateRaceScores({
          activeRace: race,
          races,
          runners,
          horses,
          meetings,
          jockeyProfiles,
        }),
      );
    });

    return scoredByRaceId;
  }, [
    activeRace,
    dayPublishedRaces,
    horses,
    jockeyProfiles,
    meetings,
    predictionSnapshotsByRaceId,
    races,
    runners,
  ]);

  const scoredRunners = useMemo(
    () =>
      activeRace
        ? scoredRunnersByRaceId.get(Number(activeRace.id)) || []
        : [],
    [activeRace, scoredRunnersByRaceId],
  );

  const activeRaceTipEvolution = useMemo(() => {
    if (!activeRace) return [];

    return calculatorTipEvolution
      .filter(
        (entry) =>
          Number(entry.race_id) === Number(activeRace.id),
      )
      .sort(
        (a, b) =>
          new Date(a.changed_at).getTime() -
          new Date(b.changed_at).getTime(),
      );
  }, [activeRace, calculatorTipEvolution]);

  const selectedAuditRunner = useMemo(() => {
    if (selectedAuditRunnerId === null) return null;

    return (
      scoredRunners.find(
        (runner) => Number(runner.id) === Number(selectedAuditRunnerId),
      ) || null
    );
  }, [scoredRunners, selectedAuditRunnerId]);

  const selectedHorseScore = useMemo(() => {
    if (!selectedHorse) return null;
    return (
      scoredRunners.find((runner) => runner.horse_id === selectedHorse.id) ||
      null
    );
  }, [scoredRunners, selectedHorse]);

  const topWinChance = scoredRunners[0] || null;
  const topPlaceChances = [...scoredRunners]
    .sort((a, b) => b.placePercent - a.placePercent)
    .slice(0, 3);
  const calculatorTopThree = scoredRunners.slice(0, 3);
  const activePlaceTerms = activeRace?.place_terms || "top_3";
  const placeBettingDisabled = activePlaceTerms === "win_only";

function placeTermsLabel(value?: string | null) {
  if (value === "win_only") return "Pay 1 Only";
  if (value === "top_2") return "Pay 1 & 2";
  return "Pay 1, 2 & 3";
}

const raceConfidence = useMemo(() => {
  if (!scoredRunners.length) {
    return null;
  }

  const storedConfidence = getStoredRaceConfidence(
    activeRace,
    scoredRunners,
    topWinChance?.track_condition || null,
  );

  if (storedConfidence) {
    return storedConfidence;
  }

  return calculateRaceConfidence(scoredRunners, {
    trackCondition: topWinChance?.track_condition || null,
    raceName: activeRace?.race_name || "",
    placeTerms: activeRace?.place_terms || "top_3",
  });
}, [
  activeRace,
  scoredRunners,
  topWinChance?.track_condition,
  predictionSnapshotsByRaceId,
]);

const tipThresholds = useMemo(
  () =>
    raceConfidence
      ? getCalculatorTipThresholds(raceConfidence, {
          trackCondition: topWinChance?.track_condition || null,
          placeTerms: activeRace?.place_terms || "top_3",
          meetingDate:
            meetings.find(
              (meeting) =>
                Number(meeting.id) === Number(activeRace?.meeting_id),
            )?.meeting_date || null,
        })
      : null,
  [
    activeRace?.meeting_id,
    activeRace?.place_terms,
    meetings,
    raceConfidence,
    topWinChance?.track_condition,
  ],
);

  const activeTopPlaceChance = topPlaceChances[0] || null;

  const activeTopPlaceGap = useMemo(() => {
    if (!activeTopPlaceChance) return 0;

    const secondPlaceChance =
      scoredRunners.find(
        (runner) => Number(runner.id) !== Number(activeTopPlaceChance.id),
      ) || null;

    return secondPlaceChance
      ? roundScore(
          Number(activeTopPlaceChance.score || 0) -
            Number(secondPlaceChance.score || 0),
        )
      : roundScore(Number(activeTopPlaceChance.score || 0));
  }, [activeTopPlaceChance, scoredRunners]);

  const qualifiedTip = useMemo(() => {
    const storedTip = getStoredQualifiedTip(
      activeRace,
      scoredRunners,
      raceConfidence,
    );

    if (storedTip) {
      return storedTip;
    }

    if (String(activeRace?.status || "") === "closed") {
      const hasSnapshot =
        predictionSnapshotsByRaceId.has(Number(activeRace?.id));

      if (hasSnapshot) {
        return null;
      }
    }

    return getQualifiedCalculatorTip(scoredRunners, {
      trackCondition: topWinChance?.track_condition || null,
      raceName: activeRace?.race_name || "",
      placeTerms: activeRace?.place_terms || "top_3",
      meetingDate:
        meetings.find(
          (meeting) =>
            Number(meeting.id) === Number(activeRace?.meeting_id),
        )?.meeting_date || null,
    });
  }, [
    activeRace,
    meetings,
    predictionSnapshotsByRaceId,
    raceConfidence,
    scoredRunners,
    topWinChance?.track_condition,
  ]);
  const activeRaceIndex = activeRace
    ? orderedPublishedRaces.findIndex(
        (race) => Number(race.id) === Number(activeRace.id),
      )
    : -1;

  const previousRace =
    activeRaceIndex > 0 ? orderedPublishedRaces[activeRaceIndex - 1] : null;

  const nextRace =
    activeRaceIndex >= 0 && activeRaceIndex < orderedPublishedRaces.length - 1
      ? orderedPublishedRaces[activeRaceIndex + 1]
      : null;

  function loadRaceById(raceId: number) {
    setSelectedRaceId(String(raceId));
  }
  const activeMeeting = activeRace
    ? meetings.find((item) => item.id === activeRace.meeting_id)
    : undefined;

  const activeSpecialistAlerts = useMemo(
    () =>
      activeRace
        ? buildSetupMatchedSpecialistAlerts({
            race: activeRace,
            meeting: activeMeeting,
            scoredRunners,
            races,
            runners,
            horses,
            meetings,
          })
        : [],
    [
      activeMeeting,
      activeRace,
      horses,
      meetings,
      races,
      runners,
      scoredRunners,
    ],
  );

  const activeRaceEdgeLeaders = useMemo(
    () => buildRaceEdgeLeaders(activeSpecialistAlerts),
    [activeSpecialistAlerts],
  );

  const activeRaceEdgeLeader = activeRaceEdgeLeaders[0] || null;

  const raceConfidenceBoard = useMemo(() => {
    return dayPublishedRaces
      .map((race) => {
        const meeting = meetings.find((item) => item.id === race.meeting_id);

        const scored =
          scoredRunnersByRaceId.get(Number(race.id)) || [];

        const confidence = scored.length
          ? getStoredRaceConfidence(
              race,
              scored,
              meeting?.track_condition || null,
            ) ||
            calculateRaceConfidence(scored, {
              trackCondition: meeting?.track_condition || null,
              placeTerms: race.place_terms || "top_3",
            })
          : null;

        const raceMeeting = meetings.find(
          (item) => Number(item.id) === Number(race.meeting_id),
        );

        const storedQualifiedTip = getStoredQualifiedTip(
          race,
          scored,
          confidence,
        );

        const hasStoredSnapshot =
          String(race.status || "") === "closed" &&
          predictionSnapshotsByRaceId.has(Number(race.id));

        const qualifiedTip =
          storedQualifiedTip ||
          (hasStoredSnapshot
            ? null
            : getQualifiedCalculatorTip(scored, {
                trackCondition:
                  raceMeeting?.track_condition || null,
                raceName: race.race_name || "",
                placeTerms: race.place_terms || "top_3",
                meetingDate:
                  raceMeeting?.meeting_date || null,
              }));

        const calculatorTip = qualifiedTip?.type || "No Bet";

        const specialistAlerts = buildSetupMatchedSpecialistAlerts({
          race,
          meeting: meeting || undefined,
          scoredRunners: scored,
          races,
          runners,
          horses,
          meetings,
        });

        const raceEdgeLeaders = buildRaceEdgeLeaders(specialistAlerts);

        return {
          race,
          meeting,
          fieldSize: scored.length,
          confidence,
          calculatorTip,
          specialistAlerts,
          raceEdgeLeaders,
        };
      })
      .filter((item) => item.confidence)
      .sort(
        (a, b) =>
          Number(b.confidence?.confidencePercent || 0) -
          Number(a.confidence?.confidencePercent || 0),
      );
  }, [
    dayPublishedRaces,
    horses,
    meetings,
    predictionSnapshotsByRaceId,
    races,
    runners,
    scoredRunnersByRaceId,
  ]);

  const filteredRaceConfidenceBoard = useMemo(() => {
    const confidenceFloor =
      minimumConfidence === "all" ? 0 : Number(minimumConfidence);

    return raceConfidenceBoard.filter((item) => {
      const confidencePercent = Number(item.confidence?.confidencePercent || 0);
      const hasCalculatorTip =
        item.calculatorTip === "Win" || item.calculatorTip === "Place";
      const hasSpecialistMatch =
        item.specialistAlerts.length > 0 || item.raceEdgeLeaders.length > 0;

      if (showTipsOnly && !hasCalculatorTip) return false;
      if (showSpecialistsOnly && !hasSpecialistMatch) return false;
      if (confidencePercent < confidenceFloor) return false;

      return true;
    });
  }, [
    minimumConfidence,
    raceConfidenceBoard,
    showSpecialistsOnly,
    showTipsOnly,
  ]);
const importHealthBoard = useMemo(() => {
  return orderedPublishedRaces.map((race) => {
    const meeting = meetings.find(
      (item) => Number(item.id) === Number(race.meeting_id),
    );

    const scored =
      scoredRunnersByRaceId.get(Number(race.id)) || [];

    const runnersWithAudit = scored.filter(
      (runner) => runner.audit?.originalImportedData,
    );

    const allRunnersMissingImportedFormData =
      runnersWithAudit.length > 0 &&
      runnersWithAudit.every((runner) => {
        const imported = runner.audit?.originalImportedData;

        return ![
          imported?.trackRecord,
          imported?.distanceRecord,
          imported?.goodRecord,
          imported?.softRecord,
          imported?.heavyRecord,
          imported?.syntheticRecord,
        ].some((value) => String(value || "").trim());
      });

    return {
      race,
      meeting,
      runnerCount: scored.length,
      auditRunnerCount: runnersWithAudit.length,
      allRunnersMissingImportedFormData,
    };
  });
}, [
  meetings,
  orderedPublishedRaces,
  scoredRunnersByRaceId,
]);

const importHealthWarnings = importHealthBoard.filter(
  (item) => item.allRunnersMissingImportedFormData,
);

const importHealthWarningCount = importHealthWarnings.length;
  const strongestBets = useMemo(() => {
    return dayPublishedRaces
      .map((race) => {
        const scored =
          scoredRunnersByRaceId.get(Number(race.id)) || [];

        if (!scored.length) return null;

        const raceMeeting = meetings.find(
          (item) => Number(item.id) === Number(race.meeting_id),
        );

        const confidenceForRace =
          getStoredRaceConfidence(
            race,
            scored,
            raceMeeting?.track_condition || null,
          ) ||
          calculateRaceConfidence(scored, {
            trackCondition:
              raceMeeting?.track_condition || null,
            raceName: race.race_name || "",
            placeTerms: race.place_terms || "top_3",
          });

        const storedQualifiedTip = getStoredQualifiedTip(
          race,
          scored,
          confidenceForRace,
        );

        const hasStoredSnapshot =
          String(race.status || "") === "closed" &&
          predictionSnapshotsByRaceId.has(Number(race.id));

        const qualifiedTip =
          storedQualifiedTip ||
          (hasStoredSnapshot
            ? null
            : getQualifiedCalculatorTip(scored, {
                trackCondition:
                  raceMeeting?.track_condition || null,
                raceName: race.race_name || "",
                placeTerms: race.place_terms || "top_3",
                meetingDate:
                  raceMeeting?.meeting_date || null,
              }));

        if (!qualifiedTip) return null;

        if (strongestBetMode === "win" && qualifiedTip.type !== "Win")
          return null;
        if (strongestBetMode === "place" && qualifiedTip.type !== "Place")
          return null;

        const selected = qualifiedTip.runner;
        const gap = qualifiedTip.gap;
        const raceConfidenceForRace = qualifiedTip.raceConfidence;
        const existingPublishedTip = calculatorTips.find(
          (tip) => Number(tip.race_runner_id) === Number(selected.id),
        );

        return {
          race,
          top: selected,
          gap,
          raceConfidence: raceConfidenceForRace,
          existingPublishedTip,
qualifiesAsStrongWin: qualifiedTip.qualifiesAsStrongWin,
qualifiesAsStrongPlace: qualifiedTip.qualifiesAsStrongPlace,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const aStrength =
          strongestBetMode === "win"
            ? Number(a.top.score) + Number(a.gap) * 2 + Number(a.top.winPercent)
            : Number(a.top.placePercent) + Number(a.top.score) * 0.35;

        const bStrength =
          strongestBetMode === "win"
            ? Number(b.top.score) + Number(b.gap) * 2 + Number(b.top.winPercent)
            : Number(b.top.placePercent) + Number(b.top.score) * 0.35;

        return bStrength - aStrength;
      });
  }, [
    calculatorTips,
    dayPublishedRaces,
    meetings,
    predictionSnapshotsByRaceId,
    scoredRunnersByRaceId,
    strongestBetMode,
  ]);

  const alertCandidates = useMemo(() => {
    const threshold = Number(alertThreshold);
    if (Number.isNaN(threshold)) return [];

    return scoredRunners.filter((runner) => runner.score >= threshold);
  }, [alertThreshold, scoredRunners]);

  const selectedHorseHistory = useMemo(() => {
    if (!selectedHorse) return [];
    return buildHorseHistory(selectedHorse.id, runners, races, meetings);
  }, [meetings, races, runners, selectedHorse]);

  const fieldSizeLabel =
    scoredRunners.length <= 7
      ? `Small field (${scoredRunners.length})`
      : scoredRunners.length >= 14
        ? `Large field (${scoredRunners.length})`
        : scoredRunners.length >= 11
          ? `Bigger field (${scoredRunners.length})`
          : `Standard field (${scoredRunners.length})`;

  const bettingVerdictLabel = qualifiedTip
    ? qualifiedTip.type === "Win"
      ? "Win Bet"
      : "Place Bet"
    : "No Bet";

  const bettingVerdictSummary = qualifiedTip
    ? qualifiedTip.type === "Win"
      ? "Top pick clears the calculator threshold. Still keep staking disciplined."
      : "Top pick has the strongest profile for running in the minors. Win confidence is moderate."
    : "No runner currently clears the SmartPunt betting threshold for this race.";

  const watchouts = [
    topWinChance?.track_condition
      ? `${topWinChance.track_condition} track requires care`
      : "Track condition not set",
    Number((topWinChance as any)?.barrier || 0) >= 10
      ? `Wide draw for top pick (${(topWinChance as any)?.barrier})`
      : null,
    scoredRunners.length >= 11 ? "Competitive field size" : null,
    activePlaceTerms === "win_only"
      ? "Win-only place terms"
      : activePlaceTerms === "top_2"
        ? "Pay 1 & 2 — place bets need a stronger profile"
        : "Standard place terms",
    raceConfidence?.tier === "Low" ? "Low confidence race" : null,
    activeRaceEdgeLeader
      ? `Specialist edge: ${activeRaceEdgeLeader.horseName}`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Calculator Lab</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
                <Link
                  href="/current-races"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Current Races
                </Link>
                <Link
                  href="/race-archive"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Archive
                </Link>
                <Link
                  href="/admin/calculator-report"
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 backdrop-blur-sm transition hover:bg-amber-500/30"
                >
                  Calculator Report
                </Link>
                <Link
                  href="/admin/power-rating-race-card"
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 backdrop-blur-sm transition hover:bg-amber-500/30"
                >
                  🏆 Power Rating Race Card
                </Link>
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Saved Horses
                </Link>
                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 backdrop-blur-sm transition hover:bg-red-500/30"
                  >
                    Log Out
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  SmartPunt calculator lab
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Admin-only modelling tool for published races, horse-triggered
                  scoring, and race-wide ranking.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">
                  {orderedPublishedRaces.length}{" "}
                  {selectedRaceDayLabel.toLowerCase()} races
                </Badge>
                <Badge tone="blue">{horses.length} saved horses</Badge>
                <Badge tone="amber">No market influence</Badge>
                <Badge tone="green">Auto-saved on publish</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div>
                <h2 className="text-xl font-semibold">
                  Horse-triggered lookup
                </h2>
                <p className="text-sm text-zinc-500">
                  Enter or select a horse. The calculator checks if it is part
                  of a published race, then scores the whole field around it.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Search horse
                </label>
                <div className="mt-2">
                  <input
                    placeholder="Search horse name..."
                    value={search}
 onChange={(e) => {
  setSearch(e.target.value);
  setSelectedRaceId("");
}}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>
              </div>

              {matchingHorses.length > 0 ? (
                <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Matching horses
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {matchingHorses.map((horse) => (
                      <button
                        key={horse.id}
                        type="button"
onClick={() => {
  setSearch(horse.horse_name);
  setSelectedRaceId("");
}}
                        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                          selectedHorse?.id === horse.id
                            ? "bg-black text-amber-300"
                            : "border border-amber-300/40 bg-white text-zinc-800 hover:bg-amber-100"
                        }`}
                      >
                        {horse.horse_name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Or choose a published race
                </label>
                <div className="mt-2">
                  <select
                    value={selectedRaceId}
                    onChange={(e) => setSelectedRaceId(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  >
                    <option value="">Auto-detect from horse</option>
                    {orderedPublishedRaces.map((race) => {
                      const meeting = meetings.find(
                        (item) => item.id === race.meeting_id,
                      );
                      return (
                        <option key={race.id} value={String(race.id)}>
                          {meeting?.meeting_name || "Meeting"} · R
                          {race.race_number} {race.race_name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!previousRace}
                    onClick={() =>
                      previousRace && loadRaceById(previousRace.id)
                    }
                    className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ◀ Previous Race
                  </button>

                  <button
                    type="button"
                    disabled={!nextRace}
                    onClick={() => nextRace && loadRaceById(nextRace.id)}
                    className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next Race ▶
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Alert threshold
                </label>
                <div className="mt-2">
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Later this can trigger alerts to the head tipper for
                  strong-rated runners.
                </p>
              </div>

              {selectedHorse ? (
                <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                    Selected horse snapshot
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-zinc-950">
                    {selectedHorse.horse_name}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-700">
                    Recent form: {formatFormLine(selectedHorseHistory)}
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="overflow-hidden border border-amber-400/40 bg-[#050505] shadow-2xl shadow-amber-950/30">
            <div className="space-y-4 p-4 text-white sm:p-5">
              {activeRace ? (
                <>
                  <div className="rounded-[24px] border border-amber-400/40 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),linear-gradient(135deg,#050505_0%,#111827_52%,#030712_100%)] p-4 shadow-inner shadow-amber-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                          {topWinChance?.meeting_name ||
                            activeMeeting?.meeting_name ||
                            "Meeting"}
                          {topWinChance?.meeting_date ||
                          activeMeeting?.meeting_date
                            ? ` · ${topWinChance?.meeting_date || activeMeeting?.meeting_date}`
                            : ""}
                          {activeRaceIndex >= 0
                            ? ` · Race ${activeRaceIndex + 1} of ${orderedPublishedRaces.length}`
                            : ""}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="rounded-2xl border border-amber-400/30 bg-black/50 px-4 py-3 text-4xl font-black leading-none text-amber-300 shadow-lg shadow-amber-950/30">
                            R{activeRace.race_number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate text-2xl font-black tracking-tight text-white">
                              {activeRace.race_name}
                            </h2>
                            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-zinc-300">
                              <span>{activeRace.distance_m || "—"}m</span>
                              <span>•</span>
                              <span>
                                {topWinChance?.track_condition ||
                                  "No condition set"}
                              </span>
                              <span>•</span>
                              <span>
                                {placeTermsLabel(activeRace.place_terms)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 sm:min-w-[220px]">
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-200">
                            Published
                          </span>
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                            {scoredRunners.length} runners
                          </span>
                        </div>

                        <div className="grid grid-cols-[1fr_64px_1fr] overflow-hidden rounded-2xl border border-amber-400/30 bg-black/45 text-sm font-black uppercase tracking-[0.12em] text-amber-200">
                          <button
                            type="button"
                            disabled={!previousRace}
                            onClick={() =>
                              previousRace && loadRaceById(previousRace.id)
                            }
                            className="px-3 py-3 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            ‹ Prev
                          </button>
                          <div className="border-x border-amber-400/20 px-3 py-3 text-center text-white">
                            {activeRaceIndex >= 0
                              ? `${activeRaceIndex + 1}`
                              : "—"}
                          </div>
                          <button
                            type="button"
                            disabled={!nextRace}
                            onClick={() =>
                              nextRace && loadRaceById(nextRace.id)
                            }
                            className="px-3 py-3 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Next ›
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {calculatorTopThree.length > 0 ? (
                    <div className="rounded-[24px] border border-amber-400/40 bg-[linear-gradient(135deg,#050505_0%,#0b1120_58%,#050505_100%)] p-4 shadow-lg shadow-black/30">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
                            🏆 SmartPunt Calculator Top 3
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-300">
                            Ranked by the live calculator score for this race.
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                          Calculator
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {calculatorTopThree.map((runner, index) => {
                          const isTip =
                            qualifiedTip &&
                            Number(qualifiedTip.runner.id) ===
                              Number(runner.id);

                          const isWinTip = isTip && qualifiedTip.type === "Win";
                          const isPlaceTip =
                            isTip && qualifiedTip.type === "Place";

                          const tipLabel = isWinTip
                            ? "🏆 WIN TIP"
                            : isPlaceTip
                              ? "🥈 PLACE TIP"
                              : "⊘ NO BET";

                          const medalClass = isWinTip
                            ? "border-amber-300 bg-amber-950/80 shadow-xl shadow-amber-400/25"
                            : isPlaceTip
                              ? "border-zinc-200 bg-zinc-800 shadow-xl shadow-zinc-300/20"
                              : index === 0
                                ? "border-zinc-600 bg-zinc-950 shadow-lg shadow-black/30"
                                : index === 1
                                  ? "border-zinc-400/60 bg-zinc-950"
                                  : "border-orange-400/50 bg-zinc-950";

                          const cornerClass = isWinTip
                            ? "from-amber-300"
                            : isPlaceTip
                              ? "from-zinc-200"
                              : index === 1
                                ? "from-zinc-400"
                                : index === 2
                                  ? "from-orange-400"
                                  : "from-zinc-500";

                          const footerClass = isWinTip
                            ? "border-amber-200 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 text-black shadow-lg shadow-amber-400/30"
                            : isPlaceTip
                              ? "border-zinc-100 bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 text-black shadow-lg shadow-zinc-300/20"
                              : "border-zinc-700 bg-zinc-900 text-zinc-400";

                          return (
                            <div
                              key={runner.id}
                              className={`relative overflow-hidden rounded-2xl border px-4 py-4 ${medalClass}`}
                            >
                              <div
                                className={`absolute left-0 top-0 flex h-12 w-12 items-start justify-start bg-gradient-to-br ${cornerClass} to-transparent pl-3 pt-2 text-xl font-black text-black`}
                              >
                                {index + 1}
                              </div>

                              <p className="ml-10 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                                Calculator #{index + 1}
                              </p>

<div className="flex items-center gap-2">
  {runner.runner_number ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 to-amber-500 text-xs font-black text-black">
      {runner.runner_number}
    </span>
  ) : null}

  <p className="font-black text-white">
    {runner.horse_name}
  </p>
</div>

                              <p className="mt-2 text-sm font-semibold text-zinc-300">
                                Score {roundScore(runner.score)} · Win{" "}
                                {runner.winPercent}% · Rank #{runner.rank}
                              </p>

                              <div
                                className={`mt-4 rounded-xl border px-3 py-3 text-center text-base font-black uppercase tracking-[0.14em] ${footerClass}`}
                              >
                                {tipLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {raceConfidence ? (
                    <div className="rounded-[24px] border border-amber-400/40 bg-[linear-gradient(135deg,#050505_0%,#111827_54%,#030712_100%)] p-4 shadow-lg shadow-black/30">
                      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="border-b border-amber-400/20 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
                            Race Confidence
                          </p>
                          <div className="mt-3 flex items-end gap-4">
                            <div>
                              <p className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-6xl font-black leading-none text-transparent">
                                {raceConfidence.confidencePercent}%
                              </p>
                              <p className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-amber-300">
                                {raceConfidence.tier} Confidence
                              </p>
                            </div>
                            <div className="mb-2 h-16 w-28 rounded-t-full border-[12px] border-b-0 border-zinc-700 border-l-amber-400 border-t-amber-400" />
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-300">
                            Why this race scores{" "}
                            {raceConfidence.confidencePercent}%
                          </p>
                          <p className="mt-3 text-lg font-bold leading-8 text-white">
                            {raceConfidence.summary}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-black text-sky-100">
                              Gap +{raceConfidence.gap}
                            </span>
                            <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-100">
                              {raceConfidence.volatility}
                            </span>
                            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-100">
                              Suggested: {qualifiedTip?.type || "No Bet"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-amber-400/20 pt-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                          🎯 SmartPunt Tip Requirements
                        </p>

                        {tipThresholds ? (
                          raceConfidence.tier === "Low" ? (
                            <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
                              Low Confidence race: SmartPunt does not issue Win
                              or Place Tips while race confidence is Low.
                            </p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
                                    Win Tip
                                  </p>

                                  <div className="mt-3 space-y-2 text-sm font-semibold">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-zinc-300">
                                        Score {tipThresholds.minWinScore}+
                                      </span>
                                      <span
                                        className={
                                          Number(topWinChance?.score || 0) >=
                                          Number(
                                            tipThresholds.minWinScore || 999,
                                          )
                                            ? "text-emerald-300"
                                            : "text-rose-300"
                                        }
                                      >
                                        Current{" "}
                                        {roundScore(
                                          Number(topWinChance?.score || 0),
                                        )}{" "}
                                        {Number(topWinChance?.score || 0) >=
                                        Number(tipThresholds.minWinScore || 999)
                                          ? "✓"
                                          : "✗"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-zinc-300">
                                        Gap +{tipThresholds.minWinGap}
                                      </span>
                                      <span
                                        className={
                                          Number(raceConfidence.gap || 0) >=
                                          tipThresholds.minWinGap
                                            ? "text-emerald-300"
                                            : "text-rose-300"
                                        }
                                      >
                                        Current +
                                        {roundScore(
                                          Number(raceConfidence.gap || 0),
                                        )}{" "}
                                        {Number(raceConfidence.gap || 0) >=
                                        tipThresholds.minWinGap
                                          ? "✓"
                                          : "✗"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-zinc-300">
                                        Win {tipThresholds.minWinPercent}%+
                                      </span>
                                      <span
                                        className={
                                          Number(
                                            topWinChance?.winPercent || 0,
                                          ) >= tipThresholds.minWinPercent
                                            ? "text-emerald-300"
                                            : "text-rose-300"
                                        }
                                      >
                                        Current{" "}
                                        {roundScore(
                                          Number(topWinChance?.winPercent || 0),
                                        )}
                                        %{" "}
                                        {Number(
                                          topWinChance?.winPercent || 0,
                                        ) >= tipThresholds.minWinPercent
                                          ? "✓"
                                          : "✗"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-300">
                                    Place Tip
                                  </p>

                                  {tipThresholds.placeBettingAllowed ? (
                                    <div className="mt-3 space-y-2 text-sm font-semibold">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-zinc-300">
                                          Score {tipThresholds.minPlaceScore}+
                                        </span>
                                        <span
                                          className={
                                            Number(
                                              activeTopPlaceChance?.score || 0,
                                            ) >=
                                            Number(
                                              tipThresholds.minPlaceScore ||
                                                999,
                                            )
                                              ? "text-emerald-300"
                                              : "text-rose-300"
                                          }
                                        >
                                          Current{" "}
                                          {roundScore(
                                            Number(
                                              activeTopPlaceChance?.score || 0,
                                            ),
                                          )}{" "}
                                          {Number(
                                            activeTopPlaceChance?.score || 0,
                                          ) >=
                                          Number(
                                            tipThresholds.minPlaceScore || 999,
                                          )
                                            ? "✓"
                                            : "✗"}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-zinc-300">
                                          Gap +{tipThresholds.minPlaceGap}
                                        </span>
                                        <span
                                          className={
                                            activeTopPlaceGap >=
                                            tipThresholds.minPlaceGap
                                              ? "text-emerald-300"
                                              : "text-rose-300"
                                          }
                                        >
                                          Current +{activeTopPlaceGap}{" "}
                                          {activeTopPlaceGap >=
                                          tipThresholds.minPlaceGap
                                            ? "✓"
                                            : "✗"}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-zinc-300">
                                          Place {tipThresholds.minPlacePercent}
                                          %+
                                        </span>
                                        <span
                                          className={
                                            Number(
                                              activeTopPlaceChance?.placePercent ||
                                                0,
                                            ) >= tipThresholds.minPlacePercent
                                              ? "text-emerald-300"
                                              : "text-rose-300"
                                          }
                                        >
                                          Current{" "}
                                          {roundScore(
                                            Number(
                                              activeTopPlaceChance?.placePercent ||
                                                0,
                                            ),
                                          )}
                                          %{" "}
                                          {Number(
                                            activeTopPlaceChance?.placePercent ||
                                              0,
                                          ) >= tipThresholds.minPlacePercent
                                            ? "✓"
                                            : "✗"}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100">
                                      Place betting is blocked for Pay 1 Only
                                      races.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold leading-6 text-zinc-200">
                                {qualifiedTip
                                  ? qualifiedTip.type === "Win"
                                    ? "Verdict: qualifies as a SmartPunt Win Tip."
                                    : "Verdict: qualifies as a SmartPunt Place Tip, but not a Win Tip."
                                  : "Verdict: no runner clears the current SmartPunt tip requirements."}
                              </p>
                            </div>
                          )
                        ) : null}
                      </div>
                      <p className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold leading-6 text-sky-100">
                        ⓘ Race Confidence measures the quality of the betting
                        race, not just the quality of the top-rated horse.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="rounded-[24px] border border-emerald-400/50 bg-zinc-950 p-4 shadow-lg shadow-emerald-500/10">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                        🎯 Betting Verdict
                      </p>
                      <p className="mt-4 text-3xl font-black text-white">
                        {bettingVerdictLabel}
                      </p>
                      <p className="mt-3 text-base font-semibold leading-7 text-emerald-100">
                        {bettingVerdictSummary}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-amber-400/50 bg-zinc-950 p-4 shadow-lg shadow-amber-500/10">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                        ⚠️ Watchouts
                      </p>
                      <div className="mt-4 space-y-2 text-sm font-semibold text-zinc-100">
                        {watchouts.map((watchout) => (
                          <p key={watchout} className="flex gap-2">
                            <span className="text-amber-300">⚠</span>
                            <span>{watchout}</span>
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-rose-400/50 bg-zinc-950 p-4 shadow-lg shadow-rose-500/10">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                        🔔 Alert Candidates
                      </p>
                      <div className="mt-4 space-y-2 text-sm font-semibold text-zinc-100">
                        {alertCandidates.length > 0 ? (
                          alertCandidates.slice(0, 4).map((runner) => (
                            <p key={runner.id}>
                              {runner.horse_name} — Score{" "}
                              {roundScore(runner.score)}
                            </p>
                          ))
                        ) : (
                          <p className="leading-6 text-zinc-200">
                            No runners currently exceed the threshold.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {activeSpecialistAlerts.length > 0 ? (
                    <div className="rounded-[24px] border border-amber-400/30 bg-black/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                            ⭐ Specialist Setup Match
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">
                            Specialist profiles suited to today's race setup.
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100">
                          {activeSpecialistAlerts.length} match
                          {activeSpecialistAlerts.length === 1 ? "" : "es"}
                        </span>
                      </div>

                      {activeRaceEdgeLeader ? (
                        <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                            Race Edge Leader
                          </p>
                          <p className="mt-2 text-xl font-black text-white">
                            {activeRaceEdgeLeader.horseName}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-300">
                            {activeRaceEdgeLeader.signalCount} matching edge
                            signal
                            {activeRaceEdgeLeader.signalCount === 1 ? "" : "s"}
                            {activeRaceEdgeLeader.provenCount > 0
                              ? ` · ${activeRaceEdgeLeader.provenCount} proven`
                              : ""}
                            {activeRaceEdgeLeader.emergingCount > 0
                              ? ` · ${activeRaceEdgeLeader.emergingCount} emerging`
                              : ""}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedHorseScore ? (
                    <div className="rounded-[24px] border border-amber-400/30 bg-black/50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                        Selected Horse Result
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-black text-white">
                            {selectedHorseScore.horse_name}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-zinc-300">
                            {getSelectedHorseSummary(selectedHorseScore)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="green">
                            Win {selectedHorseScore.winPercent}%
                          </Badge>
                          <Badge tone="blue">
                            Place {selectedHorseScore.placePercent}%
                          </Badge>
                          <Badge tone="amber">
                            Rank #{selectedHorseScore.rank}
                          </Badge>
                          <Badge tone="amber">
                            Score {roundScore(selectedHorseScore.score)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[24px] border border-amber-400/30 bg-black/60 p-5 text-sm font-semibold text-zinc-300">
                  No published race found yet for that horse. Use a horse that
                  is loaded into a published race, or pick a published race
                  manually.
                </div>
              )}
            </div>
          </Panel>
        </div>
        <Panel className="mt-6 bg-white/95">
  <div className="p-6 text-zinc-950">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
          Data Safeguard
        </p>
        <h2 className="mt-1 text-xl font-semibold">Import Health</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Checks whether each race contains imported Track, Distance or
          Condition evidence.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Click a race to load it into the Calculator Lab.
        </p>
      </div>

      <Badge tone={importHealthWarningCount > 0 ? "rose" : "green"}>
        {importHealthWarningCount > 0
          ? `${importHealthWarningCount} race${
              importHealthWarningCount === 1 ? "" : "s"
            } to check`
          : "All races healthy"}
      </Badge>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
{importHealthWarnings.map((item) => {


        return (
          <button
            key={item.race.id}
            type="button"
            onClick={() => setSelectedRaceId(String(item.race.id))}
className="rounded-[22px] border border-rose-300 bg-rose-50 p-4 text-left transition hover:border-rose-500 hover:bg-rose-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
<p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
  🔴 Check Import
</p>

                <h3 className="mt-2 font-black text-zinc-950">
                  {item.meeting?.meeting_name || "Meeting"} · R
                  {item.race.race_number}
                </h3>

                <p className="mt-1 text-sm font-semibold text-zinc-700">
                  {item.race.race_name}
                </p>
              </div>

              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600">
                {item.runnerCount} runner
                {item.runnerCount === 1 ? "" : "s"}
              </span>
            </div>

<div className="mt-4 rounded-2xl border border-rose-200 bg-white/70 px-3 py-3">
  <p className="text-sm font-black text-rose-800">
    No Track, Distance or Condition records detected
  </p>
  <p className="mt-1 text-xs leading-5 text-rose-700">
    Every runner in this race is missing the imported evidence used by
    these calculator factors.
  </p>
</div>
          </button>
        );
      })}
    </div>

{importHealthWarnings.length === 0 ? (
  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
    <p className="font-black text-emerald-800">
      ✓ No import issues detected
    </p>
    <p className="mt-1 text-sm text-emerald-700">
      All published races for this day contain relevant imported evidence.
    </p>
  </div>
) : null}

    <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold leading-5 text-sky-800">
      A healthy result means relevant imported evidence exists somewhere in the
      field. Individual horses may still have limited records and can be checked
      through the scoring audit.
    </p>
  </div>
</Panel>
        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Race confidence board</h2>
                <p className="text-sm text-zinc-500">
                  Quick race-day guide showing which races look safest or
                  riskiest to bet into.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Click a race row to load it into the Calculator Lab.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRaceDayFilter("today")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "today"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => setRaceDayFilter("tomorrow")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "tomorrow"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Tomorrow
                </button>

                <button
                  type="button"
                  onClick={() => setRaceDayFilter("yesterday")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "yesterday"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Yesterday
                </button>

                <Badge tone="blue">
                  {filteredRaceConfidenceBoard.length} of{" "}
                  {raceConfidenceBoard.length} races
                </Badge>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200/50 bg-amber-50/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTipsOnly((value) => !value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                    showTipsOnly
                      ? "bg-black text-amber-300"
                      : "border border-amber-300/60 bg-white text-zinc-800 hover:bg-amber-100"
                  }`}
                >
                  Tips Only
                </button>

                <button
                  type="button"
                  onClick={() => setShowSpecialistsOnly((value) => !value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                    showSpecialistsOnly
                      ? "bg-black text-amber-300"
                      : "border border-amber-300/60 bg-white text-zinc-800 hover:bg-amber-100"
                  }`}
                >
                  Specialists Only
                </button>

                <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  Min confidence
                  <select
                    value={minimumConfidence}
                    onChange={(event) =>
                      setMinimumConfidence(event.target.value)
                    }
                    className="rounded-2xl border border-amber-300/60 bg-white px-3 py-2 text-sm font-black text-zinc-900 outline-none transition focus:border-amber-500"
                  >
                    <option value="all">All</option>
                    <option value="60">60%+</option>
                    <option value="65">65%+</option>
                    <option value="70">70%+</option>
                    <option value="75">75%+</option>
                    <option value="80">80%+</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowTipsOnly(false);
                    setShowSpecialistsOnly(false);
                    setMinimumConfidence("all");
                  }}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Reset
                </button>
              </div>

              <p className="mt-3 text-xs font-medium text-zinc-600">
                Filters only change this confidence board. Calculator scoring,
                race confidence, and publishing logic stay unchanged.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Race
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Field
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Terms
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Track
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Insights
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">
                      Calculator Tip
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100 bg-white">
                  {filteredRaceConfidenceBoard.map((item) => (
                    <tr
                      key={item.race.id}
                      onClick={() => setSelectedRaceId(String(item.race.id))}
                      className="cursor-pointer transition hover:bg-amber-50"
                    >
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <span className="inline-flex items-center gap-2">
                          {item.specialistAlerts.length > 0 ? (
                            <span
                              title="Specialist profile match in this race"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-xs font-black text-zinc-950 shadow-sm"
                            >
                              ★
                            </span>
                          ) : null}
                          <span>
                            {item.meeting?.meeting_name || "Meeting"} · R
                            {item.race.race_number} {item.race.race_name}
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {item.fieldSize} runners
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {item.race.place_terms === "win_only"
                          ? "Pay 1 Only"
                          : item.race.place_terms === "top_2"
                            ? "Pay 1 & 2"
                            : "Pay 1, 2 & 3"}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {item.meeting?.track_condition || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            item.confidence?.tier === "Elite" ||
                            item.confidence?.tier === "High"
                              ? "green"
                              : item.confidence?.tier === "Medium"
                                ? "amber"
                                : "rose"
                          }
                        >
                          {item.confidence?.confidencePercent}%{" "}
                          {item.confidence?.tier}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        {item.specialistAlerts.length > 0 ||
                        item.raceEdgeLeaders.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.specialistAlerts.length > 0 ? (
                                <Badge tone="amber">
                                  ★ {item.specialistAlerts.length}
                                </Badge>
                              ) : null}

                              {item.raceEdgeLeaders.length > 0 ? (
                                <Badge tone="blue">
                                  🎯 {item.raceEdgeLeaders[0].signalCount}
                                </Badge>
                              ) : null}
                            </div>

                            <p className="text-xs font-black leading-4 text-zinc-800">
                              {item.raceEdgeLeaders[0]?.horseName ||
                                item.specialistAlerts[0]?.horseName}
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            item.calculatorTip === "No Bet" ? "rose" : "green"
                          }
                        >
                          {item.calculatorTip}
                        </Badge>
                      </td>
                    </tr>
                  ))}

                  {filteredRaceConfidenceBoard.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm font-semibold text-zinc-500"
                      >
                        No races match those filters. Try lowering the
                        confidence level or turning off a toggle.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {raceConfidenceBoard.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No races match this day filter yet.
              </p>
            ) : null}

            {raceConfidenceBoard.some(
              (item) => item.specialistAlerts.length > 0,
            ) ? (
              <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-800">
                      Specialist Alerts
                    </p>
                    <h3 className="mt-2 text-lg font-black text-zinc-950">
                      Race setup matches a proven or emerging profile
                    </h3>
                    <p className="mt-1 text-sm font-bold text-zinc-700">
                      Race Edge Leader shows the runner with the strongest stack
                      of setup-matched signals.
                    </p>
                  </div>
                  <Badge tone="amber">★ race table flag</Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {raceConfidenceBoard
                    .filter((item) => item.specialistAlerts.length > 0)
                    .slice(0, 6)
                    .map((item) => (
                      <button
                        key={item.race.id}
                        type="button"
                        onClick={() => setSelectedRaceId(String(item.race.id))}
                        className="rounded-2xl border border-amber-200 bg-white p-4 text-left transition hover:border-amber-400 hover:bg-amber-50"
                      >
                        <p className="text-sm font-black text-zinc-950">
                          ★ {item.meeting?.meeting_name || "Meeting"} · R
                          {item.race.race_number} {item.race.race_name}
                        </p>
                        {item.raceEdgeLeaders[0] ? (
                          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">
                              🎯 Race Edge Leader
                            </p>
                            <p className="mt-1 text-sm font-black text-zinc-950">
                              {item.raceEdgeLeaders[0].horseName} ·{" "}
                              {item.raceEdgeLeaders[0].signalCount} signal
                              {item.raceEdgeLeaders[0].signalCount === 1
                                ? ""
                                : "s"}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-3 space-y-2">
                          {item.specialistAlerts.slice(0, 3).map((alert) => (
                            <div
                              key={`${item.race.id}-${alert.horseName}-${alert.label}`}
                            >
                              <p className="text-sm font-black text-zinc-900">
                                {alert.horseName} — {alert.label}
                              </p>
                              <p className="text-xs leading-5 text-zinc-600">
                                {alert.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No specialist setup matches found for this race filter yet.
              </p>
            )}
          </div>
        </Panel>
        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  🔥{" "}
                  {raceDayFilter === "today"
                    ? "Today’s"
                    : raceDayFilter === "tomorrow"
                      ? "Tomorrow’s"
                      : "Yesterday’s"}{" "}
                  strongest {strongestBetMode === "win" ? "win" : "place"} bets
                </h2>

                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">
                    Highest-rated calculator opportunities across{" "}
                    {raceDayFilter === "today"
                      ? "today’s published races"
                      : raceDayFilter === "tomorrow"
                        ? "tomorrow’s published races"
                        : "yesterday’s published races"}
                    .
                  </p>

                  <p className="text-xs text-zinc-500">
                    Win and place tip requirements are dynamic. They adjust
                    automatically based on each race's confidence, track
                    condition, field shape and place terms. Select a race below
                    to see the exact qualification thresholds and why a horse
                    did or did not qualify as a SmartPunt tip.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRaceDayFilter("today")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "today"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => setRaceDayFilter("tomorrow")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "tomorrow"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Tomorrow
                </button>

                <button
                  type="button"
                  onClick={() => setRaceDayFilter("yesterday")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    raceDayFilter === "yesterday"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Yesterday
                </button>

                <span className="mx-1 hidden h-8 w-px bg-zinc-200 sm:block" />

                <button
                  type="button"
                  onClick={() => setStrongestBetMode("win")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    strongestBetMode === "win"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Win
                </button>

                <button
                  type="button"
                  onClick={() => setStrongestBetMode("place")}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    strongestBetMode === "place"
                      ? "bg-black text-amber-300"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Place
                </button>

                <Badge tone="green">Top {strongestBets.length}</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {strongestBets.map((item, index) => (
                <div
                  key={`${item.race.id}-${item.top.id}-${strongestBetMode}`}
                  className="rounded-[24px] border border-amber-200/30 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-500">
                        #{index + 1} strongest play
                      </p>

                      <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                        {item.top.horse_name}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-600">
                        {item.top.meeting_name} · R{item.race.race_number}{" "}
                        {item.race.race_name}
                      </p>
                    </div>

                    <Badge tone="green">
                      Score {roundScore(item.top.score)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="green">Win {item.top.winPercent}%</Badge>

                    <Badge tone="blue">Place {item.top.placePercent}%</Badge>

                    <Badge tone="amber">Gap +{item.gap}</Badge>

                    <Badge tone="slate">
                      Race confidence {item.raceConfidence.confidencePercent}%
                    </Badge>

                    <Badge
                      tone={
                        strongestBetMode === "win"
                          ? item.qualifiesAsStrongWin
                            ? "green"
                            : "amber"
                          : item.qualifiesAsStrongPlace
                            ? "green"
                            : "blue"
                      }
                    >
                      {strongestBetMode === "win"
                        ? item.qualifiesAsStrongWin
                          ? "Strong Win"
                          : "Win"
                        : item.qualifiesAsStrongPlace
                          ? "Strong Place"
                          : "Place"}
                    </Badge>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/80 p-4">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        ["Form", item.top.components.recentForm],
                        ["Distance", item.top.components.distance],
                        ["Track", item.top.components.track],
                        ["Barrier", item.top.components.barrier],
                      ].map(([label, score]) => (
                        <div
                          key={String(label)}
                          className="rounded-2xl bg-zinc-50 p-3"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            {label}
                          </p>

                          <p className="mt-2 text-sm font-bold text-zinc-900">
                            {roundScore(Number(score))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    action={publishSmartPuntCalculatorTipAction}
                    className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <input
                      type="hidden"
                      name="meeting_id"
                      value={item.race.meeting_id}
                    />
                    <input type="hidden" name="race_id" value={item.race.id} />
                    <input
                      type="hidden"
                      name="race_runner_id"
                      value={item.top.id}
                    />
                    <input
                      type="hidden"
                      name="horse_id"
                      value={item.top.horse_id}
                    />
                    <input
                      type="hidden"
                      name="race"
                      value={`${item.top.meeting_name} R${item.race.race_number} ${item.race.race_name}`}
                    />
                    <input
                      type="hidden"
                      name="horse"
                      value={item.top.horse_name}
                    />
                    <input
                      type="hidden"
                      name="bet_type"
                      value={
                        strongestBetMode === "win"
                          ? item.qualifiesAsStrongWin
                            ? "Strong Win"
                            : "Win"
                          : item.qualifiesAsStrongPlace
                            ? "Strong Place"
                            : "Place"
                      }
                    />
                    <input
                      type="hidden"
                      name="confidence"
                      value={item.raceConfidence.tier}
                    />
                    <input
                      type="hidden"
                      name="score"
                      value={roundScore(item.top.score)}
                    />
                    <input
                      type="hidden"
                      name="win_percent"
                      value={item.top.winPercent}
                    />
                    <input
                      type="hidden"
                      name="place_percent"
                      value={item.top.placePercent}
                    />
                    <input type="hidden" name="race_gap" value={item.gap} />
                    <input
                      type="hidden"
                      name="race_confidence_percent"
                      value={item.raceConfidence.confidencePercent}
                    />
                    <input
                      type="hidden"
                      name="race_confidence_tier"
                      value={item.raceConfidence.tier}
                    />
                    {item.existingPublishedTip ? (
                      <div className="mb-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">
                              Shared with subscribers
                            </p>

                            <p className="mt-1 text-xs text-emerald-700">
                              This calculator signal has already been published.
                            </p>
                          </div>

                          <Badge tone="green">Published</Badge>
                        </div>
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        name="send_notification"
                        value="true"
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      Email subscribers
                    </label>

                    <button
                      type="submit"
                      disabled={Boolean(item.existingPublishedTip)}
                      className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        item.existingPublishedTip
                          ? "cursor-not-allowed bg-emerald-100 text-emerald-700"
                          : "bg-zinc-950 text-amber-300 hover:bg-black"
                      }`}
                    >
                      {item.existingPublishedTip
                        ? "Already Published"
                        : "Publish SmartPunt Calculator Tip"}
                    </button>
                  </form>
                </div>
              ))}

              {strongestBets.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 lg:col-span-2">
                  No qualifying {strongestBetMode} plays for this filter.
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Field scoring</h2>
                <p className="text-sm text-zinc-500">
                  This version scores recent form, distance, track, conditions,
                  barrier, effective weight, jockey, and trainer. Market has
                  been removed completely.
                </p>
              </div>
              <Badge tone="green">{scoredRunners.length} ranked</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {scoredRunners.length > 0 ? (
                scoredRunners.map((runner) => {
                  const isSelected = selectedHorse?.id === runner.horse_id;

                  return (
                    <div
                      key={runner.id}
                      className={`rounded-[24px] border p-5 shadow-sm ${
                        isSelected
                          ? "border-amber-300/50 bg-amber-50"
                          : "border-amber-200/30 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">
                            Rank #{runner.rank}
                          </p>
                          <h3 className="mt-1 text-xl font-bold text-zinc-950">
                            {runner.horse_name}
                          </h3>
                          <p className="mt-2 text-sm text-zinc-600">
                            Jockey: {runner.jockey_name || "—"} · Barrier:{" "}
                            {runner.barrier ?? "—"} · Weight:{" "}
                            {runner.weight_kg ?? "—"}
                            {runner.effectiveWeight !== null
                              ? ` · Effective: ${runner.effectiveWeight}kg`
                              : ""}
                          </p>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setRaceDayFilter("today")}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              raceDayFilter === "today"
                                ? "bg-zinc-950 text-amber-300"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            Today
                          </button>

                          <button
                            type="button"
                            onClick={() => setRaceDayFilter("tomorrow")}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              raceDayFilter === "tomorrow"
                                ? "bg-zinc-950 text-amber-300"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            Tomorrow
                          </button>

                          <button
                            type="button"
                            onClick={() => setRaceDayFilter("yesterday")}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              raceDayFilter === "yesterday"
                                ? "bg-zinc-950 text-amber-300"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            Yesterday
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="green">Win {runner.winPercent}%</Badge>
                          <Badge tone="blue">
                            Place {runner.placePercent}%
                          </Badge>
                          <Badge tone="amber">{runner.verdict}</Badge>
                          <Badge tone="slate">
                            Score {roundScore(runner.score)}
                          </Badge>
                          {runner.audit ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAuditRunnerId(Number(runner.id))
                              }
                              className="rounded-full border border-amber-300/40 bg-zinc-950 px-3 py-1 text-xs font-bold text-amber-200 shadow-sm transition hover:bg-black hover:text-amber-100"
                            >
                              🔬 Audit
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-8">
                        {[
                          ["Form", runner.components.recentForm],
                          ["Distance", runner.components.distance],
                          ["Track", runner.components.track],
                          ["Conditions", runner.components.condition],
                          ["Barrier", runner.components.barrier],
                          ["Weight", runner.components.weight],
                          ["Jockey", runner.components.jockey],
                          ["Trainer", runner.components.trainer],
                        ].map(([label, score]) => (
                          <div
                            key={String(label)}
                            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              {label}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {roundScore(Number(score))}
                            </p>
                          </div>
                        ))}
                      </div>

                      {runner.form_last_6 || runner.form_last_3 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Recent form snapshot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_6 || runner.form_last_3}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  Once a published race is selected or auto-detected from a
                  searched horse, the field rankings will appear here.
                </div>
              )}
            </div>
          </div>
        </Panel>

<Panel className="mt-6 overflow-hidden !border-zinc-700 !bg-zinc-950">
  <details
    open
    className="group bg-[linear-gradient(135deg,#09090b_0%,#111827_55%,#09090b_100%)] text-white"
  >
            <summary className="cursor-pointer list-none px-5 py-5 text-white sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                    SmartPunt Tip History
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Calculator evolution for this race
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-400">
                    Shows each recorded change to the selected runner, tip,
                    score, gap and race confidence.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                    {activeRaceTipEvolution.length} state
                    {activeRaceTipEvolution.length === 1 ? "" : "s"}
                  </span>

                  <span className="text-xl text-amber-300 transition group-open:rotate-180">
                    ▾
                  </span>
                </div>
              </div>
            </summary>

<div className="border-t border-zinc-700 bg-black/20 px-5 pb-6 pt-5 sm:px-6">
              {activeRace ? (
                activeRaceTipEvolution.length > 0 ? (
                  <div className="space-y-4">
                    {activeRaceTipEvolution.map((entry, index) => {
                      const reasons = getEvolutionReasons(
                        entry.change_reasons_json,
                      );

                      const previousTip =
                        entry.previous_tip || "No previous state";
                      const newTip = entry.new_tip || "No Bet";

                      const selectedRunner = runners.find(
                        (runner) =>
                          Number(runner.id) ===
                          Number(
                            entry.new_runner_id ||
                              entry.runner_id,
                          ),
                      );

                      const selectedHorse = horses.find(
                        (horse) =>
                          Number(horse.id) ===
                          Number(
                            entry.new_horse_id ||
                              entry.horse_id ||
                              selectedRunner?.horse_id,
                          ),
                      );

                      const horseName =
                        selectedHorse?.horse_name ||
                        (selectedRunner as any)?.horse_name ||
                        "No selected runner";

                      return (
                        <div
                          key={entry.id}
                          className="relative rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 text-sm font-black text-amber-200">
                                {index + 1}
                              </div>

                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                                  {formatEvolutionTime(entry.changed_at)}
                                </p>

                                <p className="mt-2 text-lg font-black text-white">
                                  {previousTip}{" "}
                                  <span className="px-1 text-amber-300">→</span>{" "}
                                  {newTip}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-zinc-300">
                                  {horseName}
                                </p>
                              </div>
                            </div>

                            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-black text-sky-200">
                              {getEvolutionReasonLabel(entry.reason_code)}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                                Score
                              </p>
                              <p className="mt-1 font-black text-white">
                                {entry.previous_score ?? "—"} →{" "}
                                {entry.new_score ?? "—"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                                Gap
                              </p>
                              <p className="mt-1 font-black text-white">
                                {entry.previous_gap ?? "—"} →{" "}
                                {entry.new_gap ?? "—"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                                Confidence
                              </p>
                              <p className="mt-1 font-black text-white">
                                {entry.previous_confidence_percent ?? "—"}%
                                {" → "}
                                {entry.new_confidence_percent ?? "—"}%
                              </p>
                              <p className="mt-1 text-xs font-semibold text-zinc-400">
                                {entry.previous_confidence_tier || "—"} →{" "}
                                {entry.new_confidence_tier || "—"}
                              </p>
                            </div>
                          </div>

                          {reasons.length > 0 ? (
                            <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                                Why it changed
                              </p>

                              <div className="mt-2 space-y-1.5">
                                {reasons.map((reason, reasonIndex) => (
                                  <p
                                    key={`${entry.id}-${reasonIndex}`}
                                    className="text-sm font-semibold text-zinc-200"
                                  >
                                    • {reason}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {entry.scoring_version ? (
                            <p className="mt-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                              {entry.scoring_version}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center">
                    <p className="font-black text-zinc-200">
                      No tip history has been recorded for this race yet.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-500">
                      A first state will appear after this race next passes
                      through the calculator snapshot process.
                    </p>
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center text-sm font-semibold text-zinc-500">
                  Select a published race to view its calculator history.
                </div>
              )}
            </div>
          </details>
        </Panel>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What this version adds</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Market removed completely</p>
                <p>• New v2 weighted SmartPunt score</p>
                <p>• Distance-aware barrier logic</p>
                <p>• Flemington wide-barrier exception</p>
                <p>• Effective weight using apprentice claim</p>
                <p>• Jockey and trainer history</p>
                <p>• Automatic prediction snapshots on publish</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Scoring weights v2</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Recent form: 26%</p>
                <p>• Barrier: 16%</p>
                <p>• Distance: 12%</p>
                <p>• Track: 9%</p>
                <p>• Condition: 8%</p>
                <p>• Weight / claim: 8%</p>
                <p>• Jockey: 8%</p>
                <p>• Trainer: 5%</p>
                <p>• Consistency: 8%</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Still to come</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Attach actual results to predictions</p>
                <p>• Daily calculator report</p>
                <p>• Running style</p>
                <p>• Speed map</p>
                <p>• Better place modelling</p>
                <p>• Subscriber calculator flow</p>
                <p>• My Active Tips integration</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {selectedAuditRunner?.audit ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close scoring audit"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedAuditRunnerId(null)}
          />

          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-amber-300/30 bg-[#070707] text-white shadow-2xl shadow-black/60">
            <div className="sticky top-0 z-10 border-b border-amber-300/20 bg-black/90 px-5 py-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                    SmartPunt Scoring Audit
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                    {selectedAuditRunner.audit.horseName}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Why did this horse score{" "}
                    {roundScore(selectedAuditRunner.audit.overall.score)}?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAuditRunnerId(null)}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-[28px] border border-amber-300/30 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,#111827_0%,#050505_80%)] p-5 shadow-xl shadow-amber-950/25">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                      Final Score
                    </p>
                    <p className="mt-2 text-3xl font-black text-amber-300">
                      {roundScore(selectedAuditRunner.audit.overall.score)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                      Base Score
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {roundScore(selectedAuditRunner.audit.overall.baseScore)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                      Power Adj.
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {roundScore(
                        selectedAuditRunner.audit.overall.powerAdjustment,
                      )}
                    </p>
                  </div>
                </div>

                {selectedAuditRunner.audit.overall
                  .overconfidenceDampenerApplied ? (
                  <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    Overconfidence dampener was applied to this final score.
                  </p>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-sky-300/25 bg-sky-500/10 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
                    1. Raw Stored Input Data
                  </p>
                  <h3 className="mt-2 text-lg font-black text-white">
                    Values available before evidence selection
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-300">
                    These are the runner and horse-master values stored before
                    the calculator chooses which evidence to use.
                  </p>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                    Current Race Runner
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                      [
                        "Recent Form",
                        selectedAuditRunner.audit.rawStoredData.runnerRecentForm,
                      ],
                      [
                        "Distance Record",
                        selectedAuditRunner.audit.rawStoredData
                          .runnerDistanceRecord,
                      ],
                      [
                        "Track Record",
                        selectedAuditRunner.audit.rawStoredData
                          .runnerTrackRecord,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/10 bg-black/40 p-4"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                          {label}
                        </p>
                        <p className="mt-2 break-words text-sm font-bold text-white">
                          {value || "Not supplied"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                    Horse Master Record
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      [
                        "Recent Form",
                        selectedAuditRunner.audit.rawStoredData.horseRecentForm,
                      ],
                      [
                        "Distance Record",
                        selectedAuditRunner.audit.rawStoredData
                          .horseDistanceRecord,
                      ],
                      [
                        "Track Record",
                        selectedAuditRunner.audit.rawStoredData.horseTrackRecord,
                      ],
                      [
                        "Good Record",
                        selectedAuditRunner.audit.rawStoredData.goodRecord,
                      ],
                      [
                        "Soft Record",
                        selectedAuditRunner.audit.rawStoredData.softRecord,
                      ],
                      [
                        "Heavy Record",
                        selectedAuditRunner.audit.rawStoredData.heavyRecord,
                      ],
                      [
                        "Synthetic Record",
                        selectedAuditRunner.audit.rawStoredData.syntheticRecord,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/10 bg-black/40 p-4"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                          {label}
                        </p>
                        <p className="mt-2 break-words text-sm font-bold text-white">
                          {value || "Not supplied"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                      2. Score Calculation
                    </p>
                    <h3 className="mt-2 text-lg font-black text-white">
                      Component Breakdown
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Each section shows the score, data support level, and the
                      key evidence used.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {Object.values(selectedAuditRunner.audit.sections).map(
                    (section: any) => (
                      <div
                        key={section.label}
                        className="rounded-3xl border border-white/10 bg-black/45 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1 h-3 w-3 rounded-full ${getAuditDotClass(section.status)}`}
                            />
                            <div>
                              <p className="text-base font-black text-white">
                                {section.label}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-zinc-300">
                                {section.summary}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-amber-300">
                              {roundScore(section.score)}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getAuditStatusClass(section.status)}`}
                            >
                              {getAuditStatusLabel(section.status)}
                            </span>
                          </div>
                        </div>

                        {section.details?.length ? (
                          <div className="mt-4 grid gap-2">
                            {section.details
                              .slice(0, 6)
                              .map((detail: string) => (
                                <div
                                  key={detail}
                                  className="rounded-2xl border border-white/5 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-zinc-300"
                                >
                                  {detail}
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-300/25 bg-amber-500/10 p-5">
                <h3 className="text-lg font-black text-amber-100">
                  Decision Log
                </h3>
                <div className="mt-4 space-y-2">
                  {selectedAuditRunner.audit.decisionLog.length ? (
                    selectedAuditRunner.audit.decisionLog.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-amber-300/15 bg-black/35 px-3 py-2 text-sm text-amber-50"
                      >
                        ✓ {item}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-amber-300/15 bg-black/35 px-3 py-2 text-sm text-amber-50">
                      No audit decisions were recorded for this runner.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-300/25 bg-emerald-500/10 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    3. Original Imported Data
                  </p>
                  <h3 className="mt-2 text-lg font-black text-white">
                    Frozen import source
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-300">
                    These values belong to this exact race entry and do not
                    change when the horse-master record is updated later.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      "Runner Number",
                      selectedAuditRunner.audit.originalImportedData
                        .runnerNumber,
                      "available",
                    ],
                    [
                      "Horse",
                      selectedAuditRunner.audit.originalImportedData.horseName,
                      "available",
                    ],
                    [
                      "Barrier",
                      selectedAuditRunner.audit.originalImportedData.barrier,
                      "available",
                    ],
                    [
                      "Weight",
                      selectedAuditRunner.audit.originalImportedData.weightKg !==
                      null
                        ? `${selectedAuditRunner.audit.originalImportedData.weightKg}kg`
                        : null,
                      "available",
                    ],
                    [
                      "Market",
                      selectedAuditRunner.audit.originalImportedData
                        .marketPrice !== null
                        ? `$${Number(
                            selectedAuditRunner.audit.originalImportedData
                              .marketPrice,
                          ).toFixed(2)}`
                        : null,
                      "available",
                    ],
                    [
                      "Form",
                      selectedAuditRunner.audit.originalImportedData.recentForm,
                      selectedAuditRunner.audit.sections.recentForm.status ===
                      "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Track",
                      selectedAuditRunner.audit.originalImportedData.trackRecord,
                      selectedAuditRunner.audit.sections.track.status ===
                      "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Distance",
                      selectedAuditRunner.audit.originalImportedData
                        .distanceRecord,
                      selectedAuditRunner.audit.sections.distance.status ===
                      "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Good",
                      selectedAuditRunner.audit.originalImportedData.goodRecord,
                      selectedAuditRunner.track_condition?.toLowerCase().startsWith(
                        "good",
                      ) &&
                      selectedAuditRunner.audit.sections.condition.status ===
                        "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Soft",
                      selectedAuditRunner.audit.originalImportedData.softRecord,
                      selectedAuditRunner.track_condition?.toLowerCase().startsWith(
                        "soft",
                      ) &&
                      selectedAuditRunner.audit.sections.condition.status ===
                        "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Heavy",
                      selectedAuditRunner.audit.originalImportedData.heavyRecord,
                      selectedAuditRunner.track_condition?.toLowerCase().startsWith(
                        "heavy",
                      ) &&
                      selectedAuditRunner.audit.sections.condition.status ===
                        "fallback"
                        ? "used"
                        : "available",
                    ],
                    [
                      "Synthetic",
                      selectedAuditRunner.audit.originalImportedData
                        .syntheticRecord,
                      selectedAuditRunner.track_condition
                        ?.toLowerCase()
                        .startsWith("synthetic") &&
                      selectedAuditRunner.audit.sections.condition.status ===
                        "fallback"
                        ? "used"
                        : "available",
                    ],
                  ].map(([label, rawValue, status]) => {
                    const value =
                      rawValue !== null &&
                      rawValue !== undefined &&
                      String(rawValue).trim() !== ""
                        ? String(rawValue)
                        : null;

                    const displayStatus = value ? status : "missing";

                    return (
                      <div
                        key={String(label)}
                        className="rounded-2xl border border-white/10 bg-black/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            {label}
                          </p>

                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
                              displayStatus === "used"
                                ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-200"
                                : displayStatus === "missing"
                                  ? "border-red-300/35 bg-red-500/15 text-red-200"
                                  : "border-zinc-400/25 bg-zinc-500/10 text-zinc-300"
                            }`}
                          >
                            {displayStatus === "used"
                              ? "Used"
                              : displayStatus === "missing"
                                ? "Missing"
                                : "Available"}
                          </span>
                        </div>

                        <p className="mt-2 break-words text-sm font-bold text-white">
                          {value || "Not supplied"}
                        </p>
                      </div>
                    );
                  })}
                </div>

<div className="mt-4 grid gap-3 sm:grid-cols-2">
  <div className="rounded-2xl border border-emerald-300/20 bg-black/35 px-4 py-3">
    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
      Imported
    </p>
    <p className="mt-2 text-sm font-bold text-white">
      {formatImportedAt(
        selectedAuditRunner.audit.originalImportedData.importedAt,
      )}
    </p>
  </div>

  <div className="rounded-2xl border border-emerald-300/20 bg-black/35 px-4 py-3">
    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
      Imported By
    </p>
    <p className="mt-2 text-sm font-bold text-white">
      👤{" "}
      {selectedAuditRunner.audit.originalImportedData.importedBy ||
        "Not recorded"}
    </p>
  </div>
</div>

                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-3 py-1.5 text-emerald-200">
                    Green — used in this score
                  </span>
                  <span className="rounded-full border border-zinc-400/25 bg-zinc-500/10 px-3 py-1.5 text-zinc-300">
                    Grey — imported but not selected
                  </span>
                  <span className="rounded-full border border-red-300/35 bg-red-500/15 px-3 py-1.5 text-red-200">
                    Red — not supplied
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
