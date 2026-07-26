export const SMARTPUNT_SCORING_VERSION = "v7.2";

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
  runner_number?: number | null;
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

  import_good_record?: string | null;
  import_soft_record?: string | null;
  import_heavy_record?: string | null;
  import_synthetic_record?: string | null;

  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  scratched?: boolean | null;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;

  smartpunt_power_rating?: number | null;

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

export type ScoreAuditStatus = "positive" | "neutral" | "risk" | "fallback";

export type ScoreAuditSection = {
  label: string;
  score: number;
  status: ScoreAuditStatus;
  summary: string;
  details: string[];
  decisionLog: string[];
};

export type RunnerScoringAudit = {
  runnerId: number;
  raceId: number;
  horseId: number;
  horseName: string;
  rawStoredData: {
    runnerRecentForm: string | null;
    runnerDistanceRecord: string | null;
    runnerTrackRecord: string | null;
    horseRecentForm: string | null;
    horseDistanceRecord: string | null;
    horseTrackRecord: string | null;
    goodRecord: string | null;
    softRecord: string | null;
    heavyRecord: string | null;
    syntheticRecord: string | null;
  };
  originalImportedData: {
    runnerNumber: number | null;
    horseName: string;
    barrier: number | null;
    weightKg: number | null;
    marketPrice: number | null;
    recentForm: string | null;
    trackRecord: string | null;
    distanceRecord: string | null;
    goodRecord: string | null;
    softRecord: string | null;
    heavyRecord: string | null;
    syntheticRecord: string | null;
    importedAt: string | null;
    importedBy: string | null;
  };
  overall: {
    score: number;
    baseScore: number;
    standoutBonus: number;
    powerAdjustment: number;
    overconfidenceDampenerApplied: boolean;
  };
  sections: {
    recentForm: ScoreAuditSection;
    distance: ScoreAuditSection;
    track: ScoreAuditSection;
    condition: ScoreAuditSection;
    barrier: ScoreAuditSection;
    weight: ScoreAuditSection;
    jockey: ScoreAuditSection;
    trainer: ScoreAuditSection;
    consistency: ScoreAuditSection;
    power: ScoreAuditSection;
  };
  decisionLog: string[];
};

export type ScoredRunner = Runner & {
  horse_name: string;
  smartpunt_power_rating?: number | null;
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
    powerRating: number;
    powerAdjustment: number;
  };
  audit: RunnerScoringAudit;
};

export type RaceVerdict = {
  type: "Win" | "Place" | "No Bet";
  confidence: "Strong" | "Safe" | "Low Edge";
  reason: string;
};
export type CalculatorScoreOverrides = {
  condition?: number | null;
};

