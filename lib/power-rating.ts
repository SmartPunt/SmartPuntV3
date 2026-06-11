export type PowerRatingHorse = {
  id: number;
  horse_name?: string | null;
  form_last_6?: string | null;
};

export type PowerRatingStat = {
  horse_id: number;
  runs: number | string | null;
  wins: number | string | null;
  seconds: number | string | null;
  thirds: number | string | null;
};

export type PowerRatingInput = {
  horses: PowerRatingHorse[];
  trackStats: PowerRatingStat[];
  distanceStats: PowerRatingStat[];
  conditionStats: PowerRatingStat[];
};

export type PowerRatingComponentBreakdown = {
  currentFormScore: number;
  recentFormScore: number;
  consistencyScore: number;
  establishedScore: number;
  trackScore: number;
  distanceScore: number;
  conditionScore: number;
  specialistBonus: number;
  intelligenceSources: number;
};

export type PowerRatingResult = {
  horseId: number;
  horseName: string | null;
  eligible: boolean;
  rawScore: number | null;
  powerRating: number | null;
  breakdown: PowerRatingComponentBreakdown | null;
};

const MIN_INTELLIGENCE_SOURCES = 2;
const MAX_SPECIALIST_BONUS = 10;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFormLine(form: string | null | undefined) {
  const cleaned = String(form || "")
    .toLowerCase()
    .replace(/[^0-9x]/g, "");

  const positions: number[] = [];

  for (const char of cleaned) {
    if (char === "x") continue;

    const value = Number(char);
    if (!Number.isFinite(value)) continue;

    positions.push(value === 0 ? 10 : value);
  }

  return positions.slice(0, 6);
}

function scoreRecentForm(form: string | null | undefined) {
  const positions = parseFormLine(form).slice(0, 5);

  if (!positions.length) return 50;

  let points = 0;
  let wins = 0;

  positions.forEach((position, index) => {
    const recencyWeight = index === 0 ? 1.2 : index === 1 ? 1.05 : 1;

    if (position === 1) {
      points += 18 * recencyWeight;
      wins += 1;
    } else if (position === 2) {
      points += 14 * recencyWeight;
    } else if (position === 3) {
      points += 10 * recencyWeight;
    } else if (position <= 5) {
      points += 6 * recencyWeight;
    } else if (position <= 8) {
      points += 2 * recencyWeight;
    } else {
      points -= 7 * recencyWeight;
    }
  });

  const average = points / positions.length;
  let score = clamp(Math.round(50 + average), 20, 95);

  if (wins >= 2) score += 6;
  else if (wins === 1) score += 3;

  if (positions[0] === 1) score += 4;
  if (wins === 0 && positions.length >= 4) score -= 6;

  if (positions.length >= 3) {
    const [a, b, c] = positions;

    if (a < b && b < c) score += 4;
    if (a > b && b > c) score -= 4;
  }

  return clamp(score, 20, 95);
}

function scoreConsistency(form: string | null | undefined) {
  const positions = parseFormLine(form).slice(0, 5);

  if (!positions.length) return 50;

  const averageFinish =
    positions.reduce((sum, position) => sum + position, 0) / positions.length;

  const topThreeCount = positions.filter((position) => position <= 3).length;
  const poorRunCount = positions.filter((position) => position >= 8).length;

  const averageScore = clamp(Math.round(82 - averageFinish * 5), 25, 82);
  const topThreeBonus = topThreeCount * 6;
  const poorRunPenalty = poorRunCount * 7;

  return clamp(averageScore + topThreeBonus - poorRunPenalty, 25, 90);
}

function evidenceCap(score: number, runs: number) {
  if (runs >= 5) return clamp(score, 20, 95);
  if (runs >= 3) return clamp(score, 25, 88);
  if (runs >= 2) return clamp(score, 30, 78);
  return clamp(score, 35, 68);
}

function scoreStatRow(row: PowerRatingStat) {
  const runs = asNumber(row.runs);

  if (!runs) return 50;

  const wins = asNumber(row.wins);
  const seconds = asNumber(row.seconds);
  const thirds = asNumber(row.thirds);
  const places = wins + seconds + thirds;
  const placeRate = places / runs;
  const winRate = wins / runs;

  const rawScore = Math.round(35 + placeRate * 40 + winRate * 25);

  return evidenceCap(rawScore, runs);
}

function scoreStatGroup(rows: PowerRatingStat[]) {
  if (!rows.length) return 50;

  return Math.max(...rows.map(scoreStatRow));
}

