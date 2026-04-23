"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by: string | null;
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
  form_last_3: string | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  created_at: string;
  updated_at: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRun = Runner & {
  race: Race | null;
  meeting: Meeting | null;
};

type FactorStatus = {
  text: "Positive" | "Neutral" | "Negative";
  tone: "green" | "blue" | "rose";
};

type ScoredRunner = Runner & {
  horse_name: string;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  race_name: string;
  race_number: number;
  distance_m: number | null;
  score: number;
  winPercent: number;
  placePercent: number;
  verdict: string;
  rank: number;
  components: {
    recentForm: number;
    distance: number;
    track: number;
    condition: number;
    barrier: number;
    market: number;
  };
};

type RaceVerdict = {
  type: "Win" | "Place" | "No Bet";
  confidence: "Strong" | "Safe" | "Low Edge";
  reason: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number) {
  return Math.round(value);
}

function getConditionBucket(condition?: string | null) {
  const value = String(condition || "").toLowerCase();

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  return "Other";
}

function getDistanceBucket(distance?: number | null) {
  if (!distance) return "Unknown";
  if (distance <= 1200) return "1000–1200m";
  if (distance <= 1400) return "1201–1400m";
  if (distance <= 1600) return "1401–1600m";
  if (distance <= 1800) return "1601–1800m";
  if (distance <= 2200) return "1801–2200m";
  return "2200m+";
}

