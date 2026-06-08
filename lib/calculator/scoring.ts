export const SMARTPUNT_SCORING_VERSION = "v5";

export type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  place_terms?: "win_only" | "top_2" | "top_3" | null;
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
track_form_last_6?: string | null;
distance_form_last_6?: string | null;
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

  form_last_6?: string | null;
  track_form_last_6?: string | null;
  distance_form_last_6?: string | null;

  good_track_record?: string | null;
  soft_track_record?: string | null;
  heavy_track_record?: string | null;
  synthetic_track_record?: string | null;

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
export type JockeyProfile = {
  id: number;
  jockey_name: string;
  normalised_name: string;
  state: string | null;
  category: string | null;
  rides: number;
  wins: number;
  seconds: number;
  thirds: number;
  strike_rate: number;
  place_rate: number;
  rating: number;
  manual_rating: number | null;
  confidence_tag: string | null;
  notes: string | null;
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
export type CalculatorScoreOverrides = {
  condition?: number | null;
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

  if (top.score >= 72 && scoreGap >= 5) {
    return {
      type: "Win",
      confidence: "Strong",
      reason:
        "Clear top-rated runner with a strong score and enough separation from the main dangers.",
    };
  }

  if (top.score >= 66 && scoreGap >= 3) {
    return {
      type: "Place",
      confidence: "Safe",
      reason:
        "Top-rated runner has a solid profile and enough edge to be considered a safer place play.",
    };
  }

  if (top.score >= 62 && top.placePercent >= 45) {
    return {
      type: "Place",
      confidence: "Safe",
      reason:
        "No standout win edge, but the top-rated runner profiles as a reasonable place option.",
    };
  }

  if (fourth && topFourCompression <= 3 && top.score < 64) {
    return {
      type: "No Bet",
      confidence: "Low Edge",
      reason:
        "Race is tightly compressed across the main chances with no clear calculator edge.",
    };
  }

  return {
    type: "Place",
    confidence: "Low Edge",
    reason:
      "Calculator has found a preferred runner, but the race lacks enough separation for a strong win call.",
  };
}

function evidenceCap(score: number, evidenceCount: number) {
  if (evidenceCount <= 0) return 50;
  if (evidenceCount === 1) return clamp(score, 25, 60);
  if (evidenceCount === 2) return clamp(score, 25, 72);
  return clamp(score, 25, 95);
}

function parseImportedFormString(form?: string | null) {
  if (!form) return [];

  return String(form)
    .replace(/[^0-9xX]/g, "")
    .split("")
    .filter((char) => char.toLowerCase() !== "x")
    .reverse()
    .map((char) => {
      const num = Number(char);

      if (!Number.isFinite(num) || num <= 0) return 10;

      return num;
    })
    .slice(0, 6);
}

function scoreImportedRecentForm(form?: string | null) {
  const runs = parseImportedFormString(form);

  if (!runs.length) return 50;

  let points = 0;
  let wins = 0;

  runs.forEach((pos, index) => {
    const recencyWeight = index === 0 ? 1.2 : index === 1 ? 1.05 : 1;

    if (pos === 1) {
      points += 18 * recencyWeight;
      wins += 1;
    } else if (pos === 2) {
      points += 14 * recencyWeight;
    } else if (pos === 3) {
      points += 10 * recencyWeight;
    } else if (pos <= 5) {
      points += 6 * recencyWeight;
    } else if (pos <= 8) {
      points += 2 * recencyWeight;
    } else {
      points -= 7 * recencyWeight;
    }
  });

  let score = clamp(Math.round(50 + points / runs.length), 20, 95);

  if (wins >= 3) score += 10;
  else if (wins === 2) score += 6;
  else if (wins === 1) score += 3;

  if (runs[0] === 1) score += 6;

  return clamp(score, 20, 95);
}

function parseImportedStatRecord(record?: string | null) {
  if (!record) {
    return {
      runs: 0,
      wins: 0,
      places: 0,
    };
  }

  const match = String(record).match(/(\d+)\s*:\s*(\d+),(\d+),(\d+)/);

  if (!match) {
    return {
      runs: 0,
      wins: 0,
      places: 0,
    };
  }

const wins = Number(match[2]) || 0;
const seconds = Number(match[3]) || 0;
const thirds = Number(match[4]) || 0;

return {
  runs: Number(match[1]) || 0,
  wins,
  places: wins + seconds + thirds,
};
}

function scoreImportedStatRecord(record?: string | null) {
  const stats = parseImportedStatRecord(record);

  if (!stats.runs) return 50;

  const placeRate = stats.places / stats.runs;
  const winRate = stats.wins / stats.runs;

  const rawScore = Math.round(
    42 + placeRate * 30 + winRate * 22,
  );

  return evidenceCap(rawScore, stats.runs);
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
    else points -= 7 * recencyWeight;
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

function scoreConsistency(historyRuns: HistoryRun[], importedForm?: string | null) {
  const recent = historyRuns
    .slice(0, 5)
    .filter(
      (run) =>
        run.finishing_position !== null &&
        run.finishing_position !== undefined &&
        Number.isFinite(Number(run.finishing_position)),
    );

  const importedRuns = parseImportedFormString(importedForm);

  const positions = recent.length
    ? recent.map((run) => Number(run.finishing_position))
    : importedRuns;

  if (!positions.length) return 50;

  const averageFinish =
    positions.reduce((sum, pos) => sum + Number(pos || 0), 0) / positions.length;

  const topThreeCount = positions.filter((pos) => Number(pos) <= 3).length;
  const poorRunCount = positions.filter((pos) => Number(pos) >= 8).length;

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

if (!matchingRuns.length) return 48;

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
  horse?: Horse | null,
) {
  if (!currentCondition) return 50;

  const target = getConditionBucket(currentCondition);

  const conditionRecord =
    target === "Good"
      ? horse?.good_track_record
      : target === "Soft"
        ? horse?.soft_track_record
        : target === "Heavy"
          ? horse?.heavy_track_record
          : target === "Other"
            ? horse?.synthetic_track_record
            : null;

  const importedScore = scoreImportedStatRecord(conditionRecord);

  const matchingRuns = historyRuns.filter(
    (run) => getConditionBucket(run.meeting?.track_condition) === target,
  );

  if (!matchingRuns.length) {
    if (!conditionRecord) return target === "Heavy" ? 48 : 50;
    return importedScore;
  }

  const historyScore = (() => {
    const places = matchingRuns.filter((run) => {
      const pos = run.finishing_position;
      return pos !== null && pos !== undefined && pos <= 3;
    }).length;

    const wins = matchingRuns.filter(
      (run) => run.finishing_position === 1,
    ).length;

    const placeRate = places / matchingRuns.length;
    const winRate = wins / matchingRuns.length;

    let rawScore = Math.round(34 + placeRate * 36 + winRate * 26);

    if (target === "Heavy") {
      if (matchingRuns.length >= 4 && winRate >= 0.35) rawScore += 8;
      else if (matchingRuns.length >= 3 && placeRate >= 0.66) rawScore += 5;
    }

    if (matchingRuns.length >= 3 && placeRate <= 0.2) rawScore -= 8;

    if (matchingRuns.length === 1) return clamp(rawScore, 35, 68);
    if (matchingRuns.length === 2) return clamp(rawScore, 32, 78);

    return clamp(rawScore, 25, 95);
  })();

  if (!conditionRecord) return historyScore;

  return clamp(Math.round(historyScore * 0.65 + importedScore * 0.35), 25, 95);
}
function getEffectiveBarrier(runner: Runner, fieldWithScratchings: Runner[]) {
  if (runner.barrier === null || runner.barrier === undefined) return null;

  const originalBarrier = Number(runner.barrier);

  if (!Number.isFinite(originalBarrier)) return null;

  const scratchingsInside = fieldWithScratchings.filter((item) => {
    if (item.scratched !== true) return false;
    if (item.barrier === null || item.barrier === undefined) return false;

    return Number(item.barrier) < originalBarrier;
  }).length;

  return Math.max(1, originalBarrier - scratchingsInside);
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
  if (barrier <= 4) return 76;
  if (barrier <= 8) return 62;
  if (barrier <= 12) return 50;
  return 42;
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
    (weight): weight is number =>
      weight !== null && !Number.isNaN(weight),
  );

  if (effectiveWeight === null || !validWeights.length) {
    return 52;
  }

  const min = Math.min(...validWeights);
  const max = Math.max(...validWeights);

  if (min === max) return 55;

  // MUCH softer scaling
  const position =
    (max - effectiveWeight) / (max - min);

  // compressed influence
  return clamp(
    Math.round(46 + position * 18),
    42,
    68,
  );
}
function scoreJockey(
  runner: Runner,
  horseHistoryRuns: HistoryRun[],
  allHistoryRuns: HistoryRun[],
  jockeyProfiles: JockeyProfile[],
) {
  const jockey = String(runner.jockey_name || "").trim().toLowerCase();

  if (!jockey) return 55;

  // HORSE + JOCKEY COMBO HISTORY
  const horseJockeyRuns = horseHistoryRuns.filter(
    (run) => String(run.jockey_name || "").trim().toLowerCase() === jockey,
  );

  if (horseJockeyRuns.length >= 2) {
    const places = horseJockeyRuns.filter((run) => {
      const pos = run.finishing_position;
      return pos !== null && pos !== undefined && pos <= 3;
    }).length;

    const wins = horseJockeyRuns.filter(
      (run) => run.finishing_position === 1,
    ).length;

    const rawScore = Math.round(
      48 +
        (places / horseJockeyRuns.length) * 26 +
        (wins / horseJockeyRuns.length) * 18,
    );

return clamp(rawScore, 45, horseJockeyRuns.length >= 5 ? 86 : 70);
  }

  // SMARTPUNT JOCKEY HISTORY
  const jockeyRuns = allHistoryRuns.filter(
    (run) =>
      String(run.jockey_name || "").trim().toLowerCase() === jockey,
  );

  let smartPuntScore: number | null = null;

  if (jockeyRuns.length >= 3) {
    const places = jockeyRuns.filter((run) => {
      const pos = run.finishing_position;
      return pos !== null && pos !== undefined && pos <= 3;
    }).length;

    const wins = jockeyRuns.filter(
      (run) => run.finishing_position === 1,
    ).length;

    smartPuntScore = clamp(
      Math.round(
        45 +
          (places / jockeyRuns.length) * 24 +
          (wins / jockeyRuns.length) * 16,
      ),
      42,
      88,
    );
  }

  // IMPORTED / MANUAL PROFILE
  const profile =
    jockeyProfiles.find(
      (item) =>
        item.normalised_name === jockey,
    ) || null;

  let profileScore: number | null = null;

  if (profile) {
    const imported = Number(profile.rating || 55);
    const manual = profile.manual_rating;

    profileScore =
      manual !== null && manual !== undefined
        ? Math.round(imported * 0.55 + Number(manual) * 0.45)
        : imported;
  }

  // COMBINED
  if (smartPuntScore !== null && profileScore !== null) {
    return clamp(
      Math.round(
        smartPuntScore * 0.7 +
          profileScore * 0.3,
      ),
      42,
      90,
    );
  }

  if (smartPuntScore !== null) {
    return smartPuntScore;
  }

if (profileScore !== null) {
  return clamp(profileScore, 45, 82);
}

  return 55;
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
jockeyProfiles,
  scoreOverrides,
}: {
  activeRace: Race | null | undefined;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
jockeyProfiles: JockeyProfile[];
  scoreOverrides?: CalculatorScoreOverrides;
}): ScoredRunner[] {
  if (!activeRace) return [];

 const raceMeeting = meetings.find(
  (meeting) => Number(meeting.id) === Number(activeRace.meeting_id),
) || null;

const fieldWithScratchings = runners.filter(
  (runner) => Number(runner.race_id) === Number(activeRace.id),
);

const field = fieldWithScratchings.filter(
  (runner) => runner.scratched !== true,
);

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

const recentForm =
  historyRuns.length >= 3
    ? scoreRecentForm(historyRuns)
    : Math.round(
        (scoreRecentForm(historyRuns) * 0.35) +
          (scoreImportedRecentForm(runner.form_last_6) * 0.65),
      );

const distance =
  historyRuns.filter(
    (run) =>
      getDistanceBucket(run.race?.distance_m) ===
      getDistanceBucket(activeRace.distance_m),
  ).length >= 2
    ? scoreDistanceSuitability(historyRuns, activeRace.distance_m)
    : Math.round(
        (scoreDistanceSuitability(historyRuns, activeRace.distance_m) * 0.4) +
          (scoreImportedStatRecord(runner.distance_form_last_6) * 0.6),
      );

const track =
  historyRuns.filter(
    (run) =>
      run.meeting?.meeting_name === raceMeeting?.meeting_name,
  ).length >= 2
    ? scoreTrackSuitability(historyRuns, raceMeeting?.meeting_name)
    : Math.round(
        (scoreTrackSuitability(historyRuns, raceMeeting?.meeting_name) * 0.4) +
          (scoreImportedStatRecord(runner.track_form_last_6) * 0.6),
      );
const condition =
  scoreOverrides?.condition !== null &&
  scoreOverrides?.condition !== undefined &&
  Number.isFinite(Number(scoreOverrides.condition))
    ? clamp(Number(scoreOverrides.condition))
    : scoreConditionSuitability(historyRuns, raceMeeting?.track_condition);
const effectiveBarrier = getEffectiveBarrier(runner, fieldWithScratchings);

const barrier = scoreBarrier(
  effectiveBarrier,
  activeRace.distance_m,
  raceMeeting?.meeting_name,
);
    const weight = scoreWeight(runner, fieldEffectiveWeights);
const jockey = scoreJockey(
  runner,
  historyRuns,
  allHistoryRuns,
  jockeyProfiles,
);
    const trainer = scoreTrainer(runner, allHistoryRuns);
const consistency = scoreConsistency(historyRuns, runner.form_last_6);

const baseScore = clamp(
  Math.round(
recentForm * 0.25 +
distance * 0.21 +
track * 0.11 +
condition * 0.18 +
barrier * 0.05 +
weight * 0.00 +
jockey * 0.07 +
trainer * 0.02 +
consistency * 0.11
  ),
  25,
  95,
);

const standoutBonus =
  recentForm >= 80 &&
  distance >= 75 &&
  track >= 70 &&
  barrier >= 70
? 10
    : recentForm >= 72 &&
        distance >= 70 &&
        track >= 65 &&
        barrier >= 65
? 6
      : 0;

const score = applyOverconfidenceDampener({
  baseScore: clamp(baseScore + standoutBonus),
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


export type RaceConfidence = {
  tier: "Low" | "Medium" | "High" | "Elite";
  confidencePercent: number;
  gap: number;
  volatility: string;
  suggestedBet: string;
  summary: string;
};

export function calculateRaceConfidence(
  scores: { score: number; placePercent?: number }[],
  context?: {
    trackCondition?: string | null;
    placeTerms?: "win_only" | "top_2" | "top_3" | string | null;
  },
): RaceConfidence {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  const top = sorted[0];
  const second = sorted[1];
  const fourth = sorted[3];

  const gap = top && second ? Math.round(top.score - second.score) : 0;
  const topScore = top ? Number(top.score) : 0;
  const topPlacePercent = top?.placePercent ?? 0;
  const topFourCompression =
    top && fourth ? Math.round(top.score - fourth.score) : gap;

  const trackCondition = String(context?.trackCondition || "").toLowerCase();
  const placeTerms = String(context?.placeTerms || "top_3");

  const baseConfidence = 35;
  const topScoreBoost = clamp(Math.round((topScore - 55) * 1.15), 0, 24);
  const gapBoost = clamp(gap * 4, 0, 24);
  const placeBoost = clamp(Math.round((topPlacePercent - 28) * 0.45), 0, 10);

  const compressionPenalty =
    sorted.length >= 4 && topFourCompression <= 3
      ? 16
      : sorted.length >= 4 && topFourCompression <= 5
        ? 8
        : 0;

  const fieldSizeAdjustment =
    sorted.length <= 7
      ? 5
      : sorted.length >= 14
        ? -8
        : sorted.length >= 11
          ? -4
          : 0;

  const conditionPenalty = trackCondition.startsWith("heavy")
    ? 10
    : trackCondition.startsWith("soft")
      ? 4
      : 0;

  const placeTermsPenalty =
    placeTerms === "win_only" ? 10 : placeTerms === "top_2" ? 5 : 0;

  const confidencePercent = clamp(
    Math.round(
      baseConfidence +
        topScoreBoost +
        gapBoost +
        placeBoost -
        compressionPenalty +
        fieldSizeAdjustment -
        conditionPenalty -
        placeTermsPenalty,
    ),
    0,
    100,
  );

  const tier =
    confidencePercent >= 85
      ? "Elite"
      : confidencePercent >= 70
        ? "High"
        : confidencePercent >= 55
          ? "Medium"
          : "Low";

  const volatility =
    gap >= 8 && topFourCompression >= 10
      ? "Clear Standout"
      : gap >= 4 && topFourCompression >= 6
        ? "Competitive"
        : "Open Race";

  const suggestedBet =
    placeTerms === "win_only"
      ? tier === "Elite" || tier === "High"
        ? "Win"
        : "No Bet"
      : tier === "Elite"
        ? "Best Bet"
        : tier === "High"
          ? "Win"
          : tier === "Medium"
            ? placeTerms === "top_2"
              ? "No Bet"
              : "Place"
            : "No Bet";

const positives: string[] = [];
const risks: string[] = [];

if (sorted.length <= 7) positives.push("a small field");
else if (sorted.length >= 14) risks.push("a large field");
else if (sorted.length >= 11) risks.push("a bigger field");

if (trackCondition.startsWith("heavy")) risks.push("heavy conditions");
else if (trackCondition.startsWith("soft")) risks.push("soft conditions");
else if (trackCondition.startsWith("good")) positives.push("good conditions");

if (placeTerms === "win_only") risks.push("win-only place terms");
else if (placeTerms === "top_2") risks.push("reduced Pay 1 & 2 terms");
else positives.push("standard Pay 1, 2 & 3 terms");

if (gap >= 8) positives.push("a clear ratings gap");
else if (gap >= 4) positives.push("some ratings separation");
else risks.push("a tightly matched field");

if (sorted.length >= 4 && topFourCompression <= 3) {
  risks.push("a tightly compressed top four");
} else if (sorted.length >= 4 && topFourCompression <= 5) {
  risks.push("a fairly compressed top four");
}

function formatDriverList(items: string[]) {
  const list = items.slice(0, 3);

  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;

  return `${list[0]}, ${list[1]} and ${list[2]}`;
}

const riskText = formatDriverList(risks);
const positiveText = formatDriverList(positives);

const summary =
  tier === "Elite" || tier === "High"
    ? `Strong betting setup with ${positiveText || "a favourable race profile"}.`
    : tier === "Medium"
      ? risks.length
        ? `Reasonable betting setup, although ${riskText} add some risk.`
        : `Reasonable betting setup with ${positiveText || "a balanced race profile"}.`
      : risks.length
        ? `Risky betting race due to ${riskText}.`
        : `Risky betting race with limited clear edge from the main confidence drivers.`;

  return {
    tier,
    confidencePercent,
    gap,
    volatility,
    suggestedBet,
    summary,
  };
}
export type CalculatorTipCandidate = {
  id?: number | string;
  runner_id?: number | string;
  score: number | string;
  winPercent?: number | string;
  win_percent?: number | string;
  placePercent?: number | string;
  place_percent?: number | string;
};

export type QualifiedCalculatorTip<T extends CalculatorTipCandidate> = {
  runner: T;
  type: "Win" | "Place";
  gap: number;
  raceConfidence: RaceConfidence;
  qualifiesAsStrongWin: boolean;
  qualifiesAsStrongPlace: boolean;
};

function getCandidateId(row: CalculatorTipCandidate) {
  return Number(row.id ?? row.runner_id ?? 0);
}

function getCandidateScore(row: CalculatorTipCandidate) {
  return Number(row.score || 0);
}

function getCandidateWinPercent(row: CalculatorTipCandidate) {
  return Number(row.winPercent ?? row.win_percent ?? 0);
}

function getCandidatePlacePercent(row: CalculatorTipCandidate) {
  return Number(row.placePercent ?? row.place_percent ?? 0);
}

export function getQualifiedCalculatorTip<T extends CalculatorTipCandidate>(
  rows: T[],
  context?: {
    trackCondition?: string | null;
    placeTerms?: "win_only" | "top_2" | "top_3" | string | null;
  },
): QualifiedCalculatorTip<T> | null {
  if (!rows.length) return null;

  const scoredRows = [...rows].sort(
    (a, b) => getCandidateScore(b) - getCandidateScore(a),
  );

  const raceConfidence = calculateRaceConfidence(
    scoredRows.map((row) => ({
      score: getCandidateScore(row),
      placePercent: getCandidatePlacePercent(row),
    })),
    context,
  );

  if (raceConfidence.tier === "Low") return null;

  const topWin = scoredRows[0] || null;
  const topPlace =
    [...scoredRows].sort(
      (a, b) => getCandidatePlacePercent(b) - getCandidatePlacePercent(a),
    )[0] || null;

  if (!topWin || !topPlace) return null;

  const secondWin =
    scoredRows.find((row) => getCandidateId(row) !== getCandidateId(topWin)) ||
    null;

  const secondPlace =
    scoredRows.find((row) => getCandidateId(row) !== getCandidateId(topPlace)) ||
    null;

  const winGap = secondWin
    ? roundScore(getCandidateScore(topWin) - getCandidateScore(secondWin))
    : roundScore(getCandidateScore(topWin));

  const placeGap = secondPlace
    ? roundScore(getCandidateScore(topPlace) - getCandidateScore(secondPlace))
    : roundScore(getCandidateScore(topPlace));

  const placeTerms = String(context?.placeTerms || "top_3");
  const placeBettingAllowed = placeTerms !== "win_only";

  const minWinScore =
    raceConfidence.tier === "Elite"
      ? 66
      : raceConfidence.tier === "High"
        ? 68
        : raceConfidence.tier === "Medium"
          ? 70
          : 999;

const basePlaceScore =
  raceConfidence.tier === "Elite"
    ? 60
    : raceConfidence.tier === "High"
      ? 62
      : raceConfidence.tier === "Medium"
        ? 62
        : 999;

  const minPlaceScore =
    placeTerms === "top_2" ? basePlaceScore + 3 : basePlaceScore;

  const minPlacePercent = placeTerms === "top_2" ? 35 : 30;
  const minPlaceGap = placeTerms === "top_2" ? 3 : 2;

  const qualifiesAsWin =
    getCandidateScore(topWin) >= minWinScore &&
    winGap >= 4 &&
    getCandidateWinPercent(topWin) >= 8;

  const qualifiesAsPlace =
    placeBettingAllowed &&
    getCandidateScore(topPlace) >= minPlaceScore &&
    getCandidatePlacePercent(topPlace) >= minPlacePercent &&
    placeGap >= minPlaceGap;

  const qualifiesAsStrongWin =
    getCandidateScore(topWin) >= 72 &&
    winGap >= 6 &&
    getCandidateWinPercent(topWin) >= 10;

  const qualifiesAsStrongPlace =
    placeBettingAllowed &&
    getCandidateScore(topPlace) >= 66 &&
    getCandidatePlacePercent(topPlace) >= 34 &&
    placeGap >= 3;

  if (qualifiesAsWin) {
    return {
      runner: topWin,
      type: "Win",
      gap: winGap,
      raceConfidence,
      qualifiesAsStrongWin,
      qualifiesAsStrongPlace: false,
    };
  }

  if (qualifiesAsPlace) {
    return {
      runner: topPlace,
      type: "Place",
      gap: placeGap,
      raceConfidence,
      qualifiesAsStrongWin: false,
      qualifiesAsStrongPlace,
    };
  }

  return null;
}
