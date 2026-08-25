"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { addUserBetAction } from "@/lib/actions";
import VaultDoorIcon from "@/components/vault-door-icon";
import type { VaultLiveMatch } from "@/lib/vault-matching";
import {
  buildHorseHistory,
  calculateRaceConfidence,
  calculateRaceScores,
  getCalculatorTipThresholds,
  getQualifiedCalculatorTip,
  roundScore,
  type Horse,
  type JockeyProfile,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";

type CalculatorTip = {
  id: number;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  bet_type: string | null;
  status: string | null;
  published_at: string | null;
};

type CalculatorPrediction = {
  id: number;
  race_id: number;
  runner_id: number;
  horse_id: number;
  scoring_version?: string | null;
  score: number | string;
  rank: number;
  win_percent: number | string;
  place_percent: number | string;
  recent_form_score: number | string;
  distance_score: number | string;
  track_score: number | string;
  condition_score: number | string;
  barrier_score: number | string;
  weight_score: number | string;
  jockey_score: number | string;
  trainer_score: number | string;
  predicted_at?: string | null;
  finishing_position?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  is_smartpunt_tip?: boolean | null;
  smartpunt_tip_type?: string | null;
  race_confidence_percent?: number | string | null;
  race_confidence_tier?: string | null;
  suggested_bet?: string | null;
};

type OfficialTip = {
  id: number;
  meeting_id?: number | null;
  race_id?: number | null;
  horse_id?: number | null;
  race_runner_id?: number | null;
  race?: string | null;
  horse?: string | null;
  horse_name?: string | null;
  type?: string | null;
  bet_type?: string | null;
  tip_type?: string | null;
  confidence?: string | null;
  note?: string | null;
  tip_angle?: string | null;
  commentary?: string | null;
  status?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};
type WatchSuggestion = {
  id: number;
  meeting_id?: number | null;
  race_id?: number | null;
  race_runner_id?: number | null;
  horse_id?: number | null;
  race?: string | null;
  horse?: string | null;
  label?: string | null;
  commentary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type GetOnEarlyBet = {
  id: number;
  horse?: string | null;
  meeting?: string | null;
  race_number?: number | null;
  race_date?: string | null;
  bet_type?: string | null;
  odds?: string | null;
};
type MaverickExoticTip = {
  id: number;
  race_id: number;
  bet_type: "quinella" | "trifecta";
  mode?: "all_ways" | "positional" | null;
  selections?: Array<{
    race_runner_id?: number | null;
    horse_id?: number | null;
    horse?: string | null;
    runner_number?: number | null;
    positions?: number[];
  }> | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type UserBet = {
  id: number;
  source: string | null;
  suggested_tip_id?: number | null;
  calculator_tip_id?: number | null;
  race_id?: number | null;
  race_runner_id?: number | null;
  horse_id?: number | null;
  horse?: string | null;
  race?: string | null;
  bet_type?: string | null;
  odds_taken?: number | string | null;
  stake_points?: number | string | null;
  win_odds_taken?: number | string | null;
  place_odds_taken?: number | string | null;
  win_stake_points?: number | string | null;
  place_stake_points?: number | string | null;
  settled_at?: string | null;
};

type SpecialistAlert = {
  horseName: string;
  label: string;
  detail: string;
  strength: "proven" | "emerging";
};

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

  return {
    runs: runs.length,
    wins,
    places,
    placeRate: runs.length ? places / runs.length : 0,
  };
}

function formatSpecialistPlaceRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function placeTermsLabel(value?: string | null) {
  if (value === "win_only") return "Pay 1 Only";
  if (value === "top_2") return "Pay 1 & 2";
  return "Pay 1, 2 & 3";
}

function formatStartTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatOfficialTipType(tip?: OfficialTip | null) {
  const rawValue = String(
tip?.type || tip?.bet_type || tip?.tip_type || "Maverick Tip",
  )
    .replace(/_/g, " ")
    .trim();

  const value = rawValue.toLowerCase();

  if (value === "win") return "Win";
  if (value === "place") return "Place";
  if (value === "each way" || value === "eachway") return "Each Way";
  if (value === "all up" || value === "allup") return "All Up";

  return (
    rawValue
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
.join(" ") || "Maverick Tip"
  );
}

function getStarRating(score?: number | null) {
  const value = Number(score || 0);

  if (value >= 85) return 5;
  if (value >= 70) return 4;
  if (value >= 55) return 3;
  if (value >= 40) return 2;
  if (value >= 20) return 1;

  return 0;
}

function ScoreStars({ score }: { score?: number | null }) {
  const filled = getStarRating(score);

  return (
    <span
      aria-label={`${filled} out of 5 stars`}
      title={`${roundScore(Number(score || 0))}/100`}
      className="inline-flex items-center gap-0.5 whitespace-nowrap"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={index < filled ? "text-amber-300" : "text-zinc-700"}
        >
          ★
        </span>
      ))}
    </span>
  );
}


function formatOdds(value?: number | string | null) {
  const numberValue = Number(value || 0);

  if (!numberValue || Number.isNaN(numberValue)) return "—";

  return numberValue.toFixed(2).replace(/\.00$/, "");
}

function formatFinishingPosition(value?: number | null) {
  const position = Number(value || 0);

  if (!position) return null;

  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";

  return `${position}th`;
}

function hiddenValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function TipAcceptanceControl({
  tipKey,
  activeKey,
  setActiveKey,
  activeBet,
  isSaving,
  formAction,
  hiddenFields,
  buttonLabel = "Accept Tip",
}: {
  tipKey: string;
  activeKey: string | null;
  setActiveKey: (value: string | null) => void;
  activeBet?: UserBet | null;
  isSaving: boolean;
  formAction: (formData: FormData) => void;
  hiddenFields: Record<string, unknown>;
  buttonLabel?: string;
}) {
  const isOpen = activeKey === tipKey;
  const betType = String(hiddenFields.bet_type || "Win")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");

  const isEachWay =
    betType === "each way" ||
    betType === "eachway" ||
    betType.includes("each way");

  if (activeBet) {
    const activeBetType = String(activeBet.bet_type || "").toLowerCase();
    const activeIsEachWay =
      activeBetType === "each way" ||
      activeBetType === "eachway" ||
      activeBetType.includes("each way");

    return (
      <div className="mt-3 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
          🟢 On My Tips
        </p>

        {activeIsEachWay ? (
          <div className="mt-2 space-y-1 text-[11px] font-semibold text-emerald-50/85">
            <p>
              Win: {formatOdds(activeBet.win_odds_taken)} odds · $
              {Number(activeBet.win_stake_points || 0).toFixed(2)}
            </p>
            <p>
              Place: {formatOdds(activeBet.place_odds_taken)} odds · $
              {Number(activeBet.place_stake_points || 0).toFixed(2)}
            </p>
            <p className="font-black text-emerald-100">
              Total stake: ${Number(activeBet.stake_points || 0).toFixed(2)}
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-[11px] font-semibold text-emerald-50/85">
            <p>Odds taken: {formatOdds(activeBet.odds_taken)}</p>
            <p>
              Stake: ${Number(activeBet.stake_points || 0).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setActiveKey(tipKey)}
        className="mt-3 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-500/25"
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 rounded-2xl border border-emerald-300/25 bg-black/45 p-3"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input
          key={name}
          type="hidden"
          name={name}
          value={hiddenValue(value)}
        />
      ))}

      {isEachWay ? (
        <>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100">
            Each Way Bet
          </p>

<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">
              Win odds
              <input
                type="number"
                name="win_odds_taken"
                min="1.01"
                step="0.01"
                required
                placeholder="e.g. 5.00"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
              />
            </label>

            <label className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">
              Win stake
              <input
                type="number"
                name="win_stake_points"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 10"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
              />
            </label>

            <label className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">
              Place odds
              <input
                type="number"
                name="place_odds_taken"
                min="1.01"
                step="0.01"
                required
                placeholder="e.g. 2.00"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
              />
            </label>

            <label className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">
              Place stake
              <input
                type="number"
                name="place_stake_points"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 10"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
              />
            </label>
          </div>

          <p className="mt-2 text-[9px] font-semibold leading-4 text-zinc-400">
            Total stake will be the Win stake plus the Place stake.
          </p>
        </>
      ) : (
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100/85">
            Odds taken
            <input
              type="number"
              name="odds_taken"
              min="1.01"
              step="0.01"
              required
              placeholder="e.g. 3.40"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
            />
          </label>

          <label className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100/85">
            Stake
            <input
              type="number"
              name="stake_points"
              min="0.01"
              step="0.01"
              required
              placeholder="e.g. 10"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-300 via-green-300 to-emerald-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Tip"}
        </button>

        <button
          type="button"
          onClick={() => setActiveKey(null)}
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 transition hover:bg-white/15"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function getConfidenceStars(confidence?: number | null) {
  const value = Number(confidence || 0);

  if (value >= 85) return "★★★★★";
  if (value >= 72) return "★★★★☆";
  if (value >= 60) return "★★★☆☆";
  if (value >= 45) return "★★☆☆☆";

  return "★☆☆☆☆";
}

function normaliseTipStatus(status?: string | null) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isLiveOfficialTipStatus(status?: string | null) {
  const value = normaliseTipStatus(status);

  return (
    !value ||
    value === "active" ||
    value === "published" ||
    value === "pending" ||
    value === "open"
  );
}

function isLiveCalculatorTipStatus(status?: string | null) {
  const value = normaliseTipStatus(status);

  return !value || value === "active" || value === "published";
}

function getRunnerSilk(index: number) {
  const silks = ["🟠", "🔵", "🟧", "🟢", "🟣", "🔴", "⚪", "🟡"];
  return silks[index % silks.length];
}

function buildSetupMatchedSpecialistAlerts({
  race,
  meeting,
  scoredRunners,
  races,
  runners,
  horses,
  meetings,
}: {
  race: Race;
  meeting: Meeting | undefined;
  scoredRunners: ReturnType<typeof calculateRaceScores>;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
}) {
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

function Pill({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "green" | "gold" | "blue" | "red" | "dark";
}) {
  const classes = {
    green:
      "border-green-400/30 bg-green-500/20 text-green-100 shadow-green-500/10",
    gold: "border-yellow-300/30 bg-yellow-500/20 text-yellow-100 shadow-yellow-500/10",
    blue: "border-sky-400/30 bg-sky-500/20 text-sky-100 shadow-sky-500/10",
    red: "border-rose-400/30 bg-rose-500/20 text-rose-100 shadow-rose-500/10",
    dark: "border-white/15 bg-white/10 text-white shadow-white/10",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-lg ${classes}`}
    >
      {children}
    </span>
  );
}

function GoldCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-yellow-400/35 bg-[linear-gradient(145deg,rgba(17,17,17,0.98),rgba(2,2,2,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_18px_50px_rgba(0,0,0,0.45)] ${className}`}
    >
      {children}
    </section>
  );
}

function CardTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-black text-yellow-300">
      <span>{icon}</span>
      <span>{children}</span>
    </h3>
  );
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

  const perthCalendarDate = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(perthCalendarDate);
}

function matchesRaceDay(meeting: Meeting | undefined, raceDayFilter: RaceDayFilter, dayDates: DayDates) {
  if (!meeting?.meeting_date) return false;
  return meeting.meeting_date === dayDates[raceDayFilter];
}
function buildSnapshotScoredRunners({
  race,
  meeting,
  predictions,
  runners,
  horses,
}: {
  race: Race;
  meeting: Meeting | undefined;
  predictions: CalculatorPrediction[];
  runners: Runner[];
  horses: Horse[];
}): ReturnType<typeof calculateRaceScores> {
  return [...predictions]
    .sort(
      (a, b) =>
        Number(a.rank || 0) -
        Number(b.rank || 0),
    )
    .flatMap((prediction) => {
      const runner = runners.find(
        (item) =>
          Number(item.id) ===
          Number(prediction.runner_id),
      );

      if (!runner) return [];

      const horse = horses.find(
        (item) =>
          Number(item.id) ===
          Number(
            prediction.horse_id ||
              runner.horse_id,
          ),
      );

      const listedWeight =
        runner.weight_kg === null ||
        runner.weight_kg === undefined
          ? null
          : Number(runner.weight_kg);

      const apprenticeClaim =
        runner.apprentice_claim_kg === null ||
        runner.apprentice_claim_kg ===
          undefined
          ? 0
          : Number(
              runner.apprentice_claim_kg,
            );

      const effectiveWeight =
        listedWeight === null
          ? null
          : Math.max(
              0,
              listedWeight - apprenticeClaim,
            );

      const score = Number(
        prediction.score || 0,
      );

      return [
        {
          ...runner,
          finishing_position:
            prediction.finishing_position ??
            runner.finishing_position ??
            null,
          horse_name:
            horse?.horse_name ||
            "Unknown horse",
          smartpunt_power_rating:
            horse?.smartpunt_power_rating ??
            null,
          meeting_name:
            meeting?.meeting_name ||
            "Unknown meeting",
          meeting_date:
            meeting?.meeting_date || "",
          track_condition:
            meeting?.track_condition || null,
          race_name: race.race_name,
          race_number: race.race_number,
          distance_m: race.distance_m,
          effectiveWeight,
          score,
          winPercent: Number(
            prediction.win_percent || 0,
          ),
          placePercent: Number(
            prediction.place_percent || 0,
          ),
          verdict:
            prediction.is_smartpunt_tip
              ? prediction.smartpunt_tip_type ||
                "Tip"
              : "Snapshot",
          rank: Number(
            prediction.rank || 0,
          ),
          components: {
            recentForm: Number(
              prediction.recent_form_score ||
                0,
            ),
            distance: Number(
              prediction.distance_score || 0,
            ),
            track: Number(
              prediction.track_score || 0,
            ),
            condition: Number(
              prediction.condition_score ||
                0,
            ),
            barrier: Number(
              prediction.barrier_score || 0,
            ),
            weight: Number(
              prediction.weight_score || 0,
            ),
            jockey: Number(
              prediction.jockey_score || 0,
            ),
            trainer: Number(
              prediction.trainer_score || 0,
            ),
            consistency: 50,
            powerRating: Number(
              horse?.smartpunt_power_rating ||
                0,
            ),
            powerAdjustment: 0,
          },
          audit: undefined as any,
        },
      ];
    }) as ReturnType<
      typeof calculateRaceScores
    >;
}
export default function SubscriberCalculatorLivePicks({
  races,
  runners,
  horses,
  meetings,
  jockeyProfiles,
  calculatorTips = [],
calculatorPredictions = [],
officialTips = [],
watchSuggestions = [],
getOnEarlyBets = [],
maverickExoticTips = [],
activeUserBets = [],
vaultMatches = [],
dayDates,
initialRaceId = "",
}: {
  currentUser: any;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
  jockeyProfiles: JockeyProfile[];
  calculatorTips?: CalculatorTip[];
calculatorPredictions?: CalculatorPrediction[];
officialTips?: OfficialTip[];
watchSuggestions?: WatchSuggestion[];
getOnEarlyBets?: GetOnEarlyBet[];
maverickExoticTips?: MaverickExoticTip[];
activeUserBets?: UserBet[];
vaultMatches?: VaultLiveMatch[];
initialRaceId?: string;
dayDates?: DayDates;
}) {
const [selectedRaceId, setSelectedRaceId] = useState(initialRaceId);
  const [raceDayFilter, setRaceDayFilter] = useState<RaceDayFilter>("today");
  const [expandedOfficialTipComment, setExpandedOfficialTipComment] =
    useState(false);
  const [showBestOpportunities, setShowBestOpportunities] = useState(true);
  const [acceptingTipKey, setAcceptingTipKey] = useState<string | null>(null);
  const [tipMessage, setTipMessage] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [isSavingTip, startSavingTipTransition] = useTransition();
  const router = useRouter();

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

  function addUserBetFormAction(formData: FormData) {
    setTipMessage(null);
    setTipError(null);

    startSavingTipTransition(async () => {
      const result = await addUserBetAction(formData);

      if (result?.success) {
        setAcceptingTipKey(null);
        setTipMessage("Added to My Tips.");
        router.refresh();
        return;
      }

      setTipError(result?.error || "Could not add this tip.");
    });
  }
  const publishedRaces = useMemo(
    () => races.filter((race) => ["published", "closed"].includes(String(race.status || ""))),
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

        const meetingCompare = String(
          meetingA?.meeting_name || "",
        ).localeCompare(String(meetingB?.meeting_name || ""));

        if (meetingCompare !== 0) return meetingCompare;

        return Number(a.race_number || 0) - Number(b.race_number || 0);
      }),
    [dayPublishedRaces, meetings],
  );

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

    return orderedPublishedRaces[0] || null;
  }, [orderedPublishedRaces, selectedRaceId]);

  const activeMeeting = activeRace
    ? meetings.find(
        (item) =>
          item.id === activeRace.meeting_id,
      )
    : undefined;

  const isClosedRace =
    String(activeRace?.status || "")
      .trim()
      .toLowerCase() === "closed";

const activeSnapshotRows = useMemo(() => {
  if (!activeRace) {
    return [];
  }

  return calculatorPredictions.filter(
    (prediction) =>
      Number(prediction.race_id) ===
      Number(activeRace.id),
  );
}, [
  activeRace,
  calculatorPredictions,
]);

const scoredRunners = useMemo(() => {
  if (!activeRace) return [];

  /*
   * SMARTPUNT PREDICTION INTEGRITY
   *
   * Subscriber-visible races use the authoritative
   * stored Calculator snapshot.
   *
   * Never silently recalculate an already released
   * race from changing same-day database history.
   */
  if (activeSnapshotRows.length > 0) {
    return buildSnapshotScoredRunners({
      race: activeRace,
      meeting: activeMeeting,
      predictions: activeSnapshotRows,
      runners,
      horses,
    });
  }

  /*
   * A released subscriber race should have a stored
   * prediction snapshot.
   *
   * Returning no scores is safer than creating a new
   * prediction using information that was unavailable
   * when the race was released.
   */
  return [];
}, [
  activeMeeting,
  activeRace,
  activeSnapshotRows,
  horses,
  runners,
]);

  const closedRaceSnapshotMissing =
    isClosedRace &&
    activeSnapshotRows.length === 0;

  const topWinChance = scoredRunners[0] || null;
  const calculatorTopThree = scoredRunners.slice(0, 3);

  /*
   * RESULTED CALCULATOR EXOTICS
   *
   * These results use the frozen Calculator prediction snapshot
   * and the actual finishing positions stored against that snapshot.
   *
   * We deliberately do NOT recalculate the race after settlement.
   */
  const calculatorExoticResults = useMemo(() => {
    if (!isClosedRace || calculatorTopThree.length < 3) {
      return null;
    }

    const predictedFirst = calculatorTopThree[0];
    const predictedSecond = calculatorTopThree[1];
    const predictedThird = calculatorTopThree[2];

    const firstPosition = Number(
      (predictedFirst as any).finishing_position || 0,
    );
    const secondPosition = Number(
      (predictedSecond as any).finishing_position || 0,
    );
    const thirdPosition = Number(
      (predictedThird as any).finishing_position || 0,
    );

    /*
     * Do not report an exotic result unless all three
     * Calculator selections have a valid finishing position.
     */
    if (
      firstPosition <= 0 ||
      secondPosition <= 0 ||
      thirdPosition <= 0
    ) {
      return null;
    }

    const topTwoFinishingPositions = [
      firstPosition,
      secondPosition,
    ].sort((a, b) => a - b);

    const topThreeFinishingPositions = [
      firstPosition,
      secondPosition,
      thirdPosition,
    ].sort((a, b) => a - b);

    const quinella =
      topTwoFinishingPositions[0] === 1 &&
      topTwoFinishingPositions[1] === 2;

    const exacta =
      firstPosition === 1 &&
      secondPosition === 2;

    const allWaysTrifecta =
      topThreeFinishingPositions[0] === 1 &&
      topThreeFinishingPositions[1] === 2 &&
      topThreeFinishingPositions[2] === 3;

    return {
      quinella,
      exacta,
      allWaysTrifecta,
      anyHit:
        quinella ||
        exacta ||
        allWaysTrifecta,
    };
  }, [
    calculatorTopThree,
    isClosedRace,
  ]);

  const calculatorWinnerResult = useMemo(() => {
    if (
      !isClosedRace ||
      calculatorTopThree.length === 0
    ) {
      return null;
    }

    const topRunner =
      calculatorTopThree[0];

    const finishingPosition = Number(
      (topRunner as any)
        .finishing_position || 0,
    );

    if (finishingPosition !== 1) {
      return null;
    }

    const wasOfficialWinTip =
      qualifiedTip?.type === "Win" &&
      Number(qualifiedTip.runner.id) ===
        Number(topRunner.id);

    return {
      runner: topRunner,
      wasOfficialWinTip,
    };
  }, [
    calculatorTopThree,
    isClosedRace,
    qualifiedTip,
  ]);

  const topPlaceChances = [...scoredRunners]
    .sort((a, b) => b.placePercent - a.placePercent)
    .slice(0, 3);

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

  const raceConfidence = useMemo(() => {
    if (!scoredRunners.length) return null;

    const calculatedConfidence =
      calculateRaceConfidence(scoredRunners, {
        trackCondition:
          topWinChance?.track_condition ||
          null,
        raceName:
          activeRace?.race_name || "",
        placeTerms:
          activeRace?.place_terms ||
          "top_3",
      });

if (!activeSnapshotRows.length) {
  return calculatedConfidence;
}

    const storedConfidence =
      activeSnapshotRows.find(
        (prediction) =>
          prediction
            .race_confidence_percent !==
          null &&
          prediction
            .race_confidence_percent !==
          undefined,
      ) || activeSnapshotRows[0];

    const storedTier = String(
      storedConfidence
        ?.race_confidence_tier || "",
    );

    const tier:
      | "Low"
      | "Medium"
      | "High"
      | "Elite" =
      storedTier === "Elite" ||
      storedTier === "High" ||
      storedTier === "Medium" ||
      storedTier === "Low"
        ? storedTier
        : calculatedConfidence.tier;

    return {
      ...calculatedConfidence,
      confidencePercent:
        storedConfidence
          ?.race_confidence_percent !==
          null &&
        storedConfidence
          ?.race_confidence_percent !==
          undefined
          ? Number(
              storedConfidence
                .race_confidence_percent,
            )
          : calculatedConfidence
              .confidencePercent,
      tier,
      suggestedBet:
        storedConfidence
          ?.smartpunt_tip_type ||
        storedConfidence?.suggested_bet ||
        calculatedConfidence.suggestedBet,
summary:
  isClosedRace
    ? "Frozen prediction snapshot showing the Calculator position and confidence recorded before settlement."
    : "Released Calculator snapshot. Same-day race results cannot alter this prediction.",
    };
  }, [
    activeRace?.place_terms,
    activeRace?.race_name,
    activeSnapshotRows,
    isClosedRace,
    scoredRunners,
    topWinChance?.track_condition,
  ]);

