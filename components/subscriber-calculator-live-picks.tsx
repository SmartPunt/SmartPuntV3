"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { addUserBetAction } from "@/lib/actions";
import VaultDoorIcon from "@/components/vault-door-icon";
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
    tip?.type || tip?.bet_type || tip?.tip_type || "Official Tip",
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
      .join(" ") || "Official Tip"
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

          <div className="mt-3 grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-2 gap-2">
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

export default function SubscriberCalculatorLivePicks({
  races,
  runners,
  horses,
  meetings,
  jockeyProfiles,
  calculatorTips = [],
  officialTips = [],
  activeUserBets = [],
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
  officialTips?: OfficialTip[];
  activeUserBets?: UserBet[];
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
    ? meetings.find((item) => item.id === activeRace.meeting_id)
    : undefined;

  const scoredRunners = useMemo(
    () =>
      calculateRaceScores({
        activeRace,
        races,
        runners,
        horses,
        meetings,
        jockeyProfiles,
      }),
    [activeRace, horses, jockeyProfiles, meetings, races, runners],
  );

  const topWinChance = scoredRunners[0] || null;
  const calculatorTopThree = scoredRunners.slice(0, 3);

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

  const raceConfidence = useMemo(
    () =>
      scoredRunners.length
        ? calculateRaceConfidence(scoredRunners, {
            trackCondition: topWinChance?.track_condition || null,
            raceName: activeRace?.race_name || "",
            placeTerms: activeRace?.place_terms || "top_3",
          })
        : null,
    [
      activeRace?.place_terms,
      activeRace?.race_name,
      scoredRunners,
      topWinChance?.track_condition,
    ],
  );

const tipThresholds = useMemo(
  () =>
    raceConfidence
      ? getCalculatorTipThresholds(raceConfidence, {
          trackCondition: topWinChance?.track_condition || null,
          placeTerms: activeRace?.place_terms || "top_3",
          meetingDate: activeMeeting?.meeting_date || null,
        })
      : null,
  [
    activeMeeting?.meeting_date,
    activeRace?.place_terms,
    raceConfidence,
    topWinChance?.track_condition,
  ],
);

const qualifiedTip = useMemo(
  () =>
    getQualifiedCalculatorTip(scoredRunners, {
      trackCondition: topWinChance?.track_condition || null,
      raceName: activeRace?.race_name || "",
      placeTerms: activeRace?.place_terms || "top_3",
      meetingDate: activeMeeting?.meeting_date || null,
    }),
  [
    activeMeeting?.meeting_date,
    activeRace?.place_terms,
    activeRace?.race_name,
    scoredRunners,
    topWinChance?.track_condition,
  ],
);

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
      officialRaceTip.tip_angle ||
      "The Head Tipper has endorsed this race. View the full write-up in Current Tips."
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
        (item) => Number(item.id) === Number(race.meeting_id),
      );
      const raceScoredRunners = calculateRaceScores({
        activeRace: race,
        races,
        runners,
        horses,
        meetings,
        jockeyProfiles,
      });

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

    return items
      .sort((a, b) => {
        if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup;
        if (b.confidencePercent !== a.confidencePercent) {
          return b.confidencePercent - a.confidencePercent;
        }
        const meetingCompare = a.meetingName.localeCompare(b.meetingName);
        if (meetingCompare !== 0) return meetingCompare;
        return a.raceNumber - b.raceNumber;
      });
  }, [
    horses,
    jockeyProfiles,
    meetings,
    officialTips,
    orderedPublishedRaces,
    races,
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
              {bestOpportunities.length ? (
                bestOpportunities.map((item) => {
                  const isSelected =
                    activeRace && Number(activeRace.id) === Number(item.raceId);
                  const sourceClasses =
                    item.source === "CONSENSUS"
                      ? "border-emerald-300/45 bg-emerald-500/20 text-emerald-100"
                      : item.source === "HEAD"
                        ? "border-amber-300/45 bg-amber-500/20 text-amber-100"
                        : "border-sky-300/45 bg-sky-500/20 text-sky-100";
                  const betClasses = item.betType.toLowerCase().includes("win")
                    ? "border-emerald-300/45 bg-emerald-500/20 text-emerald-100"
                    : "border-sky-300/45 bg-sky-500/20 text-sky-100";

                  return (
                    <button
                      key={`${item.source}-${item.raceId}-${item.horseName}`}
                      type="button"
                      onClick={() => setSelectedRaceId(String(item.raceId))}
                      className={`grid w-full grid-cols-[58px_1fr_56px] items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? "border-amber-300 bg-amber-300/20 shadow-[0_0_0_1px_rgba(251,191,36,0.35)_inset]"
                          : "border-white/10 bg-black/65 hover:border-amber-300/45 hover:bg-black/85"
                      }`}
                    >
                      <span
                        className={`rounded-full border px-2 py-1 text-center text-[8px] font-black uppercase tracking-[0.1em] ${sourceClasses}`}
                      >
                        {item.source}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-300">
                          <span>{item.raceLabel}</span>
                          <span className="text-[8px] tracking-normal text-amber-200/80">
                            {getConfidenceStars(item.confidencePercent)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] font-black leading-tight text-white">
                          {item.horseName}
                        </span>
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-center text-[8px] font-black uppercase tracking-[0.1em] ${betClasses}`}
                      >
                        {item.betType}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/55 px-3 py-3 text-center text-[11px] font-bold text-zinc-300">
                  No SmartPunt opportunities yet. Use the race selector below to
                  review every live race.
                </div>
              )}
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
                  <div className="rounded-[18px] border border-zinc-300 bg-white p-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700">
                    Choose {selectedRaceDayLabel.toLowerCase()} race
                  </label>
                  <select
                    value={String(activeRace.id)}
                    onChange={(event) => setSelectedRaceId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-950 outline-none"
                  >
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

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!previousRace}
                      onClick={() =>
                        previousRace &&
                        setSelectedRaceId(String(previousRace.id))
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-black text-zinc-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ◀ Previous Race
                    </button>
                    <button
                      type="button"
                      disabled={!nextRace}
                      onClick={() =>
                        nextRace && setSelectedRaceId(String(nextRace.id))
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-black text-zinc-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next Race ▶
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-amber-400/45 bg-[linear-gradient(135deg,#05070c_0%,#0b1220_58%,#05070c_100%)] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-amber-400/40 bg-black px-4 py-3 text-3xl font-black text-amber-300">
                        R{activeRace.race_number}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                          {activeMeeting?.meeting_name || "Meeting"} ·{" "}
                          {activeMeeting?.meeting_date || ""}
                        </p>
                        <h2 className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">
                          {activeRace.race_name}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-zinc-300">
                          {activeRace.distance_m || "—"}m ·{" "}
                          {activeMeeting?.track_condition || "Track not set"} ·{" "}
                          {placeTermsLabel(activeRace.place_terms)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        qualifiedTip
                          ? qualifiedTip.type === "Win"
                            ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
                            : "border-sky-300/50 bg-sky-500/20 text-sky-100"
                          : "border-amber-300/50 bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      {bettingVerdictLabel}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_54px_1fr] overflow-hidden rounded-2xl border border-amber-400/30 bg-black/45 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">
                    <button
                      type="button"
                      disabled={!previousRace}
                      onClick={() =>
                        previousRace &&
                        setSelectedRaceId(String(previousRace.id))
                      }
                      className="px-2 py-2 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ‹ Prev
                    </button>
                    <div className="border-x border-amber-400/20 px-2 py-2 text-center text-white">
                      {activeRaceIndex >= 0 ? `${activeRaceIndex + 1}` : "—"}
                    </div>
                    <button
                      type="button"
                      disabled={!nextRace}
                      onClick={() =>
                        nextRace && setSelectedRaceId(String(nextRace.id))
                      }
                      className="px-2 py-2 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Next ›
                    </button>
                  </div>
                </div>

                {officialRaceTip ? (
                  <div className="rounded-[20px] border border-emerald-300/45 bg-[linear-gradient(135deg,rgba(6,78,59,0.55)_0%,rgba(2,6,23,0.96)_55%,rgba(0,0,0,0.98)_100%)] p-3 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
                          ⭐ Official SmartPunt Tip
                        </p>
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

                          {officialTipAngle ? (
                            <span className="rounded-full border border-amber-300/45 bg-amber-400/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">
                              {officialTipAngle}
                            </span>
                          ) : null}
                        </div>
                        {isConsensusPick ? (
                          <p className="mt-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-100">
                            SmartPunt Consensus Pick — calculator and Head
                            Tipper agree
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-[132px]">
                        <TipAcceptanceControl
                          tipKey={`head-${officialRaceTip.id}`}
                          activeKey={acceptingTipKey}
                          setActiveKey={setAcceptingTipKey}
                          activeBet={activeHeadTipperUserBet}
                          isSaving={isSavingTip}
                          formAction={addUserBetFormAction}
                          buttonLabel="Accept Tip"
                          hiddenFields={{
                            source: "head_tipper",
                            suggested_tip_id: officialRaceTip.id,
                            race_id: officialRaceTip.race_id || activeRace?.id || "",
                            race_runner_id:
                              officialRaceTip.race_runner_id || officialRaceTipRunner?.id || "",
                            horse_id:
                              officialRaceTip.horse_id || officialRaceTipRunner?.horse_id || "",
                            horse: officialTipSelection,
                            race: officialRaceTip.race || activeRaceLabel,
                            bet_type: officialTipType,
                          }}
                        />
                      </div>
                    </div>

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
                            ? "Hide Head Tipper Comment"
                            : "Read Head Tipper Comment"}
                        </button>

                        {expandedOfficialTipComment ? (
                          <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-black/45 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
                              Head Tipper Comment
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

                <div className="rounded-[22px] border border-amber-400/45 bg-[linear-gradient(135deg,#050505_0%,#0b1120_58%,#050505_100%)] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
                        🏆 SmartPunt Calculator Top 3
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-zinc-300">
                        Ranked by the live calculator score for this race.
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                      Calculator
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
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

                          {calculatorTipType ? (
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
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                      ⭐ Head Tipper Status
                    </p>
                    <p className="mt-3 text-lg font-black text-zinc-200">
                      ⚪ No Official Head Tipper Tip
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-zinc-300">
                      The Head Tipper has not published an official selection
                      for this race. If the calculator has a live Win or Place
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
                        Live calculator ranking for every runner in this race.
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
                                    ? "• Official Tip"
                                    : isCalculatorTip
                                      ? "• Calculator Tip"
                                      : ""}
                                </p>
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
                                    ? "Official"
                                    : isCalculatorTip
                                      ? qualifiedTip?.type
                                      : "No Bet"}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-center">
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
              <Pill tone="blue">Head Tipper status</Pill>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
