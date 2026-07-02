"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  race_id?: number | null;
  race_runner_id?: number | null;
  horse_id?: number | null;
  horse_name?: string | null;
  bet_type?: string | null;
  tip_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  published_at?: string | null;
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
  if (distanceBucket === "1201–1400m") return `${prefix}Short Course Specialist`;
  if (distanceBucket === "1401–1600m") return `${prefix}Mile Specialist`;
  if (distanceBucket === "1601–1800m") return `${prefix}Middle Distance Specialist`;
  if (distanceBucket === "1801–2200m") return `${prefix}Staying Specialist`;
  if (distanceBucket === "2200m+") return emerging ? "Emerging Stayer" : "Stayer";

  return `${prefix}Distance Specialist`;
}

function getConditionSpecialistLabel(conditionBucket: string, emerging = false) {
  const prefix = emerging ? "Emerging " : "";

  if (conditionBucket === "Heavy") return `${prefix}Heavy Tracker`;
  if (conditionBucket === "Soft") return `${prefix}Wet Tracker`;
  if (conditionBucket === "Good") return `${prefix}Good Track Performer`;
  if (conditionBucket === "Synthetic") return `${prefix}Synthetic Performer`;

  return `${prefix}Condition Specialist`;
}

function getSpecialistRunStats<T extends { finishing_position?: number | null }>(
  runs: T[],
) {
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

function scoreStars(score?: number | null) {
  const value = Number(score || 0);
  const filled = Math.max(0, Math.min(5, Math.round(value / 20)));

  return "★".repeat(filled) + "☆".repeat(5 - filled);
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
    const horse = horses.find((item) => Number(item.id) === Number(runner.horse_id));
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
        (run) => getSpecialistDistanceBucket(run.race?.distance_m) === raceDistanceBucket,
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

function Pill({ children, tone = "gold" }: { children: React.ReactNode; tone?: "green" | "gold" | "blue" | "red" | "dark" }) {
  const classes = {
    green: "border-green-400/30 bg-green-500/20 text-green-100 shadow-green-500/10",
    gold: "border-yellow-300/30 bg-yellow-500/20 text-yellow-100 shadow-yellow-500/10",
    blue: "border-sky-400/30 bg-sky-500/20 text-sky-100 shadow-sky-500/10",
    red: "border-rose-400/30 bg-rose-500/20 text-rose-100 shadow-rose-500/10",
    dark: "border-white/15 bg-white/10 text-white shadow-white/10",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-lg ${classes}`}>
      {children}
    </span>
  );
}

function GoldCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-yellow-400/35 bg-[linear-gradient(145deg,rgba(17,17,17,0.98),rgba(2,2,2,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_18px_50px_rgba(0,0,0,0.45)] ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-black text-yellow-300">
      <span>{icon}</span>
      <span>{children}</span>
    </h3>
  );
}

export default function SubscriberCalculatorLivePicks({
  races,
  runners,
  horses,
  meetings,
  jockeyProfiles,
  calculatorTips = [],
  officialTips = [],
}: {
  currentUser: any;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
  jockeyProfiles: JockeyProfile[];
  calculatorTips?: CalculatorTip[];
  officialTips?: OfficialTip[];
}) {
  const [selectedRaceId, setSelectedRaceId] = useState("");

  const publishedRaces = useMemo(
    () => races.filter((race) => race.status === "published"),
    [races],
  );

  const orderedPublishedRaces = useMemo(
    () =>
      [...publishedRaces].sort((a, b) => {
        const meetingA = meetings.find((item) => item.id === a.meeting_id);
        const meetingB = meetings.find((item) => item.id === b.meeting_id);

        const meetingCompare = String(meetingA?.meeting_name || "").localeCompare(
          String(meetingB?.meeting_name || ""),
        );

        if (meetingCompare !== 0) return meetingCompare;

        return Number(a.race_number || 0) - Number(b.race_number || 0);
      }),
    [meetings, publishedRaces],
  );

  const activeRace = useMemo(() => {
    if (selectedRaceId) {
      return (
        orderedPublishedRaces.find((race) => String(race.id) === selectedRaceId) ||
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
          })
        : null,
    [activeRace?.place_terms, raceConfidence, topWinChance?.track_condition],
  );

  const qualifiedTip = useMemo(
    () =>
      getQualifiedCalculatorTip(scoredRunners, {
        trackCondition: topWinChance?.track_condition || null,
        raceName: activeRace?.race_name || "",
        placeTerms: activeRace?.place_terms || "top_3",
      }),
    [
      activeRace?.place_terms,
      activeRace?.race_name,
      scoredRunners,
      topWinChance?.track_condition,
    ],
  );

  const activeRaceIndex = activeRace
    ? orderedPublishedRaces.findIndex((race) => Number(race.id) === Number(activeRace.id))
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
    [activeMeeting, activeRace, horses, meetings, races, runners, scoredRunners],
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

  const raceStartTime = formatStartTime((activeRace as any)?.start_time || (activeRace as any)?.race_time || (activeRace as any)?.jump_time || null);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(120,53,15,0.18),transparent_30%),linear-gradient(180deg,#030303_0%,#090909_48%,#010409_100%)]" />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 lg:px-6">
        <header className="relative overflow-hidden rounded-[24px] border border-yellow-400/40 bg-black shadow-[0_0_60px_rgba(250,204,21,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_38%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-300/80 to-transparent" />
          <div className="relative z-10 flex min-h-[210px] flex-col items-center justify-center px-4 py-7 text-center">
            <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
              <Pill tone="green">Live Picks <span className="h-2 w-2 rounded-full bg-green-300" /></Pill>
            </div>
            <Link
              href="/"
              className="absolute right-4 top-4 rounded-xl border border-yellow-300/40 bg-black/70 px-3 py-2 text-xs font-black text-white shadow-lg transition hover:bg-yellow-400/10 sm:right-6 sm:top-6 sm:px-5 sm:py-3 sm:text-base"
            >
              🏠 Dashboard
            </Link>

            <img
              src="/header-logo.png"
              alt="Fortune on 5 SmartPunt"
              className="mb-2 h-auto w-[300px] max-w-[72%] drop-shadow-[0_0_24px_rgba(250,204,21,0.35)] sm:w-[420px]"
            />
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-lg sm:text-5xl">
              SmartPunt Calculator Live Picks
            </h1>
            <p className="mt-3 text-sm font-medium text-zinc-200 sm:text-lg">
              Every race analysed. Every recommendation explained.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Pill tone="green">◎ {publishedRaces.length} live races</Pill>
              <Pill tone="gold">♙ Live calculator</Pill>
              <Pill tone="blue">☑ Head Tipper status</Pill>
            </div>
          </div>
        </header>

        <div className="mt-4 rounded-[20px] border border-white/15 bg-black/85 p-3 shadow-2xl lg:flex lg:items-center lg:gap-4">
          {activeRace ? (
            <>
              <label className="mb-2 block text-sm font-semibold text-white lg:mb-0 lg:shrink-0">
                Choose race
              </label>
              <select
                value={String(activeRace.id)}
                onChange={(event) => setSelectedRaceId(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/20 bg-black px-4 text-base font-black text-white outline-none transition focus:border-yellow-300 lg:flex-1"
              >
                {orderedPublishedRaces.map((race) => {
                  const meeting = meetings.find((item) => item.id === race.meeting_id);

                  return (
                    <option key={race.id} value={String(race.id)}>
                      {(meeting?.meeting_name || "Meeting")} - R{race.race_number} {race.race_name}
                    </option>
                  );
                })}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-3 lg:mt-0 lg:w-[430px] lg:shrink-0">
                <button
                  type="button"
                  disabled={!previousRace}
                  onClick={() => previousRace && setSelectedRaceId(String(previousRace.id))}
                  className="h-14 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ◀ Previous Race
                </button>
                <button
                  type="button"
                  disabled={!nextRace}
                  onClick={() => nextRace && setSelectedRaceId(String(nextRace.id))}
                  className="h-14 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Race ▶
                </button>
              </div>
            </>
          ) : null}
        </div>

        {activeRace ? (
          <main className="mt-3 rounded-[24px] border border-yellow-400/50 bg-black/95 p-4 shadow-[0_0_40px_rgba(250,204,21,0.08)] sm:p-5 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-yellow-300">
                  {(activeMeeting?.meeting_name || "Meeting")} • R{activeRace.race_number}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {activeRace.race_name}
                </h2>
                <p className="mt-2 text-base font-medium text-zinc-200">
                  {activeRace.distance_m || "—"}m <span className="mx-2 text-yellow-300">•</span>
                  {activeMeeting?.track_condition || "Track not set"} <span className="mx-2 text-yellow-300">•</span>
                  {placeTermsLabel(activeRace.place_terms)}
                </p>
              </div>

              <div className="sm:text-right">
                <div className={`inline-flex rounded-2xl px-5 py-3 text-lg font-black ${qualifiedTip ? "bg-green-400 text-black" : "bg-yellow-300 text-black"}`}>
                  {bettingVerdictLabel}
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-200">Start Time</p>
                <p className="text-lg font-bold text-white">{raceStartTime}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <GoldCard className="p-4">
                <CardTitle icon="🏆">SmartPunt Calculator Top 3</CardTitle>
                <div className="mt-4 space-y-3">
                  {calculatorTopThree.map((runner, index) => (
                    <div key={runner.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-inner">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${index === 0 ? "bg-yellow-500/80 text-black" : index === 1 ? "bg-zinc-400/80 text-black" : "bg-amber-700/80 text-white"}`}>
                        {index + 1}
                      </div>
                      <div className="hidden text-3xl sm:block">{getRunnerSilk(index)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-white">{runner.horse_name}</p>
                        <p className="mt-1 text-xs font-medium text-zinc-300">Barrier {runner.barrier || "—"} • Score {roundScore(runner.score)}</p>
                      </div>
                      <div className="text-right text-xs font-bold text-zinc-200">
                        <p>Win {roundScore(runner.winPercent)}%</p>
                        <p className="mt-1">Place {roundScore(runner.placePercent)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center text-sm font-black text-yellow-300">View full field breakdown ↓</p>
              </GoldCard>

              <GoldCard className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle icon="🛡️">Race Confidence</CardTitle>
                  {raceConfidence ? (
                    <Pill tone={raceConfidence.tier === "Low" ? "red" : raceConfidence.tier === "Medium" ? "gold" : "green"}>
                      {raceConfidence.tier} - {raceConfidence.confidencePercent}%
                    </Pill>
                  ) : null}
                </div>
                <p className="mt-5 text-sm font-medium leading-7 text-zinc-200">
                  {raceConfidence?.summary || "Race confidence unavailable."}
                </p>
                <div className="mt-5 space-y-2">
                  <div className="rounded-2xl border border-yellow-400/20 bg-black/60 p-4">
                    <p className="text-xs text-zinc-300">Ratings Gap</p>
                    <p className="mt-1 text-2xl font-black text-white">{raceConfidence?.gap ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-yellow-400/20 bg-black/60 p-4">
                    <p className="text-xs text-zinc-300">Race Shape</p>
                    <p className="mt-1 text-xl font-black text-white">{raceConfidence?.volatility || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-yellow-400/20 bg-black/60 p-4">
                    <p className="text-xs text-zinc-300">Field</p>
                    <p className="mt-1 text-xl font-black text-white">{fieldSizeLabel}</p>
                  </div>
                </div>
              </GoldCard>

              <GoldCard className="p-4">
                <CardTitle icon="🎯">SmartPunt Tip Requirements</CardTitle>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Win Tip</p>
                    <p className="mt-3 text-sm font-medium leading-7 text-white">
                      Score <strong>{tipThresholds?.minWinScore === null ? "Not available" : `${tipThresholds?.minWinScore ?? "—"}+`}</strong>
                      <span className="mx-2 text-yellow-300">•</span> Gap {tipThresholds?.minWinGap ?? "—"}+
                      <span className="mx-2 text-yellow-300">•</span> Win {tipThresholds?.minWinPercent ?? "—"}%+
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-300">Current: {topWinChance?.horse_name || "—"} • Score {topWinChance ? roundScore(topWinChance.score) : "—"} • Win {topWinChance ? roundScore(topWinChance.winPercent) : "—"}%</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Place Tip</p>
                    <p className="mt-3 text-sm font-medium leading-7 text-white">
                      {tipThresholds?.placeBettingAllowed
                        ? `Score ${tipThresholds.minPlaceScore}+ • Gap ${tipThresholds.minPlaceGap}+ • Place ${tipThresholds.minPlacePercent}%+`
                        : "Place betting disabled for this race"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-300">Current: {activeTopPlaceChance?.horse_name || "—"} • Score {activeTopPlaceChance ? roundScore(activeTopPlaceChance.score) : "—"} • Place {activeTopPlaceChance ? roundScore(activeTopPlaceChance.placePercent) : "—"}% • Gap {activeTopPlaceGap}</p>
                  </div>
                </div>
              </GoldCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <GoldCard className="p-5">
                <CardTitle icon="🎯">Betting Verdict</CardTitle>
                <p className="mt-5 text-3xl font-black text-white">{bettingVerdictLabel}</p>
                <p className="mt-3 max-w-xl text-base font-medium leading-7 text-zinc-200">{bettingVerdictSummary}</p>
              </GoldCard>

              <GoldCard className="p-5">
                <CardTitle icon="⭐">Head Tipper Status</CardTitle>
                {officialRaceTip ? (
                  <div className="mt-5">
                    <p className="text-2xl font-black text-green-300">🟢 Official SmartPunt Tip Published</p>
                    <p className="mt-3 text-base leading-7 text-zinc-200">The Head Tipper has endorsed this race. View the full write-up in Current Tips.</p>
                    <Link href="/current-tips" className="mt-4 inline-flex rounded-xl border border-green-400/30 bg-green-500/15 px-4 py-2 text-sm font-black text-green-200 transition hover:bg-green-500/25">View Current Tips</Link>
                  </div>
                ) : qualifiedTip || calculatorRaceTip ? (
                  <div className="mt-5">
                    <p className="text-2xl font-black text-yellow-300">🟡 Calculator Recommendation Only</p>
                    <p className="mt-3 text-base leading-7 text-zinc-200">The SmartPunt Calculator currently recommends this race, but no official Head Tipper selection has been published.</p>
                  </div>
                ) : (
                  <div className="mt-5">
                    <p className="text-2xl font-black text-zinc-100">🟣 Awaiting Review</p>
                    <p className="mt-3 text-base leading-7 text-zinc-200">The Head Tipper has not published an official selection for this race.</p>
                  </div>
                )}
              </GoldCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.6fr]">
              <GoldCard className="p-5">
                <CardTitle icon="⚠️">Watchouts</CardTitle>
                <div className="mt-5 space-y-4">
                  {watchouts.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-base font-medium text-zinc-100">
                      <span className="text-yellow-300">⚠️</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </GoldCard>

              <GoldCard className="p-5">
                <CardTitle icon="🔔">Alert Candidates</CardTitle>
                <div className="mt-5 space-y-3">
                  {activeSpecialistAlerts.length ? (
                    activeSpecialistAlerts.slice(0, 4).map((alert, index) => (
                      <div key={`${alert.horseName}-${alert.label}`} className="flex items-center gap-3 rounded-2xl border border-yellow-400/20 bg-black/55 px-4 py-3">
                        <span className="text-3xl">{getRunnerSilk(index)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-yellow-300">{alert.horseName} <span className="text-zinc-400">•</span> <span className="text-yellow-200">{alert.label}</span></p>
                          <p className="mt-1 text-sm text-zinc-200">{alert.detail}</p>
                        </div>
                        <span className="text-2xl text-white">›</span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-zinc-300">No specialist alerts for this setup.</p>
                  )}
                </div>
              </GoldCard>
            </div>

            <GoldCard className="mt-4 overflow-hidden p-0">
              <div className="p-5 pb-3">
                <CardTitle icon="📊">Full Field Breakdown</CardTitle>
              </div>
              <div className="overflow-x-auto px-4 pb-5">
                <table className="w-full min-w-[980px] border-collapse overflow-hidden rounded-2xl text-sm">
                  <thead>
                    <tr className="border-y border-yellow-400/20 bg-yellow-400/10 text-left text-xs uppercase tracking-wide text-zinc-100">
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Horse</th>
                      <th className="px-3 py-3 text-center">Barrier</th>
                      <th className="px-3 py-3 text-center">Power</th>
                      <th className="px-3 py-3 text-center">Score</th>
                      <th className="px-3 py-3 text-center">Win %</th>
                      <th className="px-3 py-3 text-center">Place %</th>
                      <th className="px-3 py-3">Form</th>
                      <th className="px-3 py-3">Track</th>
                      <th className="px-3 py-3">Dist</th>
                      <th className="px-3 py-3">Cond</th>
                      <th className="px-3 py-3">Jockey</th>
                      <th className="px-3 py-3">Trainer</th>
                      <th className="px-3 py-3 text-right">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoredRunners.map((runner) => (
                      <tr key={runner.id} className="border-b border-yellow-400/10 text-zinc-100 odd:bg-white/[0.025] hover:bg-yellow-400/5">
                        <td className="px-3 py-3 font-bold">{runner.rank}</td>
                        <td className="px-3 py-3 font-black text-white">{runner.horse_name}</td>
                        <td className="px-3 py-3 text-center">{runner.barrier || "—"}</td>
                        <td className="px-3 py-3 text-center">{roundScore(runner.components.powerRating || 0)}</td>
                        <td className="px-3 py-3 text-center font-black text-yellow-200">{roundScore(runner.score)}</td>
                        <td className="px-3 py-3 text-center">{roundScore(runner.winPercent)}%</td>
                        <td className="px-3 py-3 text-center">{roundScore(runner.placePercent)}%</td>
                        <td className="px-3 py-3">{runner.form_last_6 || runner.form_last_3 || "—"}</td>
                        <td className="px-3 py-3 text-yellow-300">{scoreStars(runner.components.track)}</td>
                        <td className="px-3 py-3 text-yellow-300">{scoreStars(runner.components.distance)}</td>
                        <td className="px-3 py-3 text-yellow-300">{scoreStars(runner.components.condition)}</td>
                        <td className="px-3 py-3">{runner.jockey_name || "—"}</td>
                        <td className="px-3 py-3">{runner.trainer_name || "—"}</td>
                        <td className="px-3 py-3 text-right">{runner.effectiveWeight ?? runner.weight_kg ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GoldCard>

            <p className="mt-4 text-sm leading-6 text-zinc-500">
              ⓘ Race Confidence measures the quality of the betting race, not just the quality of the top-rated horse.
            </p>
          </main>
        ) : (
          <div className="mt-4 rounded-[24px] border border-yellow-400/35 bg-black/90 p-8 text-center">
            <h2 className="text-2xl font-black text-white">No live calculator races available</h2>
            <p className="mt-3 text-sm text-zinc-400">Once today’s races are published, SmartPunt Calculator Live Picks will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