function parseMeetingDate(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortHistoryRuns(a: HistoryRun, b: HistoryRun) {
  const aDate = parseMeetingDate(a.meeting?.meeting_date);
  const bDate = parseMeetingDate(b.meeting?.meeting_date);

  if (bDate !== aDate) return bDate - aDate;

  const aRace = a.race?.race_number || 0;
  const bRace = b.race?.race_number || 0;

  return bRace - aRace;
}

function normalisePercentages(scores: number[]) {
  const total = scores.reduce((sum, score) => sum + score, 0);

  if (total <= 0) {
    return scores.map(() => ({ winPercent: 0, placePercent: 0 }));
  }

  return scores.map((score) => {
    const winPercent = Math.round((score / total) * 100);
    const placePercent = Math.min(95, Math.round(winPercent * 1.65 + 18));

    return {
      winPercent: clamp(winPercent),
      placePercent: clamp(placePercent),
    };
  });
}

function getVerdict(score: number) {
  if (score >= 80) return "Elite Play";
  if (score >= 70) return "Strong Bet";
  if (score >= 60) return "Speculative";
  return "Pass";
}

function getRaceVerdict(runners: ScoredRunner[]): RaceVerdict | null {
  if (!runners.length) return null;

  const top = runners[0];
  const second = runners[1];
  const scoreGap = second ? top.score - second.score : 0;

  if (top.winPercent >= 30 && scoreGap >= 5) {
    return {
      type: "Win",
      confidence: "Strong",
      reason: "Clear top-rated runner with strong win profile and separation from the field.",
    };
  }

  if (top.placePercent >= 55) {
    return {
      type: "Place",
      confidence: "Safe",
      reason: "Rates consistently above the field and profiles better to place than win.",
    };
  }

  return {
    type: "No Bet",
    confidence: "Low Edge",
    reason: "Race is too competitive with no strong edge identified.",
  };
}

function scoreRecentForm(historyRuns: HistoryRun[]) {
  const recent = historyRuns.slice(0, 5);
  if (!recent.length) return 50;

  let points = 0;

  recent.forEach((run, index) => {
    const pos = run.finishing_position;
    if (pos === null || pos === undefined) return;

    const recencyWeight = index === 0 ? 1.2 : index === 1 ? 1.05 : 1;

    if (pos === 1) points += 18 * recencyWeight;
    else if (pos === 2) points += 14 * recencyWeight;
    else if (pos === 3) points += 10 * recencyWeight;
    else if (pos <= 5) points += 6 * recencyWeight;
    else if (pos <= 8) points += 2 * recencyWeight;
    else points -= 4 * recencyWeight;
  });

  const avg = points / recent.length;
  return clamp(Math.round(50 + avg), 20, 95);
}

function scoreDistanceSuitability(
  historyRuns: HistoryRun[],
  currentDistance: number | null | undefined,
) {
  if (!currentDistance) return 50;

  const targetBucket = getDistanceBucket(currentDistance);
  const matchingRuns = historyRuns.filter(
    (run) => getDistanceBucket(run.race?.distance_m) === targetBucket,
  );

  if (!matchingRuns.length) return 50;

  const places = matchingRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = matchingRuns.filter((run) => run.finishing_position === 1).length;
  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  return clamp(Math.round(40 + placeRate * 35 + winRate * 20), 25, 95);
}

function scoreTrackSuitability(
  historyRuns: HistoryRun[],
  currentTrack: string | null | undefined,
) {
  if (!currentTrack) return 50;

  const matchingRuns = historyRuns.filter(
    (run) => run.meeting?.meeting_name === currentTrack,
  );

  if (!matchingRuns.length) return 50;

  const places = matchingRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = matchingRuns.filter((run) => run.finishing_position === 1).length;
  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  return clamp(Math.round(40 + placeRate * 35 + winRate * 18), 25, 95);
}

function scoreConditionSuitability(
  historyRuns: HistoryRun[],
  currentCondition: string | null | undefined,
) {
  if (!currentCondition) return 50;

  const target = getConditionBucket(currentCondition);
  const matchingRuns = historyRuns.filter(
    (run) => getConditionBucket(run.meeting?.track_condition) === target,
  );

  if (!matchingRuns.length) return 50;

  const places = matchingRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = matchingRuns.filter((run) => run.finishing_position === 1).length;
  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  return clamp(Math.round(40 + placeRate * 34 + winRate * 18), 25, 95);
}

function scoreBarrier(barrier: number | null | undefined) {
  if (barrier === null || barrier === undefined) return 50;

  if (barrier <= 3) return 72;
  if (barrier <= 6) return 65;
  if (barrier <= 9) return 58;
  if (barrier <= 12) return 50;
  return 42;
}

function scoreMarket(marketPrice: number | null | undefined) {
  if (marketPrice === null || marketPrice === undefined) return 50;

  if (marketPrice < 2.5) return 82;
  if (marketPrice < 4) return 72;
  if (marketPrice < 6) return 64;
  if (marketPrice < 10) return 56;
  if (marketPrice < 15) return 48;
  return 40;
}

function buildHorseHistory(
  horseId: number,
  runners: Runner[],
  racesById: Map<number, Race>,
  meetingsById: Map<number, Meeting>,
  excludeRaceId?: number,
) {
  return runners
    .filter((runner) => runner.horse_id === horseId)
    .filter(
      (runner) =>
        runner.finishing_position !== null && runner.finishing_position !== undefined,
    )
    .filter((runner) => (excludeRaceId ? runner.race_id !== excludeRaceId : true))
    .map((runner) => {
      const race = racesById.get(runner.race_id) || null;
      const meeting = race ? meetingsById.get(race.meeting_id) || null : null;

      return {
        ...runner,
        race,
        meeting,
      };
    })
    .sort(sortHistoryRuns);
}

function formatFormLine(historyRuns: HistoryRun[]) {
  if (!historyRuns.length) return "—";

  return historyRuns
    .slice(0, 5)
    .map((run) => {
      if (run.finishing_position === null || run.finishing_position === undefined) return "—";
      return String(run.finishing_position);
    })
    .join(" • ");
}

function getFactorStatus(score: number): FactorStatus {
  if (score >= 65) return { text: "Positive", tone: "green" };
  if (score >= 50) return { text: "Neutral", tone: "blue" };
  return { text: "Negative", tone: "rose" };
}

function getSelectedHorseSummary(runner: ScoredRunner) {
  const positives: string[] = [];
  const negatives: string[] = [];

  if (runner.components.recentForm >= 65) positives.push("recent form");
  if (runner.components.distance >= 65) positives.push("distance profile");
  if (runner.components.track >= 65) positives.push("track profile");
  if (runner.components.condition >= 65) positives.push("conditions");
  if (runner.components.barrier >= 65) positives.push("barrier");
  if (runner.components.market >= 65) positives.push("market support");

  if (runner.components.recentForm < 50) negatives.push("recent form");
  if (runner.components.distance < 50) negatives.push("distance");
  if (runner.components.track < 50) negatives.push("track");
  if (runner.components.condition < 50) negatives.push("conditions");
  if (runner.components.barrier < 50) negatives.push("barrier");
  if (runner.components.market < 50) negatives.push("market confidence");

  if (!positives.length && !negatives.length) {
    return "Balanced profile across the key race factors.";
  }

  if (positives.length && !negatives.length) {
    return `Supported by ${positives.join(", ")}.`;
  }

  if (!positives.length && negatives.length) {
    return `Needs improvement around ${negatives.join(", ")}.`;
  }

  return `Supported by ${positives.join(", ")}, but has some risk around ${negatives.join(", ")}.`;
}

export default function AdminCalculator({
  races,
  runners,
  horses,
  meetings,
}: {
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
}) {
  const [search, setSearch] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("80");

  const racesById = useMemo(() => new Map(races.map((race) => [race.id, race])), [races]);
  const meetingsById = useMemo(
    () => new Map(meetings.map((meeting) => [meeting.id, meeting])),
    [meetings],
  );

  const publishedRaces = useMemo(
    () => races.filter((race) => race.status === "published"),
    [races],
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

    const publishedRaceIds = new Set(publishedRaces.map((race) => race.id));
    const runner = runners.find(
      (item) => item.horse_id === selectedHorse.id && publishedRaceIds.has(item.race_id),
    );

    if (!runner) return null;

    return publishedRaces.find((race) => race.id === runner.race_id) || null;
  }, [publishedRaces, runners, selectedHorse]);

  const activeRace = useMemo(() => {
    if (selectedRaceId) {
      return publishedRaces.find((race) => String(race.id) === selectedRaceId) || null;
    }

    return horseRace;
  }, [horseRace, publishedRaces, selectedRaceId]);

  const scoredRunners = useMemo<ScoredRunner[]>(() => {
    if (!activeRace) return [];

    const raceMeeting = meetingsById.get(activeRace.meeting_id) || null;
    const field = runners.filter((runner) => runner.race_id === activeRace.id);

    const baseScored = field.map((runner) => {
      const horse = horses.find((item) => item.id === runner.horse_id);
      const historyRuns = buildHorseHistory(
        runner.horse_id,
        runners,
        racesById,
        meetingsById,
        activeRace.id,
      );

      const recentForm = scoreRecentForm(historyRuns);
      const distance = scoreDistanceSuitability(historyRuns, activeRace.distance_m);
      const track = scoreTrackSuitability(historyRuns, raceMeeting?.meeting_name);
      const condition = scoreConditionSuitability(historyRuns, raceMeeting?.track_condition);
      const barrier = scoreBarrier(runner.barrier);
      const market = scoreMarket(runner.market_price);

      const score = clamp(
        Math.round(
          recentForm * 0.28 +
            distance * 0.18 +
            track * 0.14 +
            condition * 0.14 +
            barrier * 0.10 +
            market * 0.16,
        ),
      );

      return {
        ...runner,
        horse_name: horse?.horse_name || "Unknown horse",
        meeting_name: raceMeeting?.meeting_name || "Unknown meeting",
        meeting_date: raceMeeting?.meeting_date || "",
        track_condition: raceMeeting?.track_condition || null,
        race_name: activeRace.race_name,
        race_number: activeRace.race_number,
        distance_m: activeRace.distance_m,
        score,
        winPercent: 0,
        placePercent: 0,
        verdict: getVerdict(score),
        rank: 0,
        components: {
          recentForm,
          distance,
          track,
          condition,
          barrier,
          market,
        },
      };
    });

    const percentages = normalisePercentages(baseScored.map((runner) => runner.score));

    return baseScored
      .map((runner, index) => ({
        ...runner,
        winPercent: percentages[index].winPercent,
        placePercent: percentages[index].placePercent,
      }))
      .sort((a, b) => b.score - a.score)
      .map((runner, index) => ({
        ...runner,
        rank: index + 1,
      }));
  }, [activeRace, horses, meetingsById, racesById, runners]);

  const selectedHorseScore = useMemo(() => {
    if (!selectedHorse) return null;
    return scoredRunners.find((runner) => runner.horse_id === selectedHorse.id) || null;
  }, [scoredRunners, selectedHorse]);

  const topWinChance = scoredRunners[0] || null;
  const topPlaceChances = [...scoredRunners]
    .sort((a, b) => b.placePercent - a.placePercent)
    .slice(0, 3);

  const raceVerdict = useMemo(() => getRaceVerdict(scoredRunners), [scoredRunners]);

  const alertCandidates = useMemo(() => {
    const threshold = Number(alertThreshold);
    if (Number.isNaN(threshold)) return [];

    return scoredRunners.filter((runner) => runner.score >= threshold);
  }, [alertThreshold, scoredRunners]);

  const selectedHorseHistory = useMemo(() => {
    if (!selectedHorse) return [];
    return buildHorseHistory(selectedHorse.id, runners, racesById, meetingsById);
  }, [meetingsById, racesById, runners, selectedHorse]);

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
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
<div className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
      Fortune on 5 current races
    </h1>
<p className="text-sm text-zinc-200 lg:text-base">
  Admin-only modelling tool for published races, horse-triggered scoring, and race-wide ranking.
</p>
  </div>

  <div className="flex items-center gap-2">
    <Link
      href="/"
      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
    >
      Back to Dashboard
    </Link>

    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
      >
        Log Out
      </button>
    </form>
  </div>
</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{publishedRaces.length} published races</Badge>
                <Badge tone="blue">{horses.length} saved horses</Badge>
                <Badge tone="amber">History-backed scoring</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div>
                <h2 className="text-xl font-semibold">Horse-triggered lookup</h2>
                <p className="text-sm text-zinc-500">
                  Enter or select a horse. The calculator checks if it is part of a published race,
                  then scores the whole field around it.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Search horse</label>
                <div className="mt-2">
                  <input
                    placeholder="Search horse name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                        onClick={() => setSearch(horse.horse_name)}
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
                <label className="text-sm font-medium text-zinc-700">Or choose a published race</label>
                <div className="mt-2">
                  <select
                    value={selectedRaceId}
                    onChange={(e) => setSelectedRaceId(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  >
                    <option value="">Auto-detect from horse</option>
                    {publishedRaces.map((race) => {
                      const meeting = meetings.find((item) => item.id === race.meeting_id);
                      return (
                        <option key={race.id} value={String(race.id)}>
                          {(meeting?.meeting_name || "Meeting")} · R{race.race_number} {race.race_name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Alert threshold</label>
                <div className="mt-2">
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Later this can trigger alerts to the head tipper for strong-rated runners.
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

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Race summary</h2>
                  <p className="text-sm text-zinc-500">
                    The selected race is always scored as a full field.
                  </p>
                </div>
                <Badge tone="amber">{scoredRunners.length} runners</Badge>
              </div>

              {activeRace ? (
                <>
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-500">
                          {topWinChance?.meeting_name || "Meeting"}{" "}
                          {topWinChance?.meeting_date ? `· ${topWinChance.meeting_date}` : ""}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                          R{activeRace.race_number} {activeRace.race_name}
                        </h3>
                        <p className="mt-2 text-sm text-zinc-600">
                          {activeRace.distance_m || "—"}m
                          {topWinChance?.track_condition ? ` · ${topWinChance.track_condition}` : ""}
                        </p>
                      </div>
                      <Badge tone="green">Published</Badge>
                    </div>
                  </div>

                  {raceVerdict ? (
                    <div className="rounded-[24px] border border-amber-300/40 bg-amber-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                        SmartPunt race verdict
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-zinc-950">
                        Best Bet: {raceVerdict.type}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="green">{raceVerdict.confidence}</Badge>
                        {topWinChance ? (
                          <Badge tone="blue">Top Rated: {topWinChance.horse_name}</Badge>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm text-zinc-700">{raceVerdict.reason}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Most likely winner
                      </p>
                      <p className="mt-2 text-lg font-bold text-zinc-950">
                        {topWinChance?.horse_name || "—"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Win chance: {topWinChance?.winPercent ?? 0}% · Score:{" "}
                        {topWinChance ? roundScore(topWinChance.score) : 0}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                        Strongest place profiles
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        {topPlaceChances.map((runner) => (
                          <p key={runner.id}>
                            {runner.horse_name} — {runner.placePercent}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedHorseScore ? (
                    <div className="rounded-[24px] border border-amber-300/40 bg-amber-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                        Selected horse result
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-zinc-950">
                        {selectedHorseScore.horse_name}
                      </h3>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="green">Win {selectedHorseScore.winPercent}%</Badge>
                        <Badge tone="blue">Place {selectedHorseScore.placePercent}%</Badge>
                        <Badge tone="amber">{selectedHorseScore.verdict}</Badge>
                        <Badge tone="slate">Rank #{selectedHorseScore.rank}</Badge>
                        <Badge tone="amber">Score {roundScore(selectedHorseScore.score)}</Badge>
                      </div>

                      <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Why this rating
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Recent form</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.recentForm).tone}>
                              {getFactorStatus(selectedHorseScore.components.recentForm).text}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Distance</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.distance).tone}>
                              {getFactorStatus(selectedHorseScore.components.distance).text}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Track</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.track).tone}>
                              {getFactorStatus(selectedHorseScore.components.track).text}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Conditions</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.condition).tone}>
                              {getFactorStatus(selectedHorseScore.components.condition).text}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Barrier</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.barrier).tone}>
                              {getFactorStatus(selectedHorseScore.components.barrier).text}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-zinc-800">Market</span>
                            <Badge tone={getFactorStatus(selectedHorseScore.components.market).tone}>
                              {getFactorStatus(selectedHorseScore.components.market).text}
                            </Badge>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-zinc-700">
                          {getSelectedHorseSummary(selectedHorseScore)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[24px] border border-rose-200/40 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">
                      Alert candidates
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                      {alertCandidates.length > 0 ? (
                        alertCandidates.map((runner) => (
                          <p key={runner.id}>
                            {runner.horse_name} — Score {roundScore(runner.score)}
                          </p>
                        ))
                      ) : (
                        <p>No runners currently exceed the threshold.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  No published race found yet for that horse. Use a horse that is loaded into a published race, or pick a published race manually.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Field scoring</h2>
                <p className="text-sm text-zinc-500">
                  This version scores on recent form, distance, track, conditions, barrier, and market.
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
                          <p className="text-sm text-zinc-500">Rank #{runner.rank}</p>
                          <h3 className="mt-1 text-xl font-bold text-zinc-950">
                            {runner.horse_name}
                          </h3>
                          <p className="mt-2 text-sm text-zinc-600">
                            Jockey: {runner.jockey_name || "—"} · Barrier: {runner.barrier ?? "—"} · Market: {runner.market_price ?? "—"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="green">Win {runner.winPercent}%</Badge>
                          <Badge tone="blue">Place {runner.placePercent}%</Badge>
                          <Badge tone="amber">{runner.verdict}</Badge>
                          <Badge tone="slate">Score {roundScore(runner.score)}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Form
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.recentForm)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Distance
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.distance)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Track
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.track)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Conditions
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.condition)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Barrier
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.barrier)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Market
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {roundScore(runner.components.market)}
                          </p>
                        </div>
                      </div>

                      {runner.form_last_3 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Recent form snapshot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_3}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  Once a published race is selected or auto-detected from a searched horse, the field rankings will appear here.
                </div>
              )}
            </div>
          </div>
        </Panel>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What this version adds</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Resulted form scoring</p>
                <p>• Distance suitability</p>
                <p>• Track suitability</p>
                <p>• Good / Soft / Heavy suitability</p>
                <p>• Race verdict logic</p>
                <p>• Selected-horse reasoning</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Still to come</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Better place modelling</p>
                <p>• Jockey and trainer history</p>
                <p>• More race-shape logic</p>
                <p>• Subscriber calculator flow</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Release path</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Keep testing in admin lab</p>
                <p>• Tighten thresholds and verdicts</p>
                <p>• Then move into subscriber published races</p>
                <p>• Later feed My Active Tips</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