const tipThresholds = useMemo(
  () =>
    raceConfidence && !isClosedRace
      ? getCalculatorTipThresholds(raceConfidence, {
          trackCondition: topWinChance?.track_condition || null,
          placeTerms: activeRace?.place_terms || "top_3",
          meetingDate: activeMeeting?.meeting_date || null,
        })
      : null,
  [
    activeMeeting?.meeting_date,
    activeRace?.place_terms,
    isClosedRace,
    raceConfidence,
    topWinChance?.track_condition,
  ],
);

const qualifiedTip = useMemo(() => {
  if (!raceConfidence) return null;

if (activeSnapshotRows.length > 0) {
    const storedTip =
      activeSnapshotRows.find(
        (prediction) =>
          prediction.is_smartpunt_tip ===
          true,
      );

    if (!storedTip) return null;

    const storedTipRunner =
      scoredRunners.find(
        (runner) =>
          Number(runner.id) ===
          Number(storedTip.runner_id),
      );

    if (!storedTipRunner) return null;

    const rawTipType = String(
      storedTip.smartpunt_tip_type ||
        storedTip.suggested_bet ||
        "",
    ).toLowerCase();

    const type: "Win" | "Place" =
      rawTipType.includes("place")
        ? "Place"
        : "Win";

    const secondRunner =
      scoredRunners.find(
        (runner) =>
          Number(runner.id) !==
          Number(storedTipRunner.id),
      ) || null;

    const gap = secondRunner
      ? roundScore(
          Number(
            storedTipRunner.score || 0,
          ) -
            Number(
              secondRunner.score || 0,
            ),
        )
      : roundScore(
          Number(
            storedTipRunner.score || 0,
          ),
        );

    return {
      runner: storedTipRunner,
      type,
      gap,
      raceConfidence,
      qualifiesAsStrongWin: false,
      qualifiesAsStrongPlace: false,
    };
  }

  return getQualifiedCalculatorTip(
    scoredRunners,
    {
      trackCondition:
        topWinChance?.track_condition ||
        null,
      raceName:
        activeRace?.race_name || "",
      placeTerms:
        activeRace?.place_terms ||
        "top_3",
      meetingDate:
        activeMeeting?.meeting_date ||
        null,
    },
  );
}, [
  activeMeeting?.meeting_date,
  activeRace?.place_terms,
  activeRace?.race_name,
  activeSnapshotRows,
  isClosedRace,
  raceConfidence,
  scoredRunners,
  topWinChance?.track_condition,
]);
  useEffect(() => {
    if (!activeRace || !topWinChance) return;

    console.info("[SmartPunt Calculator Parity]", {
      source: "SUBSCRIBER_LIVE_PICKS",

      raceId: Number(activeRace.id),
      meetingId: Number(activeRace.meeting_id),
      meetingName:
        activeMeeting?.meeting_name || null,
      meetingDate:
        activeMeeting?.meeting_date || null,
      raceNumber: Number(activeRace.race_number || 0),
      raceName: activeRace.race_name || null,
      raceStatus: activeRace.status || null,

      totalRunnerRowsProvided: runners.length,
      currentRaceRunnerRows: runners.filter(
        (runner) =>
          Number(runner.race_id) ===
          Number(activeRace.id),
      ).length,
      scoredRunnerCount: scoredRunners.length,

      topRunnerId: Number(topWinChance.id),
      topHorseId: Number(topWinChance.horse_id),
      topHorse: topWinChance.horse_name,
      topScore: Number(topWinChance.score || 0),
      topWinPercent: Number(topWinChance.winPercent || 0),
      topPlacePercent: Number(topWinChance.placePercent || 0),

      confidencePercent:
        raceConfidence?.confidencePercent ?? null,
      confidenceTier:
        raceConfidence?.tier ?? null,
      confidenceGap:
        raceConfidence?.gap ?? null,

      qualifiedTip:
        qualifiedTip?.type || "No Bet",
      qualifiedRunnerId:
        qualifiedTip?.runner
          ? Number(qualifiedTip.runner.id)
          : null,
      qualifiedHorse:
        qualifiedTip?.runner?.horse_name || null,
      qualifiedGap:
        qualifiedTip?.gap ?? null,

      topThree: scoredRunners
        .slice(0, 3)
        .map((runner) => ({
          runnerId: Number(runner.id),
          horse: runner.horse_name,
          score: Number(runner.score || 0),
          winPercent: Number(
            runner.winPercent || 0,
          ),
          placePercent: Number(
            runner.placePercent || 0,
          ),
        })),
    });
  }, [
    activeMeeting?.meeting_date,
    activeMeeting?.meeting_name,
    activeRace,
    qualifiedTip,
    raceConfidence,
    runners,
    scoredRunners,
    topWinChance,
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

const activePlaceTerms = activeRace?.place_terms || "top_3";

const activeRaceVaultMatches = useMemo(() => {
  if (!activeRace) {
    return [];
  }

  return vaultMatches.filter(
    (match) =>
      Number(match.raceId) ===
      Number(activeRace.id),
  );
}, [activeRace, vaultMatches]);

const activeRaceVaultRunnerIds = useMemo(
  () =>
    new Set(
      activeRaceVaultMatches.map(
        (match) => Number(match.raceRunnerId),
      ),
    ),
  [activeRaceVaultMatches],
);

const activeRaceVaultHorseIds = useMemo(
  () =>
    new Set(
      activeRaceVaultMatches.map(
        (match) => Number(match.horseId),
      ),
    ),
  [activeRaceVaultMatches],
);

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
const activeRaceWatchSuggestions =
  useMemo(() => {
    if (
      !activeRace ||
      raceDayFilter !== "today"
    ) {
      return [];
    }

    return watchSuggestions.filter(
      (suggestion) =>
        Number(
          suggestion.race_id || 0,
        ) === Number(activeRace.id),
    );
  }, [
    activeRace,
    raceDayFilter,
    watchSuggestions,
  ]);

const watchSuggestionRunnerIds =
  useMemo(
    () =>
      new Set(
        activeRaceWatchSuggestions
          .map((suggestion) =>
            Number(
              suggestion.race_runner_id ||
                0,
            ),
          )
          .filter(Boolean),
      ),
    [activeRaceWatchSuggestions],
  );

const watchSuggestionHorseIds =
  useMemo(
    () =>
      new Set(
        activeRaceWatchSuggestions
          .map((suggestion) =>
            Number(
              suggestion.horse_id || 0,
            ),
          )
          .filter(Boolean),
      ),
    [activeRaceWatchSuggestions],
  );
  const officialRaceTip = useMemo(() => {
    if (!activeRace) return null;

    return (
      officialTips.find((tip) => {
        if (Number(tip.race_id || 0) !== Number(activeRace.id)) return false;

        const status = String(tip.status || "").toLowerCase();

        return (
          !status ||
          status === "active" ||
          status === "published" ||
          status === "pending" ||
          status === "open"
        );
      }) || null
    );
  }, [activeRace, officialTips]);

  const calculatorRaceTip = useMemo(() => {
    if (!activeRace) return null;

    return (
      calculatorTips.find((tip) => {
        if (Number(tip.race_id || 0) !== Number(activeRace.id)) return false;

        const status = String(tip.status || "").toLowerCase();

        return !status || status === "active" || status === "published";
      }) || null
    );
  }, [activeRace, calculatorTips]);

  const officialRaceTipRunner = useMemo(() => {
    if (!officialRaceTip) return null;

    return (
      scoredRunners.find((runner) => {
        if (officialRaceTip.race_runner_id) {
          return Number(runner.id) === Number(officialRaceTip.race_runner_id);
        }

        if (officialRaceTip.horse_id) {
          return Number(runner.horse_id) === Number(officialRaceTip.horse_id);
        }

        const tipHorseName = String(
          officialRaceTip.horse || officialRaceTip.horse_name || "",
        )
          .trim()
          .toLowerCase();

        return tipHorseName
          ? String(runner.horse_name || "")
              .trim()
              .toLowerCase() === tipHorseName
          : false;
      }) || null
    );
  }, [officialRaceTip, scoredRunners]);

  const officialTipSelection = officialRaceTip
    ? officialRaceTip.horse ||
      officialRaceTip.horse_name ||
      officialRaceTipRunner?.horse_name ||
      "Official selection"
    : "";

  const officialTipType = officialRaceTip
    ? formatOfficialTipType(officialRaceTip)
    : "";

  const officialTipComment = officialRaceTip
    ? officialRaceTip.commentary ||
      officialRaceTip.note ||
"The Maverick has endorsed this race."
    : "";

  const officialTipConfidence = officialRaceTip?.confidence || null;
  const officialTipAngle = officialRaceTip?.tip_angle || null;

  const isConsensusPick = Boolean(
    officialRaceTipRunner &&
    qualifiedTip?.runner &&
    Number(officialRaceTipRunner.id) === Number(qualifiedTip.runner.id),
  );

  const activeRaceLabel = activeRace
    ? `${activeMeeting?.meeting_name || "Meeting"} R${activeRace.race_number} ${activeRace.race_name}`
    : "";

  const activeHeadTipperUserBet = useMemo(() => {
    if (!officialRaceTip) return null;

    return (
      activeUserBets.find((bet) => {
        if (String(bet.source || "").toLowerCase() !== "head_tipper") return false;

        if (officialRaceTip.id && Number(bet.suggested_tip_id || 0) === Number(officialRaceTip.id)) {
          return true;
        }

        return (
          Number(bet.race_id || 0) === Number(officialRaceTip.race_id || activeRace?.id || 0) &&
          (officialRaceTip.race_runner_id
            ? Number(bet.race_runner_id || 0) === Number(officialRaceTip.race_runner_id)
            : officialRaceTip.horse_id
              ? Number(bet.horse_id || 0) === Number(officialRaceTip.horse_id)
              : String(bet.horse || "").trim().toLowerCase() ===
                String(officialTipSelection || "").trim().toLowerCase())
        );
      }) || null
    );
  }, [activeRace?.id, activeUserBets, officialRaceTip, officialTipSelection]);

  const activeCalculatorUserBet = useMemo(() => {
    if (!activeRace || !qualifiedTip?.runner) return null;

    return (
      activeUserBets.find((bet) => {
        if (String(bet.source || "").toLowerCase() !== "calculator") return false;

        if (calculatorRaceTip?.id && Number(bet.calculator_tip_id || 0) === Number(calculatorRaceTip.id)) {
          return true;
        }

        return (
          Number(bet.race_id || 0) === Number(activeRace.id) &&
          Number(bet.race_runner_id || 0) === Number(qualifiedTip.runner.id)
        );
      }) || null
    );
  }, [activeRace, activeUserBets, calculatorRaceTip?.id, qualifiedTip?.runner]);

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
    activeSpecialistAlerts[0]
      ? `Specialist edge: ${activeSpecialistAlerts[0].horseName}`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];

  const raceStartTime = formatStartTime(
    (activeRace as any)?.start_time ||
      (activeRace as any)?.race_time ||
      (activeRace as any)?.jump_time ||
      null,
  );
const activeTrackCondition = String(
  activeMeeting?.track_condition || "",
)
  .trim()
  .toLowerCase();

const raceConditionBackground =
  activeTrackCondition.startsWith("soft")
    ? "/race-conditions/soft.png"
    : activeTrackCondition.startsWith("heavy")
      ? "/race-conditions/heavy.png"
      : activeTrackCondition.startsWith("synthetic")
        ? "/race-conditions/synthetic.png"
        : "/race-conditions/good.png";
  const bestOpportunities = useMemo(() => {
    const items: Array<{
      raceId: number;
      raceNumber: number;
      meetingName: string;
      raceLabel: string;
      horseName: string;
      betType: string;
source: "CONSENSUS" | "HEAD" | "CALC";
      confidencePercent: number;
      confidenceTier: string;
      sortGroup: number;
    }> = [];

    orderedPublishedRaces.forEach((race) => {
      const meeting = meetings.find(
        (item) =>
          Number(item.id) ===
          Number(race.meeting_id),
      );

      if (
        String(race.status || "")
          .trim()
          .toLowerCase() === "closed"
      ) {
        return;
      }

const raceSnapshotRows =
  calculatorPredictions.filter(
    (prediction) =>
      Number(prediction.race_id) ===
      Number(race.id),
  );

const raceScoredRunners =
  raceSnapshotRows.length > 0
    ? buildSnapshotScoredRunners({
        race,
        meeting,
        predictions: raceSnapshotRows,
        runners,
        horses,
      })
    : [];

      if (!raceScoredRunners.length) return;

      const raceTopRunner = raceScoredRunners[0] || null;
      const raceConfidenceResult = calculateRaceConfidence(raceScoredRunners, {
        trackCondition: raceTopRunner?.track_condition || null,
        raceName: race.race_name || "",
        placeTerms: race.place_terms || "top_3",
      });
const raceQualifiedTip = getQualifiedCalculatorTip(raceScoredRunners, {
  trackCondition: raceTopRunner?.track_condition || null,
  raceName: race.race_name || "",
  placeTerms: race.place_terms || "top_3",
  meetingDate: meeting?.meeting_date || null,
});
      const raceOfficialTip =
        officialTips.find((tip) => {
          if (Number(tip.race_id || 0) !== Number(race.id)) return false;

          return isLiveOfficialTipStatus(tip.status);
        }) || null;

      const raceOfficialTipRunner = raceOfficialTip
        ? raceScoredRunners.find((runner) => {
            if (raceOfficialTip.race_runner_id) {
              return (
                Number(runner.id) === Number(raceOfficialTip.race_runner_id)
              );
            }

            if (raceOfficialTip.horse_id) {
              return (
                Number(runner.horse_id) === Number(raceOfficialTip.horse_id)
              );
            }

            const tipHorseName = String(
              raceOfficialTip.horse || raceOfficialTip.horse_name || "",
            )
              .trim()
              .toLowerCase();

            return tipHorseName
              ? String(runner.horse_name || "")
                  .trim()
                  .toLowerCase() === tipHorseName
              : false;
          }) || null
        : null;

      const confidencePercent = Number(
        raceConfidenceResult?.confidencePercent || 0,
      );
      const confidenceTier = String(raceConfidenceResult?.tier || "Live");
      const raceLabel = `${meeting?.meeting_name || "Meeting"} R${race.race_number || "—"}`;
      const officialSelection = raceOfficialTip
        ? raceOfficialTip.horse ||
          raceOfficialTip.horse_name ||
          raceOfficialTipRunner?.horse_name ||
          "Official selection"
        : "";
      const officialType = raceOfficialTip
        ? formatOfficialTipType(raceOfficialTip)
        : "";
      const isConsensus = Boolean(
        raceOfficialTipRunner &&
        raceQualifiedTip?.runner &&
        Number(raceOfficialTipRunner.id) === Number(raceQualifiedTip.runner.id),
      );

      if (raceOfficialTip) {
        items.push({
          raceId: Number(race.id),
          raceNumber: Number(race.race_number || 0),
          meetingName: meeting?.meeting_name || "Meeting",
          raceLabel,
          horseName: officialSelection,
          betType: officialType,
source: isConsensus ? "CONSENSUS" : "HEAD",
          confidencePercent,
          confidenceTier,
          sortGroup: isConsensus ? 0 : 1,
        });
      }

      if (raceQualifiedTip?.runner && !isConsensus) {
        items.push({
          raceId: Number(race.id),
          raceNumber: Number(race.race_number || 0),
          meetingName: meeting?.meeting_name || "Meeting",
          raceLabel,
          horseName: raceQualifiedTip.runner.horse_name,
          betType: raceQualifiedTip.type,
          source: "CALC",
          confidencePercent,
          confidenceTier,
          sortGroup: raceQualifiedTip.type === "Win" ? 2 : 3,
        });
      }
    });

return items.sort((a, b) => {
  const meetingCompare =
    a.meetingName.localeCompare(
      b.meetingName,
      "en-AU",
      {
        sensitivity: "base",
      },
    );

  if (meetingCompare !== 0) {
    return meetingCompare;
  }

  const raceCompare =
    Number(a.raceNumber || 0) -
    Number(b.raceNumber || 0);

  if (raceCompare !== 0) {
    return raceCompare;
  }

  /*
   * If The Maverick and Calculator both have
   * selections in the same race, keep The Maverick
   * first, followed by Calculator.
   *
   * Consensus remains a single combined row.
   */
  const sourceOrder = {
    CONSENSUS: 0,
    HEAD: 1,
    CALC: 2,
  } as const;

  return (
    sourceOrder[a.source] -
    sourceOrder[b.source]
  );
});
}, [
  calculatorPredictions,
  horses,
  meetings,
  officialTips,
  orderedPublishedRaces,
  runners,
]);

  return (
    <div className="min-h-screen bg-[#171107] px-3 py-5 text-white sm:px-5">
      <div className="mx-auto max-w-[430px]">
        <div className="sticky top-0 z-30 mb-3 rounded-[22px] border border-amber-300/40 bg-[#171107]/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <h1 className="text-sm font-black leading-tight text-white">
                SmartPunt Calculator Live Picks
              </h1>
              <button
                type="button"
                onClick={() => setShowBestOpportunities((value) => !value)}
                className="mt-1 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300 transition hover:bg-amber-500/20 hover:text-amber-200"
                aria-expanded={showBestOpportunities}
              >
                <span>Best Opportunities</span>
                <span className="rounded-full border border-amber-300/30 bg-black/30 px-1.5 py-0.5 text-[8px] leading-none text-amber-100">
                  {bestOpportunities.length}
                </span>
                <span className="text-[8px] text-amber-100">
                  {showBestOpportunities ? "▲" : "▼"}
                </span>
              </button>
            </div>
            <Link
              href="/subscriber-dashboard"
              className="rounded-full border border-amber-300/40 bg-black/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100"
            >
              Dashboard
            </Link>
          </div>

{showBestOpportunities ? (
  <div className="max-h-[188px] space-y-1.5 overflow-y-auto pr-1">
{maverickExoticTips.length > 0 ? (
      <div className="mb-2 space-y-1.5">
        {maverickExoticTips
          .map((tip) => {
            const race =
              races.find(
                (item) =>
                  Number(item.id) ===
                  Number(tip.race_id),
              ) || null;

            const meeting = race
              ? meetings.find(
                  (item) =>
                    Number(item.id) ===
                    Number(race.meeting_id),
                ) || null
              : null;

            if (!race || !meeting) {
              return null;
            }

            const selections =
              Array.isArray(tip.selections)
                ? tip.selections
                : [];

            const selectionLabel =
              tip.bet_type === "quinella"
                ? selections
                    .map((selection) =>
                      selection.runner_number
                        ? `#${selection.runner_number}`
                        : selection.horse || "",
                    )
                    .filter(Boolean)
                    .join(" / ")
                : tip.mode === "positional"
                  ? selections
                      .map((selection) => {
                        const positions =
                          Array.isArray(selection.positions)
                            ? selection.positions
                                .map((position) =>
                                  position === 1
                                    ? "1st"
                                    : position === 2
                                      ? "2nd"
                                      : "3rd",
                                )
                                .join("/")
                            : "";

                        const runnerLabel =
                          selection.runner_number
                            ? `#${selection.runner_number}`
                            : selection.horse || "";

                        return positions
                          ? `${runnerLabel} ${positions}`
                          : runnerLabel;
                      })
                      .filter(Boolean)
                      .join(" · ")
                  : selections
                      .map((selection) =>
                        selection.runner_number
                          ? `#${selection.runner_number}`
                          : selection.horse || "",
                      )
                      .filter(Boolean)
                      .join(" / ");

            return {
              tip,
              race,
              meeting,
              selectionLabel,
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            const meetingCompare =
              String(a!.meeting.meeting_name || "").localeCompare(
                String(b!.meeting.meeting_name || ""),
                "en-AU",
                {
                  sensitivity: "base",
                },
              );

            if (meetingCompare !== 0) {
              return meetingCompare;
            }

            return (
              Number(a!.race.race_number || 0) -
              Number(b!.race.race_number || 0)
            );
          })
          .map((item) => {
            if (!item) return null;

            const {
              tip,
              race,
              meeting,
              selectionLabel,
            } = item;

            const isSelected =
              activeRace &&
              Number(activeRace.id) ===
                Number(race.id);

const isTrifecta =
  tip.bet_type === "trifecta";

const exoticArtwork = isTrifecta
  ? "/maverick/maverick-trifecta-strip.png"
  : "/maverick/maverick-quinella-strip.png";

return (
  <button
    key={`exotic-${tip.id}`}
    type="button"
    onClick={() =>
      setSelectedRaceId(
        String(race.id),
      )
    }
    className="group relative block w-full overflow-hidden rounded-[16px] text-left transition active:scale-[0.995]"
  >
    <img
      src={exoticArtwork}
      alt={
        isTrifecta
          ? "The Maverick Trifecta"
          : "The Maverick Quinella"
      }
      className="block h-auto w-full object-contain transition group-hover:brightness-110"
    />

<span className="pointer-events-none absolute inset-y-0 left-[30%] right-[20%] flex min-w-0 flex-col items-center justify-center px-2 text-center">
      <span
        className={`block truncate text-[9px] font-black uppercase tracking-[0.11em] sm:text-[10px] ${
          isTrifecta
            ? "text-yellow-200"
            : "text-rose-100"
        }`}
      >
        {meeting.meeting_name || "Meeting"} R
        {race.race_number || "—"}
      </span>

      <span className="mt-0.5 block truncate text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[11px]">
        {selectionLabel || "Exotic Selection"}
      </span>

      {isTrifecta &&
      tip.mode === "all_ways" ? (
        <span className="mt-0.5 block text-[7px] font-black uppercase tracking-[0.1em] text-yellow-100/80">
          All Ways
        </span>
      ) : null}
    </span>

    {isSelected ? (
      <span
        className={`pointer-events-none absolute inset-0 rounded-[16px] border-2 ${
          isTrifecta
            ? "border-yellow-200/80 shadow-[inset_0_0_15px_rgba(250,204,21,0.30)]"
            : "border-rose-200/80 shadow-[inset_0_0_15px_rgba(251,113,133,0.25)]"
        }`}
      />
    ) : null}
  </button>
);
          })}
      </div>
    ) : null}
    {bestOpportunities.length ? (
      bestOpportunities.map((item) => {
                  const isSelected =
                    activeRace && Number(activeRace.id) === Number(item.raceId);
const tipArtwork =
  item.source === "CONSENSUS"
    ? "/maverick/consensus-tip-strip.png"
    : item.source === "HEAD"
      ? "/maverick/maverick-tip-strip.png"
      : "/maverick/smartpunt-tip-strip.png";

const tipArtworkAlt =
  item.source === "CONSENSUS"
    ? "SmartPunt and The Maverick Consensus"
    : item.source === "HEAD"
      ? "The Maverick Tip"
      : "SmartPunt Tip";

const meetingTextClasses =
  item.source === "CONSENSUS"
    ? "text-emerald-100"
    : item.source === "HEAD"
      ? "text-zinc-100"
      : "text-emerald-100";

const normalisedDropdownBetType = String(item.betType || "")
  .trim()
  .toLowerCase()
  .replace(/_/g, " ");

const betTypeArtwork =
  normalisedDropdownBetType === "each way" ||
  normalisedDropdownBetType === "eachway"
    ? "/tip-types/bet-type-each-way.png"
    : normalisedDropdownBetType.includes("place")
      ? "/tip-types/bet-type-place.png"
      : normalisedDropdownBetType.includes("win")
        ? "/tip-types/bet-type-win.png"
        : null;

return (
  <button
    key={`${item.source}-${item.raceId}-${item.horseName}`}
    type="button"
    onClick={() =>
      setSelectedRaceId(String(item.raceId))
    }
    className="group relative block w-full overflow-hidden rounded-[16px] text-left transition active:scale-[0.995]"
  >
    <img
      src={tipArtwork}
      alt={tipArtworkAlt}
      className="block h-auto w-full object-contain transition group-hover:brightness-110"
    />

<span className="pointer-events-none absolute inset-y-0 left-[30%] right-[20%] flex min-w-0 flex-col items-center justify-center px-2 text-center">
      <span
        className={`block truncate text-[9px] font-black uppercase tracking-[0.11em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[10px] ${meetingTextClasses}`}
      >
        {item.raceLabel}
      </span>

      <span className="mt-0.5 block truncate text-[11px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[12px]">
        {item.horseName}
      </span>
    </span>

<span className="pointer-events-none absolute inset-y-0 right-[1.5%] flex w-[22%] items-center justify-center">
  {betTypeArtwork ? (
    <img
      src={betTypeArtwork}
      alt={item.betType}
      className="max-h-[78%] max-w-full object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]"
    />
  ) : (
    <span className="text-center text-[8px] font-black uppercase leading-tight tracking-[0.08em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] sm:text-[9px]">
      {item.betType}
    </span>
  )}
</span>

    {isSelected ? (
      <span
        className={`pointer-events-none absolute inset-0 rounded-[16px] border-2 ${
          item.source === "CONSENSUS"
            ? "border-amber-200/90 shadow-[inset_0_0_18px_rgba(250,204,21,0.28)]"
            : item.source === "HEAD"
              ? "border-zinc-100/80 shadow-[inset_0_0_18px_rgba(255,255,255,0.20)]"
              : "border-emerald-200/80 shadow-[inset_0_0_18px_rgba(52,211,153,0.24)]"
        }`}
      />
    ) : null}
  </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/55 px-3 py-3 text-center text-[11px] font-bold text-zinc-300">
                  No SmartPunt opportunities yet. Use the race selector below to
                  review every live race.
                </div>
              )}

              {getOnEarlyBets.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {getOnEarlyBets.map((bet) => {
                    const raceDate =
                      bet.race_date
                        ? new Intl.DateTimeFormat("en-AU", {
                            day: "numeric",
                            month: "short",
                          }).format(
                            new Date(
                              `${bet.race_date}T12:00:00`,
                            ),
                          )
                        : "";

                    return (
                      <div
                        key={bet.id}
                        className="relative block w-full overflow-hidden rounded-[16px]"
                      >
                        <img
                          src="/maverick/get-on-early-strip.png"
                          alt="Get On Early"
                          className="block h-auto w-full object-contain"
                        />

                        <span className="pointer-events-none absolute inset-y-0 left-[36%] right-[4%] flex min-w-0 items-center">
                          <span className="grid w-full grid-cols-[1fr_auto] items-center gap-2 px-2">
                            <span className="min-w-0 text-center">
                              <span className="block truncate text-[9px] font-black uppercase tracking-[0.11em] text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[10px]">
                                {bet.meeting || "Meeting"}
                                {bet.race_number
                                  ? ` R${bet.race_number}`
                                  : ""}
                                {raceDate
                                  ? ` · ${raceDate}`
                                  : ""}
                              </span>

                              <span className="mt-0.5 block truncate text-[11px] font-black leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] sm:text-[12px]">
                                {bet.horse || "Selection"}
                              </span>
                            </span>

                            <span className="shrink-0 rounded-full border border-amber-200/50 bg-black/55 px-2 py-1 text-center text-[8px] font-black uppercase leading-tight tracking-[0.08em] text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.16)]">
                              {bet.bet_type || "Win"}
                              {bet.odds ? (
                                <>
                                  <br />
                                  ${String(bet.odds).replace(/^\$/, "")}
                                </>
                              ) : null}
                            </span>
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mb-4 overflow-hidden rounded-[26px] border border-amber-300/40 bg-[#f7f0df] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <div className="rounded-[20px] border border-black/10 bg-[#f7f0df]">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["yesterday", "today", "tomorrow"] as RaceDayFilter[]).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setRaceDayFilter(day);
                      setSelectedRaceId("");
                    }}
                    className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                      raceDayFilter === day
                        ? "bg-zinc-950 text-amber-300"
                        : "border border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    {getRaceDayLabel(day)}
                  </button>
                ))}
              </div>

              {activeRace ? (
                <>
<div className="relative overflow-hidden rounded-[24px] border border-amber-400/45 shadow-[0_18px_45px_rgba(0,0,0,0.50)]">
  <img
    src={raceConditionBackground}
    alt=""
    aria-hidden="true"
    className="absolute inset-0 h-full w-full object-cover"
  />

  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,12,0.96)_0%,rgba(2,6,12,0.88)_42%,rgba(2,6,12,0.58)_72%,rgba(2,6,12,0.38)_100%)]" />

  <div className="relative z-10 p-4">
    <div>
      <label className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
        Choose {selectedRaceDayLabel.toLowerCase()} race
      </label>

      <select
        value={String(activeRace.id)}
        onChange={(event) => setSelectedRaceId(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/20 bg-black/65 px-3 py-2.5 text-xs font-black text-white shadow-lg outline-none backdrop-blur-md focus:border-amber-300"
      >
        {orderedPublishedRaces.map((race) => {
          const meeting = meetings.find(
            (item) => item.id === race.meeting_id,
          );

          return (
            <option
              key={race.id}
              value={String(race.id)}
              className="bg-zinc-950 text-white"
            >
              {meeting?.meeting_name || "Meeting"} · R
              {race.race_number} {race.race_name}
            </option>
          );
        })}
      </select>
    </div>

    <div className="my-4 h-px bg-gradient-to-r from-amber-300/50 via-white/15 to-transparent" />

    <div className="flex items-start gap-3">
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] border border-amber-300/45 bg-black/75 shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
        <span className="text-[30px] font-black leading-none text-amber-300">
          R{activeRace.race_number}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.17em] text-amber-300">
              {activeMeeting?.meeting_name || "Meeting"}
            </p>

            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-300">
              {activeMeeting?.meeting_date || ""}
              {raceStartTime !== "—" ? ` · ${raceStartTime}` : ""}
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-amber-200/45 bg-black/60 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-lg backdrop-blur-md">
            {activeMeeting?.track_condition || "Track not set"}
          </span>
        </div>

        <h2 className="mt-2 line-clamp-2 text-[17px] font-black leading-[1.15] text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">
          {activeRace.race_name}
        </h2>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/15 bg-black/55 shadow-lg backdrop-blur-md">
      <div className="px-2 py-3 text-center">
        <p className="text-[15px] font-black leading-none text-white">
          {activeRace.distance_m || "—"}m
        </p>
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
          Distance
        </p>
      </div>

      <div className="border-x border-white/10 px-2 py-3 text-center">
        <p className="truncate text-[13px] font-black leading-none text-amber-200">
          {activeMeeting?.track_condition || "—"}
        </p>
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
          Track
        </p>
      </div>

      <div className="px-2 py-3 text-center">
        <p className="text-[11px] font-black leading-none text-white">
          {placeTermsLabel(activeRace.place_terms)}
        </p>
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
          Place Terms
        </p>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-[14px] border border-amber-300/25 bg-black/60 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200 backdrop-blur-md">
      <button
        type="button"
        disabled={!previousRace}
        onClick={() =>
          previousRace &&
          setSelectedRaceId(String(previousRace.id))
        }
        className="px-3 py-2.5 text-left transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ‹ Previous
      </button>

      <div className="border-x border-amber-300/20 px-4 py-2.5 text-center text-white">
        {activeRaceIndex >= 0
          ? `${activeRaceIndex + 1} / ${orderedPublishedRaces.length}`
          : "—"}
      </div>

      <button
        type="button"
        disabled={!nextRace}
        onClick={() =>
          nextRace &&
          setSelectedRaceId(String(nextRace.id))
        }
        className="px-3 py-2.5 text-right transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Next ›
      </button>
    </div>
  </div>
</div>

{activeRaceVaultMatches.length > 0 ? (
  <div className="overflow-hidden rounded-[20px] border border-amber-300/45 bg-[linear-gradient(135deg,rgba(8,8,8,0.98)_0%,rgba(24,18,8,0.98)_58%,rgba(120,53,15,0.24)_100%)] shadow-[0_14px_35px_rgba(0,0,0,0.38)]">
    <div className="flex items-center gap-3 border-b border-amber-300/20 px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/35 bg-black/60">
        <VaultDoorIcon className="h-7 w-7 text-amber-200" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
          From Your Vault
        </p>

        <p className="mt-1 text-[10px] font-semibold text-zinc-400">
          {activeRaceVaultMatches.length === 1
            ? "One of your saved Vault alerts matches this race."
            : `${activeRaceVaultMatches.length} of your saved Vault alerts match this race.`}
        </p>
      </div>

      <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black text-amber-200">
        {activeRaceVaultMatches.length}
      </span>
    </div>

    <div className="space-y-2 p-3">
      {activeRaceVaultMatches.map((match) => (
        <div
          key={match.notificationId}
          className="rounded-[16px] border border-white/10 bg-black/45 px-3 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
                {match.alertName || "Vault Alert"}
              </p>

              <p className="mt-1 text-base font-black leading-tight text-white">
                {match.runnerNumber
                  ? `#${match.runnerNumber} ${match.horseName}`
                  : match.horseName}
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-200">
              In Your Vault
            </span>
          </div>

          {match.matchedRules.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.matchedRules.map((rule, index) => (
                <span
                  key={`${match.notificationId}-${rule.type}-${index}`}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[8px] font-bold text-zinc-300"
                >
                  {rule.label}: {rule.value}
                </span>
              ))}
            </div>
          ) : null}

          <Link
            href="/the-vault"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-300/15"
          >
            <VaultDoorIcon className="h-4 w-4" />
            View in The Vault →
          </Link>
        </div>
      ))}
    </div>
  </div>
) : null}

                {closedRaceSnapshotMissing ? (
                  <div className="rounded-[20px] border border-rose-300/45 bg-rose-950/70 p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-200">
                      Historical Snapshot Unavailable
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-rose-50">
                      This race is finalised, but no saved calculator prediction snapshot was found. SmartPunt will not recalculate the race using updated post-race information.
                    </p>
                  </div>
                ) : null}
                {officialRaceTip ? (
                  <div className="rounded-[20px] border border-emerald-300/45 bg-[linear-gradient(135deg,rgba(6,78,59,0.55)_0%,rgba(2,6,23,0.96)_55%,rgba(0,0,0,0.98)_100%)] p-3 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
<div className="inline-flex items-center gap-3 rounded-[18px] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.16)_0%,rgba(0,0,0,0.52)_100%)] px-3.5 py-3 shadow-[0_0_22px_rgba(251,191,36,0.14)]">
  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/45 bg-black/70 shadow-[0_0_20px_rgba(251,191,36,0.28)]">
    <img
      src="/maverick/maverick-shield.png"
      alt="The Maverick"
      className="h-full w-full object-contain p-1"
    />
  </div>

  <div>
    <p className="text-[14px] font-black uppercase leading-none tracking-[0.18em] text-amber-200">
      The Maverick
    </p>

    <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
      Official Selection
    </p>

    <div className="mt-2 h-px w-full bg-gradient-to-r from-amber-300/70 to-transparent" />
  </div>
</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black leading-tight text-white">
                            {officialTipSelection}
                          </p>
                          <span className="rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">
                            {officialTipType}
                          </span>
                          {officialTipConfidence ? (
                            <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-sky-100">
                              {officialTipConfidence}
                            </span>
                          ) : null}

                        </div>
                        {isConsensusPick ? (
                          <p className="mt-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-100">
SmartPunt Consensus Pick — Calculator and The
Maverick agree
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-[132px]">
                        {!isClosedRace ? (
                          <TipAcceptanceControl
                            tipKey={`head-${officialRaceTip.id}`}
                            activeKey={acceptingTipKey}
                            setActiveKey={setAcceptingTipKey}
                            activeBet={activeHeadTipperUserBet}
                            isSaving={isSavingTip}
                            formAction={addUserBetFormAction}
buttonLabel="Accept Maverick Tip"
                            hiddenFields={{
                              source: "head_tipper",
                              suggested_tip_id:
                                officialRaceTip.id,
                              race_id:
                                officialRaceTip.race_id ||
                                activeRace?.id ||
                                "",
                              race_runner_id:
                                officialRaceTip.race_runner_id ||
                                officialRaceTipRunner?.id ||
                                "",
                              horse_id:
                                officialRaceTip.horse_id ||
                                officialRaceTipRunner?.horse_id ||
                                "",
                              horse:
                                officialTipSelection,
                              race:
                                officialRaceTip.race ||
                                activeRaceLabel,
                              bet_type:
                                officialTipType,
                            }}
                          />
                        ) : (
                          <div className="mt-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-center text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">
                            Race Finalised
                          </div>
                        )}
                      </div>
                    </div>

                    {officialTipAngle ? (
                      <div className="relative mt-4 overflow-hidden rounded-[18px] border-2 border-amber-300/70 bg-[linear-gradient(135deg,rgba(251,191,36,0.24)_0%,rgba(120,53,15,0.34)_42%,rgba(0,0,0,0.72)_100%)] px-4 py-4 shadow-[0_0_24px_rgba(251,191,36,0.18),0_12px_28px_rgba(0,0,0,0.35)]">
                        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl" />

                        <div className="relative flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-200/40 bg-black/65 shadow-[0_0_16px_rgba(251,191,36,0.22)]">
<img
  src="/maverick/maverick-shield.png"
  alt=""
  className="h-full w-full object-contain p-0.5"
/>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
The Maverick's Angle
                            </p>

                            <p className="mt-2 text-[14px] font-bold leading-6 text-white">
                              {officialTipAngle}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {officialTipComment ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOfficialTipComment((value) => !value)
                          }
                          className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 transition hover:bg-white/10"
                        >
{expandedOfficialTipComment
  ? "Hide Maverick Insight"
  : "Read Maverick Insight"}
                        </button>

                        {expandedOfficialTipComment ? (
                          <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-black/45 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
Maverick Insight
                            </p>
                            <p className="mt-2 text-[12px] font-semibold leading-6 text-zinc-200">
                              {officialTipComment}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
) : null}

{activeRaceWatchSuggestions.length > 0 ? (
  <div className="rounded-[20px] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(0,0,0,0.96)_0%,rgba(24,24,27,0.96)_65%,rgba(120,53,15,0.18)_100%)] p-3 shadow-[0_14px_35px_rgba(0,0,0,0.35)]">
    <div className="flex items-center gap-3">
      <img
        src="/maverick/maverick-shield.png"
        alt="The Maverick"
        className="h-10 w-10 shrink-0 object-contain"
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
          The Maverick — Watch Alert
        </p>

        <p className="mt-1 text-[10px] font-semibold text-zinc-400">
          A horse on The Maverick&apos;s watch list is racing today.
        </p>
      </div>
    </div>

    <div className="mt-3 space-y-2">
      {activeRaceWatchSuggestions.map(
        (suggestion) => (
          <div
            key={suggestion.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">
                {suggestion.horse || "Watch Selection"}
              </p>

              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-200">
                Watch
              </span>
            </div>

            {suggestion.commentary ? (
              <p className="mt-2 text-[11px] font-semibold leading-5 text-zinc-300">
                {suggestion.commentary}
              </p>
            ) : null}
          </div>
        ),
      )}
    </div>
  </div>
) : null}

<div className="rounded-[22px] border border-amber-400/45 bg-[linear-gradient(135deg,#050505_0%,#0b1120_58%,#050505_100%)] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
        🏆 SmartPunt Calculator Top 3
      </p>
      <p className="mt-1 text-[10px] font-semibold text-zinc-300">
        {isClosedRace
          ? "Frozen Calculator ranking recorded before this race was settled."
          : "Released Calculator ranking for this race."}
      </p>
    </div>

    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
      Calculator
    </span>
  </div>

  {calculatorWinnerResult ? (
    <div className="relative mt-4 overflow-hidden rounded-[20px] border-2 border-amber-200 bg-[radial-gradient(circle_at_top,rgba(253,224,71,0.30),transparent_42%),linear-gradient(135deg,#78350f_0%,#171717_44%,#020202_100%)] shadow-[0_0_38px_rgba(251,191,36,0.36),0_18px_36px_rgba(0,0,0,0.52)]">
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />

      <div className="relative px-4 py-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
          SmartPunt Calculator
        </p>

        <p className="mt-2 text-[25px] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(251,191,36,0.35)]">
          🏆{" "}
          {calculatorWinnerResult.wasOfficialWinTip
            ? "Win Tip Landed"
            : "Calculator #1 Won"}
        </p>

        <div className="mx-auto mt-4 h-px w-3/4 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

        <p className="mt-4 text-[22px] font-black leading-tight text-amber-100">
          {calculatorWinnerResult.runner.horse_name}
        </p>

        <div className="mt-3 inline-flex items-center rounded-full border border-amber-100/70 bg-amber-300/20 px-5 py-2 text-[16px] font-black uppercase tracking-[0.15em] text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.25)]">
          1ST
        </div>

        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/75">
          {calculatorWinnerResult.wasOfficialWinTip
            ? "SmartPunt Win selection salutes"
            : "Calculator top-rated runner salutes"}
        </p>
      </div>
    </div>
  ) : null}

  {calculatorExoticResults?.anyHit ? (
    <div className="relative mt-4 overflow-hidden rounded-[20px] border-2 border-amber-300/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_38%),linear-gradient(135deg,#451a03_0%,#09090b_46%,#020617_100%)] shadow-[0_0_34px_rgba(251,191,36,0.28),0_16px_34px_rgba(0,0,0,0.50)]">
      <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 border-b border-amber-300/25 px-4 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
            SmartPunt Result
          </p>

          <p className="mt-1 text-[19px] font-black uppercase leading-tight text-white">
            🔥 Exotics Landed
          </p>
        </div>

        <div className="rounded-full border border-amber-100/60 bg-amber-300/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.20)]">
          Result
        </div>
      </div>

      <div className="relative p-3">
        <div className="grid grid-cols-2 gap-2">
          {calculatorExoticResults.quinella ? (
            <div className="rounded-[16px] border border-emerald-300/55 bg-[linear-gradient(145deg,rgba(16,185,129,0.24),rgba(2,6,23,0.78))] px-3 py-4 text-center shadow-[0_0_18px_rgba(16,185,129,0.15)]">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200/80">
                Top 2 Landed
              </p>

              <p className="mt-1 text-[19px] font-black text-emerald-50">
                ✓ Quinella
              </p>

              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-emerald-200/70">
                Any Order
              </p>
            </div>
          ) : null}

          {calculatorExoticResults.exacta ? (
            <div className="rounded-[16px] border border-amber-200/70 bg-[linear-gradient(145deg,rgba(251,191,36,0.28),rgba(69,26,3,0.50),rgba(2,6,23,0.78))] px-3 py-4 text-center shadow-[0_0_20px_rgba(251,191,36,0.18)]">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/80">
                Top 2 In Order
              </p>

              <p className="mt-1 text-[19px] font-black text-amber-50">
                ✓ Exacta
              </p>

              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-amber-100/70">
                Exact Order
              </p>
            </div>
          ) : null}
        </div>

        {calculatorExoticResults.allWaysTrifecta ? (
          <div className="relative mt-2 overflow-hidden rounded-[18px] border-2 border-yellow-200/80 bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.22),transparent_45%),linear-gradient(135deg,#854d0e_0%,#422006_34%,#09090b_100%)] px-4 py-5 text-center shadow-[0_0_30px_rgba(250,204,21,0.30)]">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-yellow-100 to-transparent" />

            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-yellow-100/80">
              Top 3 Landed
            </p>

            <p className="mt-2 text-[22px] font-black uppercase leading-tight text-yellow-50">
              🏆 All Ways Trifecta
            </p>

            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.15em] text-yellow-100/75">
              Calculator Top 3 filled the trifecta
            </p>
          </div>
        ) : null}

        <p className="mt-3 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Frozen pre-race Calculator rankings · actual race result
        </p>
      </div>
    </div>
  ) : null}

<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
                    {calculatorTopThree.map((runner, index) => {
                      const isTip =
                        qualifiedTip &&
                        Number(qualifiedTip.runner.id) === Number(runner.id);

                      const isWinTip = isTip && qualifiedTip.type === "Win";
                      const isPlaceTip = isTip && qualifiedTip.type === "Place";
const calculatorTipType = isWinTip
  ? "Win"
  : isPlaceTip
    ? "Place"
    : "";

const finishingPosition = formatFinishingPosition(
  (runner as any).finishing_position,
);

const isResulted = finishingPosition !== null;

                      return (
                        <div
                          key={runner.id}
                          className={`relative min-h-[150px] overflow-hidden rounded-2xl border p-3 ${
                            isWinTip
                              ? "border-amber-300 bg-amber-950/70 shadow-lg shadow-amber-400/20"
                              : isPlaceTip
                                ? "border-zinc-200 bg-zinc-800"
                                : index === 2
                                  ? "border-orange-400/60 bg-zinc-950"
                                  : "border-zinc-700 bg-zinc-950"
                          }`}
                        >
                          <div
                            className={`absolute left-0 top-0 flex h-10 w-10 items-start justify-start bg-gradient-to-br ${
                              index === 0
                                ? "from-zinc-500"
                                : index === 1
                                  ? "from-zinc-300"
                                  : "from-orange-400"
                            } to-transparent pl-2.5 pt-1.5 text-lg font-black text-black`}
                          >
                            {index + 1}
                          </div>
                          <p className="ml-8 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
                            Calculator #{index + 1}
                          </p>
                          <p className="mt-5 text-[15px] font-black leading-tight text-white">
                            {runner.horse_name}
                          </p>
                          {isResulted ? (
  <div
    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
      Number((runner as any).finishing_position) === 1
        ? "border-amber-300/60 bg-amber-400/20 text-amber-100"
        : Number((runner as any).finishing_position) <= 3
          ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
          : "border-white/15 bg-white/10 text-zinc-300"
    }`}
  >
    {Number((runner as any).finishing_position) === 1
      ? `🏆 Finished ${finishingPosition}`
      : `Finished ${finishingPosition}`}
  </div>
) : null}
                          <p className="mt-2 text-[10px] font-bold text-zinc-300">
                            Score {roundScore(runner.score)} · Win{" "}
                            {runner.winPercent}% · Rank #{runner.rank}
                          </p>
                          <div
                            className={`mt-3 rounded-xl border px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] ${
                              isWinTip
                                ? "border-amber-300/50 bg-amber-400/15 text-amber-100"
                                : isPlaceTip
                                  ? "border-sky-300/45 bg-sky-400/15 text-sky-100"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            {isWinTip
                              ? "🏆 Win Tip"
                              : isPlaceTip
                                ? "🥈 Place Tip"
                                : "⊘ No Bet"}
                          </div>

{calculatorTipType && !isClosedRace ? (
  <TipAcceptanceControl
    tipKey={`calculator-${activeRace?.id}-${runner.id}`}
    activeKey={acceptingTipKey}
    setActiveKey={setAcceptingTipKey}
    activeBet={activeCalculatorUserBet}
    isSaving={isSavingTip}
    formAction={addUserBetFormAction}
    buttonLabel={`Accept ${calculatorTipType} Tip`}
    hiddenFields={{
      source: "calculator",
      calculator_tip_id: calculatorRaceTip?.id || "",
      race_id: activeRace?.id || "",
      race_runner_id: runner.id,
      horse_id: runner.horse_id || "",
      horse: runner.horse_name || "",
      race: activeRaceLabel,
      bet_type: calculatorTipType,
    }}
  />
) : null}

{!isClosedRace && activeRace ? (
  <Link
    href={`/subscriber-dashboard?raceId=${encodeURIComponent(
      String(activeRace.id),
    )}&runnerId=${encodeURIComponent(
      String(runner.id),
    )}`}
    className="mt-3 flex w-full items-center justify-center rounded-xl border border-amber-300/45 bg-amber-400/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-300 hover:bg-amber-400/20"
  >
    Build My Own Bet →
  </Link>
) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {raceConfidence ? (
                  <div className="rounded-[22px] border border-amber-400/45 bg-[linear-gradient(135deg,#050505_0%,#111827_54%,#030712_100%)] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                    <div className="grid grid-cols-[0.82fr_1.18fr] gap-4">
                      <div className="border-r border-amber-400/20 pr-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300">
                          Race Confidence
                        </p>
                        <p className="mt-3 bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-5xl font-black leading-none text-transparent">
                          {raceConfidence.confidencePercent}%
                        </p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
                          {raceConfidence.tier} Confidence
                        </p>
                        <div className="mt-4 h-14 w-24 rounded-t-full border-[10px] border-b-0 border-zinc-700 border-l-amber-400 border-t-amber-400" />
                      </div>

                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-300">
                          Why this race scores{" "}
                          {raceConfidence.confidencePercent}%
                        </p>
                        <p className="mt-3 text-sm font-bold leading-6 text-white">
                          {raceConfidence.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-[10px] font-black text-sky-100">
                            Gap +{raceConfidence.gap}
                          </span>
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[10px] font-black text-amber-100">
                            {raceConfidence.volatility}
                          </span>
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black text-emerald-100">
                            Suggested: {qualifiedTip?.type || "No Bet"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-amber-400/20 pt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
                        🎯 SmartPunt Tip Requirements
                      </p>
                      {tipThresholds ? (
                        raceConfidence.tier === "Low" ? (
                          <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-[11px] font-semibold leading-5 text-amber-100">
                            Low Confidence race: SmartPunt does not issue Win or
                            Place Tips while race confidence is Low.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-2">
                            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] font-semibold leading-5 text-zinc-200">
                              Win: Score {tipThresholds.minWinScore}+ · Gap{" "}
                              {tipThresholds.minWinGap}+ · Win{" "}
                              {tipThresholds.minWinPercent}%+
                            </p>
                            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] font-semibold leading-5 text-zinc-200">
                              Place:{" "}
                              {tipThresholds.placeBettingAllowed
                                ? `Score ${tipThresholds.minPlaceScore}+ · Gap ${tipThresholds.minPlaceGap}+ · Place ${tipThresholds.minPlacePercent}%+`
                                : "Place betting disabled for this race"}
                            </p>
                          </div>
                        )
                      ) : null}

                      <p className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/15 px-3 py-3 text-[11px] font-semibold leading-5 text-sky-100">
                        ⓘ Race Confidence measures the quality of the betting
                        race, not just the quality of the top-rated horse.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[20px] border border-emerald-400/45 bg-black p-3 shadow-[0_12px_25px_rgba(0,0,0,0.35)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                      🎯 Betting Verdict
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {bettingVerdictLabel}
                    </p>
                    <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-300">
                      {bettingVerdictSummary}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-amber-400/45 bg-black p-3 shadow-[0_12px_25px_rgba(0,0,0,0.35)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                      ⚠️ Watchouts
                    </p>
                    <div className="mt-2 space-y-2">
                      {watchouts.map((item) => (
                        <p
                          key={item}
                          className="text-[10px] font-semibold leading-4 text-zinc-300"
                        >
                          ⚠️ {item}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-rose-300/45 bg-black p-3 shadow-[0_12px_25px_rgba(0,0,0,0.35)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-200">
                      🚨 Alert Candidates
                    </p>
                    <div className="mt-2 space-y-2">
                      {activeSpecialistAlerts.length ? (
                        activeSpecialistAlerts.slice(0, 3).map((alert) => (
                          <div key={`${alert.horseName}-${alert.label}`}>
                            <p className="text-[10px] font-black text-white">
                              {alert.horseName}
                            </p>
                            <p className="text-[9px] font-semibold leading-4 text-zinc-300">
                              {alert.label}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-semibold leading-4 text-zinc-300">
                          No runners currently exceed the threshold.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {!officialRaceTip ? (
                  <div className="rounded-[22px] border border-amber-400/45 bg-[linear-gradient(135deg,#080808_0%,#111827_58%,#020617_100%)] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
<div className="flex items-center gap-2.5">
  <img
    src="/maverick/maverick-shield.png"
    alt=""
    className="h-9 w-9 shrink-0 object-contain opacity-80"
  />

  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
    The Maverick Status
  </p>
</div>
                    <p className="mt-3 text-lg font-black text-zinc-200">
⚪ No Official Maverick Selection
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-zinc-300">
The Maverick has not published an official selection for
this race. If the calculator has a live Win or Place
recommendation, you can accept it directly on that horse
in the SmartPunt Calculator Top 3 above.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-[22px] border border-zinc-700 bg-black/95 p-4 shadow-[0_14px_35px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                        📊 Full Field Breakdown
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-zinc-400">
{isClosedRace
  ? "Final prediction snapshot with finishing positions."
  : "Released Calculator ranking for every runner in this race."}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-200">
                      {scoredRunners.length} runners
                    </span>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-[980px] divide-y divide-white/10 text-left text-[11px]">
                      <thead className="bg-white/[0.06] text-[9px] uppercase tracking-[0.14em] text-zinc-400">
                        <tr>
<th className="px-3 py-3 font-black">Rank</th>
<th className="px-3 py-3 font-black">Result</th>
<th className="px-3 py-3 font-black">Runner</th>
<th className="px-3 py-3 font-black">Jockey</th>
                          <th className="px-3 py-3 font-black text-center">
                            Form
                          </th>
                          <th className="px-3 py-3 font-black text-center">
                            Distance
                          </th>
                          <th className="px-3 py-3 font-black text-center">
                            Track
                          </th>
                          <th className="px-3 py-3 font-black text-center">
                            Conditions
                          </th>
                          <th className="px-3 py-3 font-black">Score</th>
                          <th className="px-3 py-3 font-black">Win</th>
                          <th className="px-3 py-3 font-black">Place</th>
                          <th className="px-3 py-3 font-black">Verdict</th>
                          <th className="px-3 py-3 font-black text-center">
                            Vault
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 bg-black/35">
                        {scoredRunners.map((runner) => {
                          const isCalculatorTip =
                            qualifiedTip &&
                            Number(qualifiedTip.runner.id) ===
                              Number(runner.id);
                          const isOfficialTip =
                            officialRaceTipRunner &&
                            Number(officialRaceTipRunner.id) ===
                              Number(runner.id);
const isWatchSuggestion =
  watchSuggestionRunnerIds.has(
    Number(runner.id),
  ) ||
  watchSuggestionHorseIds.has(
    Number(runner.horse_id),
  );

const isInSubscriberVault =
  activeRaceVaultRunnerIds.has(
    Number(runner.id),
  ) ||
  activeRaceVaultHorseIds.has(
    Number(runner.horse_id),
  );

return (
                            <tr
                              key={runner.id}
                              className={
                                isOfficialTip
                                  ? "bg-emerald-500/10"
                                  : isCalculatorTip
                                    ? "bg-amber-500/10"
                                    : "hover:bg-white/[0.04]"
                              }
                            >
<td className="px-3 py-3 font-black text-amber-200">
  #{runner.rank}
</td>

<td className="px-3 py-3">
  {(runner as any).finishing_position ? (
    <span
      className={`inline-flex min-w-[48px] items-center justify-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
        Number((runner as any).finishing_position) === 1
          ? "border-amber-300/60 bg-amber-400/20 text-amber-100"
          : Number((runner as any).finishing_position) <= 3
            ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
            : "border-white/10 bg-white/10 text-zinc-300"
      }`}
    >
      {Number((runner as any).finishing_position) === 1
        ? `🏆 ${formatFinishingPosition(
            (runner as any).finishing_position,
          )}`
        : formatFinishingPosition(
            (runner as any).finishing_position,
          )}
    </span>
  ) : (
    <span className="text-zinc-600">—</span>
  )}
</td>

<td className="px-3 py-3">
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
<p className="mt-1 text-[10px] font-semibold text-zinc-500">
  Barrier {runner.barrier || "—"}{" "}
  {isOfficialTip
    ? "• Maverick Tip"
    : isCalculatorTip
      ? "• Calculator Tip"
      : isWatchSuggestion
        ? "• WATCH"
        : ""}
</p>
<div className="mt-1 flex flex-wrap gap-1.5">
  {isWatchSuggestion ? (
    <span className="inline-flex rounded-full border border-violet-300/35 bg-violet-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-violet-200">
      SmartPunt Watch
    </span>
  ) : null}

  {isInSubscriberVault ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-200">
      <VaultDoorIcon className="h-3.5 w-3.5" />
      In Your Vault
    </span>
  ) : null}
</div>
                              </td>
                              <td className="px-3 py-3 font-semibold text-zinc-300">
                                {(runner as any).jockey_name || "—"}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <ScoreStars
                                  score={runner.components.recentForm}
                                />
                                <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                                  {roundScore(runner.components.recentForm)}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <ScoreStars
                                  score={runner.components.distance}
                                />
                                <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                                  {roundScore(runner.components.distance)}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <ScoreStars score={runner.components.track} />
                                <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                                  {roundScore(runner.components.track)}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <ScoreStars
                                  score={runner.components.condition}
                                />
                                <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                                  {roundScore(runner.components.condition)}
                                </p>
                              </td>
                              <td className="px-3 py-3 font-black text-white">
                                {roundScore(runner.score)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-zinc-300">
                                {roundScore(runner.winPercent)}%
                              </td>
                              <td className="px-3 py-3 font-semibold text-zinc-300">
                                {roundScore(runner.placePercent)}%
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
                                    isOfficialTip
                                      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                                      : isCalculatorTip
                                        ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
                                        : "border-white/10 bg-white/10 text-zinc-300"
                                  }`}
                                >
{isOfficialTip
  ? "Maverick"
  : isCalculatorTip
    ? qualifiedTip?.type
    : "No Bet"}
                                </span>
                              </td>

  <td className="px-3 py-3 text-center">
  {isInSubscriberVault ? (
    <Link
      href="/the-vault"
      title={`${runner.horse_name} is in your Vault`}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-400/15"
    >
      <VaultDoorIcon className="h-5 w-5 shrink-0" />
      <span>Saved</span>
    </Link>
  ) : (
    <Link
      href={`/the-vault?horseId=${encodeURIComponent(
        String(runner.horse_id),
      )}&horseName=${encodeURIComponent(
        runner.horse_name,
      )}#add-to-vault`}
      title={`Add ${runner.horse_name} to The Vault`}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/45 bg-amber-400/10 px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200 transition hover:border-amber-300 hover:bg-amber-400/20"
    >
      <VaultDoorIcon className="h-5 w-5 shrink-0" />
      <span>Vault</span>
    </Link>
  )}
</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              ) : (
                <div className="rounded-[22px] border border-amber-400/45 bg-black p-5 text-center">
                  <h2 className="text-xl font-black text-white">
                    No races available for {selectedRaceDayLabel}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-zinc-400">
                    Try viewing Yesterday or Today, or check back once races are loaded for this day.
                  </p>
                </div>
              )}
            </div>
          </div>

          <footer className="mt-3 overflow-hidden rounded-[22px] border border-amber-300/40 bg-[linear-gradient(135deg,#05070c_0%,#0b1220_52%,#05070c_100%)] p-5 text-center shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
            <img
              src="/header-logo.png"
              alt="Fortune on 5"
              className="mx-auto h-40 w-auto object-contain drop-shadow-[0_0_32px_rgba(250,204,21,0.72)] sm:h-48"
            />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Fortune on 5
            </p>
            <h2 className="mt-2 text-xl font-black leading-tight text-white">
              SmartPunt Calculator Live Picks
            </h2>
            <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-300">
              Every race analysed. Every recommendation explained.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Pill tone="green">{orderedPublishedRaces.length} {selectedRaceDayLabel.toLowerCase()} races</Pill>
              <Pill tone="gold">Live calculator</Pill>
<Pill tone="blue">The Maverick</Pill>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
