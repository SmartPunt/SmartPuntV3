export const SMARTPUNT_SCORING_VERSION = "v4";

export type Race = {
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

export type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg?: number | null;
  is_apprentice?: boolean | null;
  apprentice_claim_kg?: number | null;
  form_last_3?: string | null;
  form_last_6?: string | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  scratched?: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  created_at: string;
  updated_at: string;
};

export type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryRun = Runner & {
  race: Race | null;
  meeting: Meeting | null;
};

export type FactorStatus = {
  text: "Positive" | "Neutral" | "Negative";
  tone: "green" | "blue" | "rose";
};

export type ScoredRunner = Runner & {
  horse_name: string;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  race_name: string;
  race_number: number;
  distance_m: number | null;
  effectiveWeight: number | null;
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
    weight: number;
    jockey: number;
    trainer: number;
    consistency: number;
  };
};

export type RaceVerdict = {
  type: "Win" | "Place" | "No Bet";
  confidence: "Strong" | "Safe" | "Low Edge";
  reason: string;
};

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function roundScore(value: number) {
  return Math.round(value);
}

export function getConditionBucket(condition?: string | null) {
  const value = String(condition || "").toLowerCase();

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  return "Other";
}

export function getDistanceBucket(distance?: number | null) {
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

export function getVerdict(score: number) {
  if (score >= 80) return "Elite Play";
  if (score >= 70) return "Strong Bet";
  if (score >= 60) return "Speculative";
  return "Pass";
}

export function getRaceVerdict(runners: ScoredRunner[]): RaceVerdict | null {
  if (!runners.length) return null;

  const top = runners[0];
  const second = runners[1];
  const fourth = runners[3];

  const scoreGap = second ? top.score - second.score : 0;
  const topFourCompression = fourth ? top.score - fourth.score : scoreGap;

  if (fourth && topFourCompression <= 4) {
    return {
      type: "No Bet",
      confidence: "Low Edge",
      reason:
        "Race is tightly compressed across the top four runners. No clear calculator edge.",
    };
  }

  if (top.winPercent >= 30 && scoreGap >= 7) {
    return {
      type: "Win",
      confidence: "Strong",
      reason:
        "Clear top-rated runner with strong profile and meaningful separation from the field.",
    };
  }

  if (top.placePercent >= 58 && scoreGap >= 4) {
    return {
      type: "Place",
      confidence: "Safe",
      reason:
        "Rates consistently above the field and profiles better to place than win.",
    };
  }

  return {
    type: "No Bet",
    confidence: "Low Edge",
    reason: "Race is too competitive with no strong edge identified.",
  };
}

function evidenceCap(score: number, evidenceCount: number) {
  if (evidenceCount <= 0) return 50;
  if (evidenceCount === 1) return clamp(score, 25, 60);
  if (evidenceCount === 2) return clamp(score, 25, 72);
  return clamp(score, 25, 95);
}

function scoreRecentForm(historyRuns: HistoryRun[]) {
  const recent = historyRuns.slice(0, 5);
  if (!recent.length) return 50;

  let points = 0;
  let wins = 0;
  const lastThree: number[] = [];

  recent.forEach((run, index) => {
    const pos = run.finishing_position;
    if (pos === null || pos === undefined) return;

    lastThree.push(Number(pos));

    const recencyWeight = index === 0 ? 1.2 : index === 1 ? 1.05 : 1;

    if (pos === 1) {
      points += 18 * recencyWeight;
      wins += 1;
    } else if (pos === 2) points += 14 * recencyWeight;
    else if (pos === 3) points += 10 * recencyWeight;
    else if (pos <= 5) points += 6 * recencyWeight;
    else if (pos <= 8) points += 2 * recencyWeight;
    else points -= 4 * recencyWeight;
  });

  const avg = points / recent.length;
  let score = clamp(Math.round(50 + avg), 20, 95);

  if (wins >= 2) score += 6;
  else if (wins === 1) score += 3;

  if (recent[0]?.finishing_position === 1) score += 4;

  if (wins === 0 && recent.length >= 4) score -= 6;

  if (lastThree.length >= 3) {
    const [a, b, c] = lastThree;

    if (a < b && b < c) score += 4;
    if (a > b && b > c) score -= 4;
  }

  return clamp(score, 20, 95);
}

function scoreConsistency(historyRuns: HistoryRun[]) {
  const recent = historyRuns
    .slice(0, 5)
    .filter(
      (run) =>
        run.finishing_position !== null &&
        run.finishing_position !== undefined &&
        Number.isFinite(Number(run.finishing_position)),
    );

  if (!recent.length) return 50;

  const averageFinish =
    recent.reduce((sum, run) => sum + Number(run.finishing_position || 0), 0) / recent.length;

  const topThreeCount = recent.filter((run) => Number(run.finishing_position) <= 3).length;
  const poorRunCount = recent.filter((run) => Number(run.finishing_position) >= 8).length;

  const averageScore = clamp(Math.round(82 - averageFinish * 5), 25, 82);
  const topThreeBonus = topThreeCount * 4;
  const poorRunPenalty = poorRunCount * 5;

  return clamp(averageScore + topThreeBonus - poorRunPenalty, 25, 90);
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

if (!matchingRuns.length) return 42;

  const places = matchingRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = matchingRuns.filter((run) => run.finishing_position === 1).length;
  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  const rawScore = Math.round(40 + placeRate * 35 + winRate * 20);
  return evidenceCap(rawScore, matchingRuns.length);
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

  const rawScore = Math.round(40 + placeRate * 35 + winRate * 18);
  return evidenceCap(rawScore, matchingRuns.length);
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

  const rawScore = Math.round(40 + placeRate * 34 + winRate * 18);
  return evidenceCap(rawScore, matchingRuns.length);
}

function scoreBarrier(
  barrier: number | null | undefined,
  distance: number | null | undefined,
  track: string | null | undefined,
) {
  if (barrier === null || barrier === undefined) return 50;

  const trackName = String(track || "").toLowerCase();
  const isFlemington = trackName.includes("flemington");

  if (isFlemington) {
    if (barrier <= 4) return 68;
    if (barrier <= 8) return 63;
    if (barrier <= 12) return 58;
    return 54;
  }

if (distance && distance <= 1200) {
  if (barrier <= 4) return 82;
  if (barrier <= 8) return 60;
  if (barrier <= 12) return 44;
  return 34;
}

if (distance && distance <= 1400) {
  if (barrier <= 4) return 74;
  if (barrier <= 8) return 66;
  if (barrier <= 12) return 56;
  return 48;
}

// 1400m+ barrier becomes much less important
if (barrier <= 4) return 68;
if (barrier <= 8) return 64;
if (barrier <= 12) return 60;
return 56;
}

export function getEffectiveWeight(runner: Runner) {
  if (runner.weight_kg === null || runner.weight_kg === undefined) return null;

  const claim =
    runner.apprentice_claim_kg !== null && runner.apprentice_claim_kg !== undefined
      ? runner.apprentice_claim_kg
      : 0;

  return Math.max(0, Number(runner.weight_kg) - Number(claim));
}

function scoreWeight(
  runner: Runner,
  fieldEffectiveWeights: Array<number | null>,
) {
  const effectiveWeight = getEffectiveWeight(runner);
  const validWeights = fieldEffectiveWeights.filter(
    (weight): weight is number => weight !== null && !Number.isNaN(weight),
  );

  if (effectiveWeight === null || !validWeights.length) return 50;

  const min = Math.min(...validWeights);
  const max = Math.max(...validWeights);

  if (min === max) return 55;

  const position = (max - effectiveWeight) / (max - min);
  return clamp(Math.round(40 + position * 35), 35, 80);
}

function scoreJockey(
  runner: Runner,
  horseHistoryRuns: HistoryRun[],
  allHistoryRuns: HistoryRun[],
) {
  const jockey = String(runner.jockey_name || "").trim().toLowerCase();
  if (!jockey) return 50;

  const horseJockeyRuns = horseHistoryRuns.filter(
    (run) => String(run.jockey_name || "").trim().toLowerCase() === jockey,
  );

  if (horseJockeyRuns.length > 0) {
    const places = horseJockeyRuns.filter((run) => {
      const pos = run.finishing_position;
      return pos !== null && pos !== undefined && pos <= 3;
    }).length;

    const wins = horseJockeyRuns.filter((run) => run.finishing_position === 1).length;

    const rawScore = Math.round(
      45 + (places / horseJockeyRuns.length) * 28 + (wins / horseJockeyRuns.length) * 18,
    );

    if (horseJockeyRuns.length === 1) return clamp(rawScore, 35, 68);
    if (horseJockeyRuns.length === 2) return clamp(rawScore, 35, 78);
    return clamp(rawScore, 35, 88);
  }

  const jockeyRuns = allHistoryRuns.filter(
    (run) => String(run.jockey_name || "").trim().toLowerCase() === jockey,
  );

  if (!jockeyRuns.length) return 50;

  const places = jockeyRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = jockeyRuns.filter((run) => run.finishing_position === 1).length;

  return clamp(
    Math.round(43 + (places / jockeyRuns.length) * 25 + (wins / jockeyRuns.length) * 15),
    35,
    85,
  );
}

function scoreTrainer(runner: Runner, allHistoryRuns: HistoryRun[]) {
  const trainer = String(runner.trainer_name || "").trim().toLowerCase();
  if (!trainer) return 50;

  const trainerRuns = allHistoryRuns.filter(
    (run) => String(run.trainer_name || "").trim().toLowerCase() === trainer,
  );

  if (!trainerRuns.length) return 50;

  const places = trainerRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = trainerRuns.filter((run) => run.finishing_position === 1).length;

  const rawScore = Math.round(
    43 + (places / trainerRuns.length) * 24 + (wins / trainerRuns.length) * 14,
  );

  if (trainerRuns.length === 1) return clamp(rawScore, 35, 65);
  if (trainerRuns.length === 2) return clamp(rawScore, 35, 74);
  return clamp(rawScore, 35, 82);
}

function applyOverconfidenceDampener({
  baseScore,
  recentForm,
  distance,
  track,
  condition,
}: {
  baseScore: number;
  recentForm: number;
  distance: number;
  track: number;
  condition: number;
}) {
  const profileAverage = (distance + track + condition) / 3;

  if (profileAverage >= 75 && recentForm < 58) {
    return clamp(Math.round(baseScore * 0.92));
  }

  if (profileAverage >= 68 && recentForm < 52) {
    return clamp(Math.round(baseScore * 0.95));
  }

  return baseScore;
}

function buildRaceMap(races: Race[]) {
  return new Map(races.map((race) => [Number(race.id), race]));
}

function buildMeetingMap(meetings: Meeting[]) {
  return new Map(meetings.map((meeting) => [Number(meeting.id), meeting]));
}

export function buildHorseHistory(
  horseId: number,
  runners: Runner[],
  races: Race[],
  meetings: Meeting[],
  excludeRaceId?: number,
) {
  const racesById = buildRaceMap(races);
  const meetingsById = buildMeetingMap(meetings);

  return runners
    .filter((runner) => Number(runner.horse_id) === Number(horseId))
    .filter(
      (runner) =>
        runner.finishing_position !== null &&
        runner.finishing_position !== undefined,
    )
    .filter((runner) => (excludeRaceId ? Number(runner.race_id) !== Number(excludeRaceId) : true))
    .map((runner) => {
      const race = racesById.get(Number(runner.race_id)) || null;
      const meeting = race ? meetingsById.get(Number(race.meeting_id)) || null : null;

      return {
        ...runner,
        race,
        meeting,
      };
    })
    .sort(sortHistoryRuns);
}

function buildAllHistoryRuns(
  runners: Runner[],
  races: Race[],
  meetings: Meeting[],
  excludeRaceId?: number,
) {
  const racesById = buildRaceMap(races);
  const meetingsById = buildMeetingMap(meetings);

  return runners
    .filter(
      (runner) =>
        runner.finishing_position !== null &&
        runner.finishing_position !== undefined,
    )
    .filter((runner) => (excludeRaceId ? Number(runner.race_id) !== Number(excludeRaceId) : true))
    .map((runner) => {
      const race = racesById.get(Number(runner.race_id)) || null;
      const meeting = race ? meetingsById.get(Number(race.meeting_id)) || null : null;

      return {
        ...runner,
        race,
        meeting,
      };
    })
    .sort(sortHistoryRuns);
}

export function formatFormLine(historyRuns: HistoryRun[]) {
  if (!historyRuns.length) return "—";

  return historyRuns
    .slice(0, 5)
    .map((run) => {
      if (run.finishing_position === null || run.finishing_position === undefined) return "—";
      return String(run.finishing_position);
    })
    .join(" • ");
}

export function getFactorStatus(score: number): FactorStatus {
  if (score >= 65) return { text: "Positive", tone: "green" };
  if (score >= 50) return { text: "Neutral", tone: "blue" };
  return { text: "Negative", tone: "rose" };
}

export function getSelectedHorseSummary(runner: ScoredRunner) {
  const positives: string[] = [];
  const negatives: string[] = [];

  if (runner.components.recentForm >= 65) positives.push("recent form");
  if (runner.components.distance >= 65) positives.push("distance profile");
  if (runner.components.track >= 65) positives.push("track profile");
  if (runner.components.condition >= 65) positives.push("conditions");
  if (runner.components.barrier >= 65) positives.push("barrier");
  if (runner.components.weight >= 65) positives.push("effective weight");
  if (runner.components.jockey >= 65) positives.push("jockey profile");
  if (runner.components.trainer >= 65) positives.push("trainer profile");
  if (runner.components.consistency >= 65) positives.push("consistency");

  if (runner.components.recentForm < 50) negatives.push("recent form");
  if (runner.components.distance < 50) negatives.push("distance");
  if (runner.components.track < 50) negatives.push("track");
  if (runner.components.condition < 50) negatives.push("conditions");
  if (runner.components.barrier < 50) negatives.push("barrier");
  if (runner.components.weight < 50) negatives.push("effective weight");
  if (runner.components.jockey < 50) negatives.push("jockey profile");
  if (runner.components.trainer < 50) negatives.push("trainer profile");
  if (runner.components.consistency < 50) negatives.push("consistency");

  if (!positives.length && !negatives.length) {
    return "Balanced profile across the key SmartPunt race factors.";
  }

  if (positives.length && !negatives.length) {
    return `Supported by ${positives.join(", ")}.`;
  }

  if (!positives.length && negatives.length) {
    return `Needs improvement around ${negatives.join(", ")}.`;
  }

  return `Supported by ${positives.join(", ")}, but has some risk around ${negatives.join(", ")}.`;
}

export function calculateRaceScores({
  activeRace,
  races,
  runners,
  horses,
  meetings,
}: {
  activeRace: Race | null | undefined;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
}): ScoredRunner[] {
  if (!activeRace) return [];

  const raceMeeting = meetings.find(
    (meeting) => Number(meeting.id) === Number(activeRace.meeting_id),
  ) || null;
  const field = runners.filter((runner) => Number(runner.race_id) === Number(activeRace.id));
  const fieldEffectiveWeights = field.map((runner) => getEffectiveWeight(runner));
  const allHistoryRuns = buildAllHistoryRuns(
    runners,
    races,
    meetings,
    activeRace.id,
  );

  const baseScored = field.map((runner) => {
    const horse = horses.find((item) => Number(item.id) === Number(runner.horse_id));
    const historyRuns = buildHorseHistory(
      runner.horse_id,
      runners,
      races,
      meetings,
      activeRace.id,
    );

    const recentForm = scoreRecentForm(historyRuns);
    const distance = scoreDistanceSuitability(historyRuns, activeRace.distance_m);
    const track = scoreTrackSuitability(historyRuns, raceMeeting?.meeting_name);
    const condition = scoreConditionSuitability(historyRuns, raceMeeting?.track_condition);
    const barrier = scoreBarrier(
      runner.barrier,
      activeRace.distance_m,
      raceMeeting?.meeting_name,
    );
    const weight = scoreWeight(runner, fieldEffectiveWeights);
    const jockey = scoreJockey(runner, historyRuns, allHistoryRuns);
    const trainer = scoreTrainer(runner, allHistoryRuns);
    const consistency = scoreConsistency(historyRuns);

    const baseScore = clamp(
      Math.round(
recentForm * 0.25 +
  distance * 0.14 +
  track * 0.09 +
  condition * 0.08 +
  barrier * 0.14 +
  weight * 0.03 +
  jockey * 0.11 +
  trainer * 0.04 +
  consistency * 0.10
      ),
    );

    const score = applyOverconfidenceDampener({
      baseScore,
      recentForm,
      distance,
      track,
      condition,
    });

    return {
      ...runner,
      horse_name: horse?.horse_name || "Unknown horse",
      meeting_name: raceMeeting?.meeting_name || "Unknown meeting",
      meeting_date: raceMeeting?.meeting_date || "",
      track_condition: raceMeeting?.track_condition || null,
      race_name: activeRace.race_name,
      race_number: activeRace.race_number,
      distance_m: activeRace.distance_m,
      effectiveWeight: getEffectiveWeight(runner),
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
        weight,
        jockey,
        trainer,
        consistency,
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
}