export type CalculatorScoringProfile = {
  weights: {
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
  standout: {
    strongRecentForm: number;
    strongDistance: number;
    strongTrack: number;
    strongBarrier: number;
    strongBonus: number;
    safeRecentForm: number;
    safeDistance: number;
    safeTrack: number;
    safeBarrier: number;
    safeBonus: number;
  };
  power: {
    multiplier: number;
    minAdjustment: number;
    maxAdjustment: number;
  };
};

export type CalculatorScoringProfileInput = {
  weights?: Partial<CalculatorScoringProfile["weights"]>;
  standout?: Partial<CalculatorScoringProfile["standout"]>;
  power?: Partial<CalculatorScoringProfile["power"]>;
};

export const DEFAULT_CALCULATOR_SCORING_PROFILE: CalculatorScoringProfile = {
  weights: {
    recentForm: 0.25,
    distance: 0.21,
    track: 0.11,
    condition: 0.18,
    barrier: 0.05,
    weight: 0,
    jockey: 0.07,
    trainer: 0.02,
    consistency: 0.11,
  },
  standout: {
    strongRecentForm: 80,
    strongDistance: 75,
    strongTrack: 70,
    strongBarrier: 70,
    strongBonus: 10,
    safeRecentForm: 72,
    safeDistance: 70,
    safeTrack: 65,
    safeBarrier: 65,
    safeBonus: 6,
  },
  power: {
    multiplier: 1,
    minAdjustment: -2,
    maxAdjustment: 6,
  },
};

function resolveScoringProfile(
  profile?: CalculatorScoringProfileInput,
): CalculatorScoringProfile {
  return {
    weights: {
      ...DEFAULT_CALCULATOR_SCORING_PROFILE.weights,
      ...(profile?.weights || {}),
    },
    standout: {
      ...DEFAULT_CALCULATOR_SCORING_PROFILE.standout,
      ...(profile?.standout || {}),
    },
    power: {
      ...DEFAULT_CALCULATOR_SCORING_PROFILE.power,
      ...(profile?.power || {}),
    },
  };
}

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
if (value.startsWith("synthetic")) return "Synthetic";
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

const SMARTPUNT_EVIDENCE_MATURITY = 6;
const STORED_EVIDENCE_ADVANTAGE_MARGIN = 3;

type EvidenceSource = "smartpunt" | "stored" | "none";

type EvidenceDecision = {
  source: EvidenceSource;
  smartPuntRuns: number;
  storedRuns: number;
  reason: string;
};

function chooseEvidence({
  smartPuntRuns,
  storedRuns,
}: {
  smartPuntRuns: number;
  storedRuns: number;
}): EvidenceDecision {
  const safeSmartPuntRuns = Math.max(0, Number(smartPuntRuns) || 0);
  const safeStoredRuns = Math.max(0, Number(storedRuns) || 0);

  if (!safeSmartPuntRuns && !safeStoredRuns) {
    return {
      source: "none",
      smartPuntRuns: safeSmartPuntRuns,
      storedRuns: safeStoredRuns,
      reason:
        "Neither SmartPunt history nor a usable stored record was available.",
    };
  }

  if (!safeSmartPuntRuns) {
    return {
      source: "stored",
      smartPuntRuns: safeSmartPuntRuns,
      storedRuns: safeStoredRuns,
      reason:
        "Stored evidence was selected because no matching SmartPunt history was available.",
    };
  }

  if (!safeStoredRuns) {
    return {
      source: "smartpunt",
      smartPuntRuns: safeSmartPuntRuns,
      storedRuns: safeStoredRuns,
      reason:
        "SmartPunt history was selected because no usable stored record was available.",
    };
  }

  if (safeSmartPuntRuns >= SMARTPUNT_EVIDENCE_MATURITY) {
    return {
      source: "smartpunt",
      smartPuntRuns: safeSmartPuntRuns,
      storedRuns: safeStoredRuns,
      reason: `SmartPunt history was selected because it has reached the ${SMARTPUNT_EVIDENCE_MATURITY}-run evidence maturity threshold.`,
    };
  }

  if (
    safeStoredRuns >=
    safeSmartPuntRuns + STORED_EVIDENCE_ADVANTAGE_MARGIN
  ) {
    return {
      source: "stored",
      smartPuntRuns: safeSmartPuntRuns,
      storedRuns: safeStoredRuns,
      reason: `Stored evidence was selected because it contained at least ${STORED_EVIDENCE_ADVANTAGE_MARGIN} more runs than the developing SmartPunt sample.`,
    };
  }

  return {
    source: "smartpunt",
    smartPuntRuns: safeSmartPuntRuns,
    storedRuns: safeStoredRuns,
    reason:
      "SmartPunt history was selected because the stored sample did not have a large enough evidence advantage.",
  };
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
  const topThreeBonus = topThreeCount * 6;
  const poorRunPenalty = poorRunCount * 7;

  return clamp(averageScore + topThreeBonus - poorRunPenalty, 25, 90);
}

function scoreDistanceSuitability(
  historyRuns: HistoryRun[],
  currentDistance: number | null | undefined,
  importedRecord?: string | null,
) {
  if (!currentDistance) return 50;

  const targetBucket = getDistanceBucket(currentDistance);

  const matchingRuns = historyRuns.filter(
    (run) => getDistanceBucket(run.race?.distance_m) === targetBucket,
  );

  const importedStats = parseImportedStatRecord(importedRecord);

  const evidenceDecision = chooseEvidence({
    smartPuntRuns: matchingRuns.length,
    storedRuns: importedStats.runs,
  });

  if (evidenceDecision.source === "stored") {
    return scoreImportedStatRecord(importedRecord);
  }

  if (evidenceDecision.source === "none") {
    return 50;
  }

  const places = matchingRuns.filter((run) => {
    const position = run.finishing_position;

    return (
      position !== null &&
      position !== undefined &&
      position <= 3
    );
  }).length;

  const wins = matchingRuns.filter(
    (run) => run.finishing_position === 1,
  ).length;

  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  const rawScore = Math.round(
    40 + placeRate * 35 + winRate * 20,
  );

  return evidenceCap(rawScore, matchingRuns.length);
}
function scoreTrackSuitability(
  historyRuns: HistoryRun[],
  currentTrack: string | null | undefined,
  importedRecord?: string | null,
) {
  if (!currentTrack) return 50;

  const matchingRuns = historyRuns.filter(
    (run) => run.meeting?.meeting_name === currentTrack,
  );

  const importedStats = parseImportedStatRecord(importedRecord);

  const evidenceDecision = chooseEvidence({
    smartPuntRuns: matchingRuns.length,
    storedRuns: importedStats.runs,
  });

  if (evidenceDecision.source === "stored") {
    return scoreImportedStatRecord(importedRecord);
  }

  if (evidenceDecision.source === "none") {
    return 50;
  }

  const places = matchingRuns.filter((run) => {
    const position = run.finishing_position;

    return (
      position !== null &&
      position !== undefined &&
      position <= 3
    );
  }).length;

  const wins = matchingRuns.filter(
    (run) => run.finishing_position === 1,
  ).length;

  const placeRate = places / matchingRuns.length;
  const winRate = wins / matchingRuns.length;

  const rawScore = Math.round(
    38 + placeRate * 38 + winRate * 24,
  );

  return matchingRuns.length === 1
    ? clamp(rawScore, 48, 72)
    : matchingRuns.length === 2
      ? clamp(rawScore, 46, 82)
      : clamp(rawScore, 25, 95);
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
        : target === "Synthetic"
          ? horse?.synthetic_track_record
          : null;

const importedStats = parseImportedStatRecord(conditionRecord);
const importedScore = scoreImportedStatRecord(conditionRecord);

const matchingRuns = historyRuns.filter(
  (run) =>
    getConditionBucket(run.meeting?.track_condition) === target,
);

const evidenceDecision = chooseEvidence({
  smartPuntRuns: matchingRuns.length,
  storedRuns: importedStats.runs,
});

if (evidenceDecision.source === "stored") {
  return clamp(importedScore, 25, 95);
}

if (evidenceDecision.source === "none") {
  return 50;
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

if (matchingRuns.length === 1) {
  const upperCap = target === "Soft" || target === "Heavy" ? 74 : 68;
return clamp(rawScore, 48, upperCap);
}

if (matchingRuns.length === 2) {
  const upperCap = target === "Soft" || target === "Heavy" ? 84 : 78;
return clamp(rawScore, 46, upperCap);
}

    return clamp(rawScore, 25, 95);
  })();

return historyScore;
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
  jockeyRuns: HistoryRun[],
  profile: JockeyProfile | null,
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

function scoreTrainer(trainerRuns: HistoryRun[]) {
  if (!trainerRuns.length) return 50;

  const places = trainerRuns.filter((run) => {
    const pos = run.finishing_position;
    return pos !== null && pos !== undefined && pos <= 3;
  }).length;

  const wins = trainerRuns.filter(
    (run) => run.finishing_position === 1,
  ).length;

  const rawScore = Math.round(
    43 +
      (places / trainerRuns.length) * 24 +
      (wins / trainerRuns.length) * 14,
  );

  if (trainerRuns.length === 1) return clamp(rawScore, 35, 65);
  if (trainerRuns.length === 2) return clamp(rawScore, 35, 74);

  return clamp(rawScore, 35, 82);
}
function scorePowerRatingInfluence({
  powerRating,
  powerRank,
}: {
  powerRating: number | null | undefined;
  powerRank: number | null;
}) {
  const rating = Number(powerRating || 0);

  if (!rating || !powerRank) return 0;

  let adjustment =
    rating >= 90
      ? 5
      : rating >= 85
        ? 4
        : rating >= 80
          ? 3
          : rating >= 75
            ? 2
            : rating >= 70
              ? 1
              : rating < 50
                ? -2
                : rating < 55
                  ? -1
                  : 0;

  if (powerRank === 1 && rating >= 70) adjustment += 1;
  else if (powerRank <= 3 && rating >= 75) adjustment += 0.5;
  else if (powerRank >= 8 && rating < 60) adjustment -= 0.5;

  return clamp(Math.round(adjustment), -2, 6);
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


function getAuditStatus(score: number, fallbackUsed = false): ScoreAuditStatus {
  if (fallbackUsed) return "fallback";
  if (score >= 65) return "positive";
  if (score >= 50) return "neutral";
  return "risk";
}

function formatAuditScore(score: number) {
  return `${Math.round(Number(score || 0))}/100`;
}

function getRunStatsForAudit<T extends { finishing_position?: number | null }>(runs: T[]) {
  const wins = runs.filter((run) => run.finishing_position === 1).length;
  const places = runs.filter((run) => {
    const position = run.finishing_position;
    return position !== null && position !== undefined && Number(position) <= 3;
  }).length;

  return {
    runs: runs.length,
    wins,
    places,
    placeRate: runs.length ? Math.round((places / runs.length) * 100) : 0,
    winRate: runs.length ? Math.round((wins / runs.length) * 100) : 0,
  };
}

function buildAuditSection({
  label,
  score,
  fallbackUsed = false,
  summary,
  details,
  decisionLog = [],
}: {
  label: string;
  score: number;
  fallbackUsed?: boolean;
  summary: string;
  details: string[];
  decisionLog?: string[];
}): ScoreAuditSection {
  return {
    label,
    score,
    status: getAuditStatus(score, fallbackUsed),
    summary,
    details,
    decisionLog,
  };
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
  scoringProfile: scoringProfileInput,
}: {
  activeRace: Race | null | undefined;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
jockeyProfiles: JockeyProfile[];
  scoreOverrides?: CalculatorScoreOverrides;
  scoringProfile?: CalculatorScoringProfileInput;
}): ScoredRunner[] {
  if (!activeRace) return [];

  const scoringProfile =
    resolveScoringProfile(scoringProfileInput);

  const meetingById = new Map(
    meetings.map((meeting) => [
      Number(meeting.id),
      meeting,
    ]),
  );

  const horseById = new Map(
    horses.map((horse) => [
      Number(horse.id),
      horse,
    ]),
  );

  const raceMeeting =
    meetingById.get(
      Number(activeRace.meeting_id),
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

const horseHistoryRunsByHorseId = new Map<number, HistoryRun[]>();

allHistoryRuns.forEach((historyRun) => {
  const horseId = Number(historyRun.horse_id);
  const existingRuns = horseHistoryRunsByHorseId.get(horseId);

  if (existingRuns) {
    existingRuns.push(historyRun);
  } else {
    horseHistoryRunsByHorseId.set(horseId, [historyRun]);
  }
});

const trainerHistoryRunsByName = new Map<string, HistoryRun[]>();
const jockeyHistoryRunsByName = new Map<string, HistoryRun[]>();

allHistoryRuns.forEach((historyRun) => {
  const trainerName = String(historyRun.trainer_name || "")
    .trim()
    .toLowerCase();

  if (trainerName) {
    const existingTrainerRuns =
      trainerHistoryRunsByName.get(trainerName);

    if (existingTrainerRuns) {
      existingTrainerRuns.push(historyRun);
    } else {
      trainerHistoryRunsByName.set(trainerName, [historyRun]);
    }
  }

  const jockeyName = String(historyRun.jockey_name || "")
    .trim()
    .toLowerCase();

  if (jockeyName) {
    const existingJockeyRuns =
      jockeyHistoryRunsByName.get(jockeyName);

    if (existingJockeyRuns) {
      existingJockeyRuns.push(historyRun);
    } else {
      jockeyHistoryRunsByName.set(jockeyName, [historyRun]);
    }
  }
});

const jockeyProfileByName = new Map<string, JockeyProfile>();

jockeyProfiles.forEach((profile) => {
  const jockeyName = String(
    profile.normalised_name || profile.jockey_name || "",
  )
    .trim()
    .toLowerCase();

  if (!jockeyName) return;

  jockeyProfileByName.set(jockeyName, profile);
});

const powerRankedField = field
  .map((runner) => {
    const horse =
      horseById.get(
        Number(runner.horse_id),
      ) || null;

    return {
      runnerId: Number(runner.id),
      powerRating:
        horse?.smartpunt_power_rating ?? null,
      horseName:
        horse?.horse_name || "",
    };
  })
  .filter(
    (item) =>
      item.powerRating !== null &&
      item.powerRating !== undefined &&
      Number.isFinite(Number(item.powerRating)),
  )
  .sort((a, b) => {
    const powerGap = Number(b.powerRating || 0) - Number(a.powerRating || 0);

    if (powerGap !== 0) return powerGap;

    return a.horseName.localeCompare(b.horseName);
  });

const powerRankByRunnerId = new Map<number, number>();

powerRankedField.forEach((item, index) => {
  powerRankByRunnerId.set(item.runnerId, index + 1);
});
  const baseScored = field.map((runner) => {
    const horse =
      horseById.get(
        Number(runner.horse_id),
      ) || null;

    const historyRuns =
      horseHistoryRunsByHorseId.get(
        Number(runner.horse_id),
      ) || [];

const recentHistoryRunCount = historyRuns.length;
const distanceBucket = getDistanceBucket(activeRace.distance_m);
const distanceHistoryRuns = historyRuns.filter(
  (run) => getDistanceBucket(run.race?.distance_m) === distanceBucket,
);
const trackHistoryRuns = historyRuns.filter(
  (run) => run.meeting?.meeting_name === raceMeeting?.meeting_name,
);
const conditionBucket = getConditionBucket(raceMeeting?.track_condition);
const conditionHistoryRuns = historyRuns.filter(
  (run) => getConditionBucket(run.meeting?.track_condition) === conditionBucket,
);
const conditionRecord =
  conditionBucket === "Good"
    ? horse?.good_track_record
    : conditionBucket === "Soft"
      ? horse?.soft_track_record
      : conditionBucket === "Heavy"
        ? horse?.heavy_track_record
        : conditionBucket === "Synthetic"
          ? horse?.synthetic_track_record
          : null;

const recentForm =
  recentHistoryRunCount >= 3
    ? scoreRecentForm(historyRuns)
    : Math.round(
        (scoreRecentForm(historyRuns) * 0.35) +
          (scoreImportedRecentForm(runner.form_last_6) * 0.65),
      );

const distance = scoreDistanceSuitability(
  historyRuns,
  activeRace.distance_m,
  runner.distance_form_last_6,
);

const track = scoreTrackSuitability(
  historyRuns,
  raceMeeting?.meeting_name,
  runner.track_form_last_6,
);
const condition =
  scoreOverrides?.condition !== null &&
  scoreOverrides?.condition !== undefined &&
  Number.isFinite(Number(scoreOverrides.condition))
    ? clamp(Number(scoreOverrides.condition))
: scoreConditionSuitability(historyRuns, raceMeeting?.track_condition, horse);
const effectiveBarrier = getEffectiveBarrier(runner, fieldWithScratchings);
const effectiveWeight = getEffectiveWeight(runner);

const barrier = scoreBarrier(
  effectiveBarrier,
  activeRace.distance_m,
  raceMeeting?.meeting_name,
);
    const weight = scoreWeight(runner, fieldEffectiveWeights);
const jockeyName = String(runner.jockey_name || "")
  .trim()
  .toLowerCase();

const jockeyRuns = jockeyName
  ? jockeyHistoryRunsByName.get(jockeyName) || []
  : [];

const jockeyProfile = jockeyName
  ? jockeyProfileByName.get(jockeyName) || null
  : null;

const jockey = scoreJockey(
  runner,
  historyRuns,
  jockeyRuns,
  jockeyProfile,
);

const trainerName = String(runner.trainer_name || "")
  .trim()
  .toLowerCase();

const trainerRuns = trainerName
  ? trainerHistoryRunsByName.get(trainerName) || []
  : [];

const trainer = scoreTrainer(trainerRuns);
const consistency = scoreConsistency(historyRuns, runner.form_last_6);

const baseScore = clamp(
  Math.round(
    recentForm * scoringProfile.weights.recentForm +
      distance * scoringProfile.weights.distance +
      track * scoringProfile.weights.track +
      condition * scoringProfile.weights.condition +
      barrier * scoringProfile.weights.barrier +
      weight * scoringProfile.weights.weight +
      jockey * scoringProfile.weights.jockey +
      trainer * scoringProfile.weights.trainer +
      consistency * scoringProfile.weights.consistency,
  ),
  25,
  95,
);

const standoutBonus =
  recentForm >= scoringProfile.standout.strongRecentForm &&
  distance >= scoringProfile.standout.strongDistance &&
  track >= scoringProfile.standout.strongTrack &&
  barrier >= scoringProfile.standout.strongBarrier
    ? scoringProfile.standout.strongBonus
    : recentForm >= scoringProfile.standout.safeRecentForm &&
        distance >= scoringProfile.standout.safeDistance &&
        track >= scoringProfile.standout.safeTrack &&
        barrier >= scoringProfile.standout.safeBarrier
      ? scoringProfile.standout.safeBonus
      : 0;

const rawPowerAdjustment = scorePowerRatingInfluence({
  powerRating: horse?.smartpunt_power_rating,
  powerRank: powerRankByRunnerId.get(Number(runner.id)) || null,
});

const powerAdjustment = clamp(
  Math.round(rawPowerAdjustment * scoringProfile.power.multiplier),
  scoringProfile.power.minAdjustment,
  scoringProfile.power.maxAdjustment,
);

const preDampenedScore = clamp(baseScore + standoutBonus + powerAdjustment);
const score = applyOverconfidenceDampener({
  baseScore: preDampenedScore,
  recentForm,
  distance,
  track,
  condition,
});

const distanceStats = getRunStatsForAudit(distanceHistoryRuns);
const trackStats = getRunStatsForAudit(trackHistoryRuns);
const conditionStats = getRunStatsForAudit(conditionHistoryRuns);
const recentStats = getRunStatsForAudit(historyRuns.slice(0, 5));
const trainerStats = getRunStatsForAudit(trainerRuns);
const horseJockeyRuns = historyRuns.filter(
  (run) =>
    String(run.jockey_name || "").trim().toLowerCase() ===
    jockeyName,
);
const jockeyStats = getRunStatsForAudit(horseJockeyRuns);
const importedRecentScore = scoreImportedRecentForm(
  runner.form_last_6,
);

const importedDistanceStats = parseImportedStatRecord(
  runner.distance_form_last_6,
);

const importedTrackStats = parseImportedStatRecord(
  runner.track_form_last_6,
);
const importedConditionStats = parseImportedStatRecord(
  conditionRecord,
);

const importedDistanceScore = scoreImportedStatRecord(
  runner.distance_form_last_6,
);
const importedTrackScore = scoreImportedStatRecord(
  runner.track_form_last_6,
);
const importedConditionScore = scoreImportedStatRecord(
  conditionRecord,
);

const distanceEvidenceDecision = chooseEvidence({
  smartPuntRuns: distanceHistoryRuns.length,
  storedRuns: importedDistanceStats.runs,
});

const trackEvidenceDecision = chooseEvidence({
  smartPuntRuns: trackHistoryRuns.length,
  storedRuns: importedTrackStats.runs,
});

const conditionEvidenceDecision = chooseEvidence({
  smartPuntRuns: conditionHistoryRuns.length,
  storedRuns: importedConditionStats.runs,
});

const distanceUsedImported =
  distanceEvidenceDecision.source === "stored";

const trackUsedImported =
  trackEvidenceDecision.source === "stored";

const conditionUsedImported =
  conditionEvidenceDecision.source === "stored";

const recentFallbackUsed =
  recentHistoryRunCount < 3 && Boolean(runner.form_last_6);

const distanceFallbackUsed = distanceUsedImported;
const trackFallbackUsed = trackUsedImported;
const conditionFallbackUsed = conditionUsedImported;
const powerRank = powerRankByRunnerId.get(Number(runner.id)) || null;

const auditDecisionLog = [
  recentFallbackUsed
    ? "Recent form used imported form fallback because SmartPunt history sample was below 3 runs."
    : `Recent form used ${recentHistoryRunCount} SmartPunt historical run${recentHistoryRunCount === 1 ? "" : "s"}.`,
distanceEvidenceDecision.source === "stored"
  ? `Distance selected the stored record: ${distanceEvidenceDecision.storedRuns} stored runs versus ${distanceEvidenceDecision.smartPuntRuns} SmartPunt runs. ${distanceEvidenceDecision.reason}`
  : distanceEvidenceDecision.source === "smartpunt"
    ? `Distance selected SmartPunt history: ${distanceEvidenceDecision.smartPuntRuns} SmartPunt runs versus ${distanceEvidenceDecision.storedRuns} stored runs. ${distanceEvidenceDecision.reason}`
    : "Distance had no usable evidence. Neutral score applied.",

trackEvidenceDecision.source === "stored"
  ? `Track selected the stored record: ${trackEvidenceDecision.storedRuns} stored runs versus ${trackEvidenceDecision.smartPuntRuns} SmartPunt runs. ${trackEvidenceDecision.reason}`
  : trackEvidenceDecision.source === "smartpunt"
    ? `Track selected SmartPunt history: ${trackEvidenceDecision.smartPuntRuns} SmartPunt runs versus ${trackEvidenceDecision.storedRuns} stored runs. ${trackEvidenceDecision.reason}`
    : "Track had no usable evidence. Neutral score applied.",

conditionEvidenceDecision.source === "stored"
  ? `Condition selected the stored ${conditionBucket} record: ${conditionEvidenceDecision.storedRuns} stored runs versus ${conditionEvidenceDecision.smartPuntRuns} SmartPunt runs. ${conditionEvidenceDecision.reason}`
  : conditionEvidenceDecision.source === "smartpunt"
    ? `Condition selected SmartPunt ${conditionBucket} history: ${conditionEvidenceDecision.smartPuntRuns} SmartPunt runs versus ${conditionEvidenceDecision.storedRuns} stored runs. ${conditionEvidenceDecision.reason}`
    : "Condition had no usable evidence. Neutral score applied.",
  standoutBonus ? `Applied standout bonus of ${standoutBonus}.` : "No standout bonus applied.",
  powerAdjustment ? `Applied power-rating adjustment of ${powerAdjustment}.` : "No power-rating adjustment applied.",
  score !== preDampenedScore
    ? `Overconfidence dampener reduced score from ${preDampenedScore} to ${score}.`
    : "No overconfidence dampener applied.",
];

const audit: RunnerScoringAudit = {
  runnerId: Number(runner.id),
  raceId: Number(activeRace.id),
  horseId: Number(runner.horse_id),
  horseName: horse?.horse_name || "Unknown horse",
   rawStoredData: {
    runnerRecentForm: runner.form_last_6 ?? null,
    runnerDistanceRecord: runner.distance_form_last_6 ?? null,
    runnerTrackRecord: runner.track_form_last_6 ?? null,
    horseRecentForm: horse?.form_last_6 ?? null,
    horseDistanceRecord: horse?.distance_form_last_6 ?? null,
    horseTrackRecord: horse?.track_form_last_6 ?? null,
    goodRecord: horse?.good_track_record ?? null,
    softRecord: horse?.soft_track_record ?? null,
    heavyRecord: horse?.heavy_track_record ?? null,
    syntheticRecord: horse?.synthetic_track_record ?? null,
  },
  originalImportedData: {
    runnerNumber:
      runner.runner_number !== null &&
      runner.runner_number !== undefined
        ? Number(runner.runner_number)
        : null,
    horseName: horse?.horse_name || "Unknown horse",
    barrier:
      runner.barrier !== null && runner.barrier !== undefined
        ? Number(runner.barrier)
        : null,
    weightKg:
      runner.weight_kg !== null && runner.weight_kg !== undefined
        ? Number(runner.weight_kg)
        : null,
    marketPrice:
      runner.market_price !== null && runner.market_price !== undefined
        ? Number(runner.market_price)
        : null,
    recentForm: runner.form_last_6 ?? null,
    trackRecord: runner.track_form_last_6 ?? null,
    distanceRecord: runner.distance_form_last_6 ?? null,
    goodRecord: runner.import_good_record ?? null,
    softRecord: runner.import_soft_record ?? null,
    heavyRecord: runner.import_heavy_record ?? null,
    syntheticRecord: runner.import_synthetic_record ?? null,
    importedAt: runner.created_at ?? null,
    importedBy: runner.created_by_name ?? null,
  },
  overall: {
    score,
    baseScore,
    standoutBonus,
    powerAdjustment,
    overconfidenceDampenerApplied: score !== preDampenedScore,
  },
  sections: {
    recentForm: buildAuditSection({
      label: "Recent Form",
      score: recentForm,
      fallbackUsed: recentFallbackUsed,
      summary: recentFallbackUsed
        ? "Blended imported recent form with limited SmartPunt history."
        : "Used SmartPunt historical form from previous resulted runs.",
      details: [
        `Score: ${formatAuditScore(recentForm)}`,
        `SmartPunt history runs used: ${recentHistoryRunCount}`,
        `Recent stats: ${recentStats.runs} runs, ${recentStats.wins} wins, ${recentStats.places} places (${recentStats.placeRate}% place rate)`,
        `Imported form: ${runner.form_last_6 || "Not supplied"}`,
        `Imported form score: ${formatAuditScore(importedRecentScore)}`,
      ],
      decisionLog: [
        recentFallbackUsed ? "Fallback/blend used." : "Exact SmartPunt history used.",
      ],
    }),
    distance: buildAuditSection({
      label: "Distance",
      score: distance,
      fallbackUsed: distanceFallbackUsed,
      summary:
        distanceEvidenceDecision.source === "stored"
          ? "Stored distance evidence was selected by the SmartPunt Evidence Engine."
          : distanceEvidenceDecision.source === "smartpunt"
            ? `SmartPunt exact ${distanceBucket} distance history was selected by the SmartPunt Evidence Engine.`
            : `No usable ${distanceBucket} distance evidence was available. Neutral score applied.`,
      details: [
        `Score: ${formatAuditScore(distance)}`,
        `Race distance: ${activeRace.distance_m || "Unknown"}m`,
        `Bucket: ${distanceBucket}`,
        `SmartPunt exact bucket history: ${distanceStats.runs} runs, ${distanceStats.wins} wins, ${distanceStats.places} places (${distanceStats.placeRate}% place rate)`,
        `Stored runner distance record: ${runner.distance_form_last_6 || "Not supplied"}`,
        `Stored distance score: ${formatAuditScore(importedDistanceScore)}`,
        `Selected source: ${
          distanceEvidenceDecision.source === "stored"
            ? "Stored record"
            : distanceEvidenceDecision.source === "smartpunt"
              ? "SmartPunt history"
              : "None"
        }`,
      ],
      decisionLog: [distanceEvidenceDecision.reason],
    }),
    track: buildAuditSection({
      label: "Track",
      score: track,
      fallbackUsed: trackFallbackUsed,
      summary:
        trackEvidenceDecision.source === "stored"
          ? "Stored track evidence was selected by the SmartPunt Evidence Engine."
          : trackEvidenceDecision.source === "smartpunt"
            ? `SmartPunt exact ${raceMeeting?.meeting_name || "track"} history was selected by the SmartPunt Evidence Engine.`
            : `No usable ${raceMeeting?.meeting_name || "track"} evidence was available. Neutral score applied.`,
      details: [
        `Score: ${formatAuditScore(track)}`,
        `Track: ${raceMeeting?.meeting_name || "Unknown"}`,
        `SmartPunt exact track history: ${trackStats.runs} runs, ${trackStats.wins} wins, ${trackStats.places} places (${trackStats.placeRate}% place rate)`,
        `Stored runner track record: ${runner.track_form_last_6 || "Not supplied"}`,
        `Horse master track record: ${horse?.track_form_last_6 || "Not supplied"}`,
        `Stored track score: ${formatAuditScore(importedTrackScore)}`,
        `Selected source: ${
          trackEvidenceDecision.source === "stored"
            ? "Stored record"
            : trackEvidenceDecision.source === "smartpunt"
              ? "SmartPunt history"
              : "None"
        }`,
      ],
      decisionLog: [trackEvidenceDecision.reason],
    }),
    condition: buildAuditSection({
      label: "Condition",
      score: condition,
      fallbackUsed: conditionFallbackUsed,
      summary:
        conditionEvidenceDecision.source === "stored"
          ? `Stored ${conditionBucket} evidence was selected by the SmartPunt Evidence Engine.`
          : conditionEvidenceDecision.source === "smartpunt"
            ? `SmartPunt exact ${conditionBucket} history was selected by the SmartPunt Evidence Engine.`
            : `No usable ${conditionBucket} evidence was available. Neutral score applied.`,
      details: [
        `Score: ${formatAuditScore(condition)}`,
        `Track condition: ${raceMeeting?.track_condition || "Unknown"}`,
        `Condition bucket: ${conditionBucket}`,
        `SmartPunt exact condition history: ${conditionStats.runs} runs, ${conditionStats.wins} wins, ${conditionStats.places} places (${conditionStats.placeRate}% place rate)`,
        `Stored condition record: ${conditionRecord || "Not supplied"}`,
        `Stored condition score: ${formatAuditScore(importedConditionScore)}`,
        `Selected source: ${
          conditionEvidenceDecision.source === "stored"
            ? "Stored record"
            : conditionEvidenceDecision.source === "smartpunt"
              ? "SmartPunt history"
              : "None"
        }`,
      ],
      decisionLog: [conditionEvidenceDecision.reason],
    }),
    barrier: buildAuditSection({
      label: "Barrier",
      score: barrier,
      summary: "Barrier score uses effective barrier after inside scratchings and distance profile.",
      details: [
        `Score: ${formatAuditScore(barrier)}`,
        `Original barrier: ${runner.barrier || "Unknown"}`,
        `Effective barrier: ${effectiveBarrier || "Unknown"}`,
        `Field size excluding scratchings: ${field.length}`,
        `Race distance: ${activeRace.distance_m || "Unknown"}m`,
      ],
      decisionLog: ["Barrier adjusted for scratchings inside the draw."],
    }),
    weight: buildAuditSection({
      label: "Weight",
      score: weight,
      summary: "Weight score compares effective weight against the field after apprentice claims.",
      details: [
        `Score: ${formatAuditScore(weight)}`,
        `Listed weight: ${runner.weight_kg ?? "Unknown"}kg`,
        `Apprentice claim: ${runner.apprentice_claim_kg ?? 0}kg`,
        `Effective weight: ${effectiveWeight ?? "Unknown"}kg`,
      ],
      decisionLog: ["Effective weight calculated before scoring."],
    }),
    jockey: buildAuditSection({
      label: "Jockey",
      score: jockey,
      fallbackUsed: !horseJockeyRuns.length && Boolean(jockeyProfile),
      summary: horseJockeyRuns.length >= 2
        ? "Used horse-and-jockey combination history."
        : jockeyProfile
          ? "Used SmartPunt/profile jockey information where available."
          : "Limited jockey evidence available.",
      details: [
        `Score: ${formatAuditScore(jockey)}`,
        `Jockey: ${runner.jockey_name || "Unknown"}`,
        `Horse/jockey history: ${jockeyStats.runs} runs, ${jockeyStats.wins} wins, ${jockeyStats.places} places (${jockeyStats.placeRate}% place rate)`,
        `Imported/profile rating: ${jockeyProfile?.rating ?? "Not supplied"}`,
        `Manual rating: ${jockeyProfile?.manual_rating ?? "Not supplied"}`,
      ],
      decisionLog: [
        horseJockeyRuns.length >= 2
          ? "Horse/jockey combination history used."
          : jockeyProfile
            ? "Jockey profile contributed."
            : "Neutral jockey score used.",
      ],
    }),
    trainer: buildAuditSection({
      label: "Trainer",
      score: trainer,
      summary: trainerRuns.length
        ? "Trainer score uses SmartPunt historical stable performance."
        : "No trainer history found, so neutral score used.",
      details: [
        `Score: ${formatAuditScore(trainer)}`,
        `Trainer: ${runner.trainer_name || "Unknown"}`,
        `Trainer history: ${trainerStats.runs} runs, ${trainerStats.wins} wins, ${trainerStats.places} places (${trainerStats.placeRate}% place rate)`,
      ],
      decisionLog: [trainerRuns.length ? "Trainer history used." : "Neutral trainer score used."],
    }),
    consistency: buildAuditSection({
      label: "Consistency",
      score: consistency,
      fallbackUsed: !historyRuns.length && Boolean(runner.form_last_6),
      summary: historyRuns.length
        ? "Consistency uses recent SmartPunt finishing positions."
        : "Consistency used imported form because no SmartPunt history was available.",
      details: [
        `Score: ${formatAuditScore(consistency)}`,
        `SmartPunt history runs: ${historyRuns.length}`,
        `Imported form: ${runner.form_last_6 || "Not supplied"}`,
      ],
      decisionLog: [historyRuns.length ? "SmartPunt history used." : "Imported form fallback used."],
    }),
    power: buildAuditSection({
      label: "Power Rating",
      score: Number(horse?.smartpunt_power_rating || 0),
      summary: powerAdjustment
        ? "Power rating adjusted the final score."
        : "Power rating did not materially adjust the final score.",
      details: [
        `Power rating: ${horse?.smartpunt_power_rating ?? "Not supplied"}`,
        `Class rating: ${(horse as any)?.smartpunt_class_rating ?? "Not supplied"}`,
        `Field power rank: ${powerRank || "Not ranked"}`,
        `Raw power adjustment: ${rawPowerAdjustment}`,
        `Applied power adjustment: ${powerAdjustment}`,
      ],
      decisionLog: [powerAdjustment ? "Power adjustment applied." : "No power adjustment applied."],
    }),
  },
  decisionLog: auditDecisionLog,
};

    return {
      ...runner,
      horse_name: horse?.horse_name || "Unknown horse",
      smartpunt_power_rating: horse?.smartpunt_power_rating ?? null,
      meeting_name: raceMeeting?.meeting_name || "Unknown meeting",
      meeting_date: raceMeeting?.meeting_date || "",
      track_condition: raceMeeting?.track_condition || null,
      race_name: activeRace.race_name,
      race_number: activeRace.race_number,
      distance_m: activeRace.distance_m,
      effectiveWeight,
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
        powerRating: Number(horse?.smartpunt_power_rating || 0),
        powerAdjustment,
      },
      audit,
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
  raceName?: string | null;
  placeTerms?: "win_only" | "top_2" | "top_3" | string | null;
  meetingDate?: string | null;
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
const raceName = String(context?.raceName || "").toLowerCase();
const placeTerms = String(context?.placeTerms || "top_3");

const baseConfidence = 30;

const topScoreBoost = clamp(
  Math.round((topScore - 58) * 0.9),
  0,
  18,
);

const gapBoost = clamp(
  gap * 3,
  0,
  18,
);

const placeBoost = clamp(
  Math.round((topPlacePercent - 30) * 0.35),
  0,
  8,
);

const compressionPenalty =
  sorted.length >= 4 && topFourCompression <= 3
    ? 22
    : sorted.length >= 4 && topFourCompression <= 5
      ? 12
      : sorted.length >= 4 && topFourCompression <= 7
        ? 6
        : 0;

const fieldSizeAdjustment =
  sorted.length <= 7
    ? 4
    : sorted.length >= 14
      ? -12
      : sorted.length >= 11
        ? -6
        : 0;

  const conditionPenalty = trackCondition.startsWith("heavy")
    ? 14
    : trackCondition.startsWith("soft")
      ? 5
      : 0;

  const placeTermsPenalty =
    placeTerms === "win_only" ? 10 : placeTerms === "top_2" ? 5 : 0;
// Maiden races no longer receive an automatic confidence penalty.
// SmartPunt's historical performance has shown maidens are one of the
// model's strongest race categories, so confidence is now determined
// entirely by the race data itself.
const maidenPenalty = 0;

  const confidencePercent = clamp(
    Math.round(
      baseConfidence +
        topScoreBoost +
        gapBoost +
        placeBoost -
        compressionPenalty +
        fieldSizeAdjustment -
        conditionPenalty -
        placeTermsPenalty -
        maidenPenalty,
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

// Automatic maiden risk removed.
// If maiden races prove difficult again in the future, the Intelligence
// Board should detect that from evidence rather than a hard-coded rule.
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
  recentForm?: number | string;
  recent_form_score?: number | string;
  components?: {
    recentForm?: number | string;
  } | null;
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

function getCandidateRecentForm(row: CalculatorTipCandidate) {
  return Number(
    row.recentForm ??
      row.recent_form_score ??
      row.components?.recentForm ??
      0,
  );
}

const WEEKDAY_WIN_THRESHOLDS = {
  score: 74,
  gap: 7,
  winPercent: 12,
  recentForm: null,
} as const;

const WEEKEND_WIN_THRESHOLDS = {
  score: 80,
  gap: 8,
  winPercent: 12,
  recentForm: 78,
} as const;

const STRONG_WIN_THRESHOLDS = {
  score: 82,
  gap: 8,
  winPercent: 13,
  recentForm: 80,
} as const;

function isWeekendMeetingDate(value?: string | null) {
  if (!value) return false;

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return weekday === 0 || weekday === 6;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return false;

  const perthWeekday = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "Australia/Perth",
  }).format(parsed);

  return perthWeekday === "Sat" || perthWeekday === "Sun";
}

export type CalculatorTipThresholds = {
  placeBettingAllowed: boolean;
  isHeavyTrack: boolean;
  isWeekend: boolean;
  minWinScore: number | null;
  minWinGap: number;
  minWinPercent: number;
  minWinRecentForm: number | null;
  minPlaceScore: number | null;
  minPlaceGap: number;
  minPlacePercent: number;
};

export function getCalculatorTipThresholds(
  raceConfidence: RaceConfidence,
  context?: {
    trackCondition?: string | null;
    placeTerms?: "win_only" | "top_2" | "top_3" | string | null;
    meetingDate?: string | null;
  },
): CalculatorTipThresholds {
  const placeTerms = String(context?.placeTerms || "top_3");
  const placeBettingAllowed = placeTerms !== "win_only";
  const trackCondition = String(context?.trackCondition || "").toLowerCase();
  const isHeavyTrack = trackCondition.startsWith("heavy");
  const isWeekend = isWeekendMeetingDate(context?.meetingDate);

  const winProfile = isWeekend
    ? WEEKEND_WIN_THRESHOLDS
    : WEEKDAY_WIN_THRESHOLDS;

  const minWinScore =
    raceConfidence.tier === "Low"
      ? null
      : winProfile.score + (isHeavyTrack ? 2 : 0);

  const minWinGap = winProfile.gap + (isHeavyTrack ? 1 : 0);
  const minWinPercent = winProfile.winPercent;
  const minWinRecentForm = winProfile.recentForm;

  const basePlaceScore =
    raceConfidence.tier === "Elite"
      ? 60
      : raceConfidence.tier === "High"
        ? 62
        : raceConfidence.tier === "Medium"
          ? 62
          : null;

  const minPlaceScore =
    basePlaceScore === null
      ? null
      : placeTerms === "top_2"
        ? basePlaceScore + 3
        : isHeavyTrack
          ? basePlaceScore + 1
          : basePlaceScore;

  const minPlacePercent = placeTerms === "top_2" ? 35 : isHeavyTrack ? 32 : 30;
  const minPlaceGap = placeTerms === "top_2" ? 3 : isHeavyTrack ? 3 : 2;

  return {
    placeBettingAllowed,
    isHeavyTrack,
    isWeekend,
    minWinScore,
    minWinGap,
    minWinPercent,
    minWinRecentForm,
    minPlaceScore,
    minPlaceGap,
    minPlacePercent,
  };
}

export function getQualifiedCalculatorTip<T extends CalculatorTipCandidate>(
  rows: T[],
  context?: {
    trackCondition?: string | null;
    raceName?: string | null;
    placeTerms?: "win_only" | "top_2" | "top_3" | string | null;
    meetingDate?: string | null;
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

  const thresholds = getCalculatorTipThresholds(raceConfidence, context);

  const topWinRecentForm = getCandidateRecentForm(topWin);

  const qualifiesAsWin =
    thresholds.minWinScore !== null &&
    getCandidateScore(topWin) >= thresholds.minWinScore &&
    winGap >= thresholds.minWinGap &&
    getCandidateWinPercent(topWin) >= thresholds.minWinPercent &&
    (thresholds.minWinRecentForm === null ||
      topWinRecentForm >= thresholds.minWinRecentForm);

  const qualifiesAsPlace =
    thresholds.placeBettingAllowed &&
    thresholds.minPlaceScore !== null &&
    getCandidateScore(topPlace) >= thresholds.minPlaceScore &&
    getCandidatePlacePercent(topPlace) >= thresholds.minPlacePercent &&
    placeGap >= thresholds.minPlaceGap;

  const qualifiesAsStrongWin =
    getCandidateScore(topWin) >= STRONG_WIN_THRESHOLDS.score &&
    winGap >= STRONG_WIN_THRESHOLDS.gap &&
    getCandidateWinPercent(topWin) >= STRONG_WIN_THRESHOLDS.winPercent &&
    topWinRecentForm >= STRONG_WIN_THRESHOLDS.recentForm;

  const qualifiesAsStrongPlace =
    thresholds.placeBettingAllowed &&
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