function specialistBonusForGroup(rows: PowerRatingStat[]) {
  let bestBonus = 0;

  for (const row of rows) {
    const runs = asNumber(row.runs);
    if (!runs) continue;

    const wins = asNumber(row.wins);
    const places = wins + asNumber(row.seconds) + asNumber(row.thirds);
    const placeRate = places / runs;

    if (runs >= 5 && placeRate >= 0.5) {
      bestBonus = Math.max(bestBonus, 3);
    } else if (runs >= 3 && placeRate >= 0.66) {
      bestBonus = Math.max(bestBonus, 1.5);
    }
  }

  return bestBonus;
}

function groupStatsByHorse(stats: PowerRatingStat[]) {
  const grouped = new Map<number, PowerRatingStat[]>();

  for (const stat of stats) {
    const horseId = Number(stat.horse_id);
    if (!horseId) continue;

    const rows = grouped.get(horseId) || [];
    rows.push(stat);
    grouped.set(horseId, rows);
  }

  return grouped;
}

function hasStatEvidence(rows: PowerRatingStat[]) {
  return rows.some((row) => asNumber(row.runs) > 0);
}

function calculateRawPowerScore({
  horse,
  trackRows,
  distanceRows,
  conditionRows,
}: {
  horse: PowerRatingHorse;
  trackRows: PowerRatingStat[];
  distanceRows: PowerRatingStat[];
  conditionRows: PowerRatingStat[];
}) {
  const intelligenceSources = [
    hasStatEvidence(trackRows),
    hasStatEvidence(distanceRows),
    hasStatEvidence(conditionRows),
  ].filter(Boolean).length;

  const hasUsableRecentForm =
    typeof horse.form_last_6 === "string" &&
    horse.form_last_6.replace(/[^0-9x]/gi, "").length >= 4;

  if (
    intelligenceSources < MIN_INTELLIGENCE_SOURCES &&
    !hasUsableRecentForm
  ) {
    return null;
  }

  const recentFormScore = scoreRecentForm(horse.form_last_6);
  const consistencyScore = scoreConsistency(horse.form_last_6);

  const currentFormScore =
    recentFormScore * 0.6 + consistencyScore * 0.4;

  const trackScore = scoreStatGroup(trackRows);
  const distanceScore = scoreStatGroup(distanceRows);
  const conditionScore = scoreStatGroup(conditionRows);

  const specialistBonus = clamp(
    specialistBonusForGroup(trackRows) +
      specialistBonusForGroup(distanceRows) +
      specialistBonusForGroup(conditionRows),
    0,
    MAX_SPECIALIST_BONUS,
  );

  const establishedScore =
    trackScore * 0.3 +
    distanceScore * 0.3 +
    conditionScore * 0.2 +
(50 + specialistBonus * 3) * 0.2;

  const rawScore = clamp(
    Math.round(currentFormScore * 0.5 + establishedScore * 0.5),
    1,
    100,
  );

  return {
    rawScore,
    breakdown: {
      currentFormScore: Math.round(currentFormScore),
      recentFormScore,
      consistencyScore,
      establishedScore: Math.round(establishedScore),
      trackScore,
      distanceScore,
      conditionScore,
      specialistBonus,
      intelligenceSources,
    },
  };
}

export function buildSmartPuntPowerRatings({
  horses,
  trackStats,
  distanceStats,
  conditionStats,
}: PowerRatingInput): PowerRatingResult[] {
  const trackByHorse = groupStatsByHorse(trackStats);
  const distanceByHorse = groupStatsByHorse(distanceStats);
  const conditionByHorse = groupStatsByHorse(conditionStats);

  const scored = horses.map((horse) => {
    const horseId = Number(horse.id);
    const raw = calculateRawPowerScore({
      horse,
      trackRows: trackByHorse.get(horseId) || [],
      distanceRows: distanceByHorse.get(horseId) || [],
      conditionRows: conditionByHorse.get(horseId) || [],
    });

    return {
      horseId,
      horseName: horse.horse_name || null,
      eligible: Boolean(raw),
      rawScore: raw?.rawScore || null,
      powerRating: null,
      breakdown: raw?.breakdown || null,
    } satisfies PowerRatingResult;
  });

const eligible = scored.filter(
  (result) => result.eligible && result.rawScore !== null,
);

return scored.map((result) => {
  if (!result.eligible || result.rawScore === null) {
    return {
      ...result,
      powerRating: null,
    };
  }

  return {
    ...result,
    powerRating: clamp(Math.round(result.rawScore), 1, 99),
  };
});
}

export function summariseSmartPuntPowerRatings(results: PowerRatingResult[]) {
  const rated = results.filter((result) => result.powerRating !== null).length;

  return {
    total: results.length,
    rated,
    unrated: results.length - rated,
  };
}
