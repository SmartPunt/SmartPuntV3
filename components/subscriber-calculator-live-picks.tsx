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
import { Badge, Panel } from "@/components/ui";

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-4xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[760px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.08)_35%,rgba(0,0,0,0.62)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[260px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Live Picks</Badge>

              <Link
                href="/"
                className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Dashboard
              </Link>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                SmartPunt Calculator Live Picks
              </h1>
              <p className="mt-2 text-sm text-zinc-200 lg:text-base">
                Every race analysed. Every recommendation explained.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{publishedRaces.length} live races</Badge>
                <Badge tone="amber">Live calculator</Badge>
                <Badge tone="blue">Head Tipper status</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Panel className="border border-amber-300/25 bg-zinc-950/95">
            <div className="space-y-5 p-5 text-white sm:p-6">
              {activeRace ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-300">
                      Choose race
                    </label>
                    <select
                      value={String(activeRace.id)}
                      onChange={(event) => setSelectedRaceId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-amber-300"
                    >
                      {orderedPublishedRaces.map((race) => {
                        const meeting = meetings.find((item) => item.id === race.meeting_id);

                        return (
                          <option key={race.id} value={String(race.id)}>
                            {(meeting?.meeting_name || "Meeting")} · R{race.race_number} {race.race_name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!previousRace}
                      onClick={() => previousRace && setSelectedRaceId(String(previousRace.id))}
                      className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ◀ Previous Race
                    </button>
                    <button
                      type="button"
                      disabled={!nextRace}
                      onClick={() => nextRace && setSelectedRaceId(String(nextRace.id))}
                      className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next Race ▶
                    </button>
                  </div>

                  <div className="rounded-[26px] border border-amber-300/25 bg-black/70 p-5 shadow-xl">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                          {(activeMeeting?.meeting_name || "Meeting")} · R{activeRace.race_number}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-white">
                          {activeRace.race_name}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-300">
                          {activeRace.distance_m || "—"}m •{" "}
                          {activeMeeting?.track_condition || "Track not set"} •{" "}
                          {placeTermsLabel(activeRace.place_terms)}
                        </p>
                      </div>

                      <Badge
                        tone={
                          qualifiedTip
                            ? qualifiedTip.type === "Win"
                              ? "green"
                              : "blue"
                            : "amber"
                        }
                      >
                        {bettingVerdictLabel}
                      </Badge>
                    </div>

                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-bold text-amber-200">
                        🏆 SmartPunt Calculator Top 3
                      </p>

                      <div className="mt-4 space-y-3">
                        {calculatorTopThree.map((runner, index) => (
                          <div
                            key={runner.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3"
                          >
                            <div>
                              <p className="font-bold text-white">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}{" "}
                                {runner.horse_name}
                              </p>
                              <p className="text-xs text-zinc-400">
                                Barrier {runner.barrier || "—"} • Score {roundScore(runner.score)}
                              </p>
                            </div>
                            <div className="text-right text-xs text-zinc-300">
                              <p>Win {roundScore(runner.winPercent)}%</p>
                              <p>Place {roundScore(runner.placePercent)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {raceConfidence ? (
                      <div className="mt-5 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-amber-200">
                            Race Confidence
                          </p>
                          <Badge
                            tone={
                              raceConfidence.tier === "Elite" ||
                              raceConfidence.tier === "High"
                                ? "green"
                                : raceConfidence.tier === "Medium"
                                  ? "amber"
                                  : "rose"
                            }
                          >
                            {raceConfidence.tier} · {raceConfidence.confidencePercent}%
                          </Badge>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-200">
                          {raceConfidence.summary}
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-black/35 p-3">
                            <p className="text-xs text-zinc-400">Ratings Gap</p>
                            <p className="text-lg font-bold text-white">
                              {raceConfidence.gap}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-black/35 p-3">
                            <p className="text-xs text-zinc-400">Race Shape</p>
                            <p className="text-lg font-bold text-white">
                              {raceConfidence.volatility}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-black/35 p-3">
                            <p className="text-xs text-zinc-400">Field</p>
                            <p className="text-lg font-bold text-white">
                              {fieldSizeLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {tipThresholds ? (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-bold text-amber-200">
                          🎯 SmartPunt Tip Requirements
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-black/35 p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                              Win Tip
                            </p>
                            <p className="mt-2 text-sm text-zinc-200">
                              Score{" "}
                              <strong>
                                {tipThresholds.minWinScore === null
                                  ? "Not available"
                                  : `${tipThresholds.minWinScore}+`}
                              </strong>{" "}
                              • Gap {tipThresholds.minWinGap}+ • Win{" "}
                              {tipThresholds.minWinPercent}%+
                            </p>
                            <p className="mt-2 text-xs text-zinc-400">
                              Current: {topWinChance?.horse_name || "—"} · Score{" "}
                              {topWinChance ? roundScore(topWinChance.score) : "—"} · Win{" "}
                              {topWinChance ? roundScore(topWinChance.winPercent) : "—"}%
                            </p>
                          </div>

                          <div className="rounded-2xl bg-black/35 p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                              Place Tip
                            </p>
                            <p className="mt-2 text-sm text-zinc-200">
                              {tipThresholds.placeBettingAllowed
                                ? `Score ${tipThresholds.minPlaceScore}+ • Gap ${tipThresholds.minPlaceGap}+ • Place ${tipThresholds.minPlacePercent}%+`
                                : "Place betting disabled for this race"}
                            </p>
                            <p className="mt-2 text-xs text-zinc-400">
                              Current: {activeTopPlaceChance?.horse_name || "—"} · Score{" "}
                              {activeTopPlaceChance
                                ? roundScore(activeTopPlaceChance.score)
                                : "—"}{" "}
                              · Place{" "}
                              {activeTopPlaceChance
                                ? roundScore(activeTopPlaceChance.placePercent)
                                : "—"}% · Gap {activeTopPlaceGap}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-bold text-amber-200">
                        🎯 Betting Verdict
                      </p>
                      <p className="mt-2 text-xl font-extrabold text-white">
                        {bettingVerdictLabel}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {bettingVerdictSummary}
                      </p>
                    </div>

                    <div className="mt-5 rounded-3xl border border-amber-300/25 bg-black/45 p-4">
                      <p className="text-sm font-bold text-amber-200">
                        ⭐ Head Tipper Status
                      </p>

                      {officialRaceTip ? (
                        <div className="mt-3">
                          <p className="text-lg font-extrabold text-green-300">
                            🟢 Official SmartPunt Tip Published
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            The Head Tipper has endorsed this race. View the full write-up in Current Tips.
                          </p>
                          <Link
                            href="/current-tips"
                            className="mt-3 inline-flex rounded-2xl border border-green-400/30 bg-green-500/15 px-4 py-2 text-sm font-bold text-green-200 transition hover:bg-green-500/25"
                          >
                            View Current Tips
                          </Link>
                        </div>
                      ) : qualifiedTip || calculatorRaceTip ? (
                        <div className="mt-3">
                          <p className="text-lg font-extrabold text-amber-300">
                            🟡 Calculator Recommendation Only
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            The SmartPunt Calculator currently recommends this race, but no official Head Tipper selection has been published.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <p className="text-lg font-extrabold text-zinc-200">
                            ⚪ Awaiting Review
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            The Head Tipper has not published an official selection for this race.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-bold text-amber-200">
                          ⚠️ Watchouts
                        </p>

                        <div className="mt-3 space-y-2">
                          {watchouts.map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl bg-black/35 px-3 py-2 text-sm text-zinc-300"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-bold text-amber-200">
                          🔔 Alert Candidates
                        </p>

                        <div className="mt-3 space-y-2">
                          {activeSpecialistAlerts.length ? (
                            activeSpecialistAlerts.slice(0, 4).map((alert) => (
                              <div
                                key={`${alert.horseName}-${alert.label}`}
                                className="rounded-2xl bg-black/35 px-3 py-2"
                              >
                                <p className="text-sm font-bold text-white">
                                  {alert.horseName}
                                </p>
                                <p className="text-xs text-amber-200">
                                  {alert.label}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {alert.detail}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="rounded-2xl bg-black/35 px-3 py-2 text-sm text-zinc-400">
                              No specialist alerts for this setup.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-5 text-xs leading-5 text-zinc-500">
                      ⓘ Race Confidence measures the quality of the betting race, not just the quality of the top-rated horse.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-[26px] border border-white/10 bg-black/70 p-6 text-center">
                  <h2 className="text-xl font-bold text-white">
                    No live calculator races available
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Once today’s races are published, SmartPunt Calculator Live Picks will appear here.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
