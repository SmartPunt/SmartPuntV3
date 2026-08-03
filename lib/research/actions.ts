import "server-only";

import { getCurrentProfile } from "@/lib/auth";

export type ResearchClassificationSnapshot = {
  id: number;
  race_id: number;
  meeting_id: number | null;

  scoring_version: string | null;
  classifier_version: string | null;

  meeting_name: string | null;
  meeting_date: string | null;

  race_number: number | null;
  race_name: string | null;
  distance_m: number | null;

  distance_band: string | null;
  track_condition: string | null;
  condition_band: string | null;
  place_terms: string | null;

  active_runner_count: number | null;
  field_size_band: string | null;

  race_confidence_tier: string | null;
  race_confidence_percent: number | null;
  race_gap: number | null;

  meeting_type: string | null;
  race_class: string | null;
  complexity_band: string | null;

  snapshot_batch_id: string | null;
  snapshot_stage: string | null;
  snapshot_at: string | null;
  created_at: string | null;
};

export type ResearchPredictionRunnerSnapshot = {
  id: number;
  race_id: number;
  meeting_id: number | null;

  runner_id: number;
  horse_id: number | null;

  horse_name: string | null;
  runner_number: number | null;

  meeting_name: string | null;
  meeting_date: string | null;

  race_number: number | null;
  race_name: string | null;

  predicted_rank: number | null;
  score: number | null;
  win_percent: number | null;
  place_percent: number | null;

  race_gap: number | null;

  smartpunt_tip: boolean | null;
  smartpunt_tip_type: string | null;

  race_confidence_tier: string | null;
  race_confidence_percent: number | null;

  scoring_version: string | null;
  classifier_version: string | null;

  snapshot_batch_id: string | null;
  snapshot_stage: string | null;
  snapshot_at: string | null;
  created_at: string | null;
};

export type ResearchRunnerComponentSnapshot = {
  id: number;
  race_id: number;
  meeting_id: number | null;

  runner_id: number;
  horse_id: number | null;

  snapshot_batch_id: string | null;

  scoring_version: string | null;
  classifier_version: string | null;

  predicted_rank: number | null;
  total_score: number | null;

  power_rating: number | null;
  power_adjustment: number | null;
  base_score: number | null;
  standout_bonus: number | null;

  overconfidence_dampener_applied: boolean | null;

  component_scores: Record<string, unknown> | null;
  scoring_audit: Record<string, unknown> | null;

  snapshot_stage: string | null;
  snapshot_at: string | null;
  created_at: string | null;
};
export type ResearchBatchRunner = {
  runnerId: number;
  horseId: number | null;

  predictedRank: number | null;

  prediction: ResearchPredictionRunnerSnapshot;
  component: ResearchRunnerComponentSnapshot | null;

  hasComponentSnapshot: boolean;
};
export type ResearchEvidenceSource =
  | "smartpunt_history"
  | "stored_evidence"
  | "imported_evidence"
  | "neutral"
  | "fallback"
  | "unknown";

export type ResearchEvidenceMix = {
  smartpuntHistoryCount: number;
  storedEvidenceCount: number;
  importedEvidenceCount: number;
  neutralCount: number;
  fallbackCount: number;
  unknownCount: number;

  observationCount: number;

  smartpuntHistoryPercent: number;
  storedEvidencePercent: number;
  importedEvidencePercent: number;
  neutralPercent: number;
  fallbackPercent: number;
  unknownPercent: number;
};

export type ResearchCompetitionAnalysis = {
  runnerCount: number;

  topScore: number | null;
  secondScore: number | null;
  thirdScore: number | null;
  lowestScore: number | null;

  averageScore: number | null;
  medianScore: number | null;
  scoreStandardDeviation: number | null;

  topGap: number | null;
  secondGap: number | null;
  topThreeSpread: number | null;
  fieldSpread: number | null;
  averageAdjacentGap: number | null;

  competitionIndex: number | null;

  competitionBand:
    | "Dominant"
    | "Two-Horse"
    | "Competitive"
    | "Compressed"
    | "Wide-Open"
    | "Insufficient Data";
};

export type ResearchRaceAnalysis = {
  analysisVersion: "race-analysis-v1";

  snapshotBatchId: string;
  raceId: number;
  meetingId: number | null;

  scoringVersion: string | null;
  classifierVersion: string | null;

  competition: ResearchCompetitionAnalysis;
  evidence: ResearchEvidenceMix;

  analysedAt: string;
};
export type ResearchBatchSummary = {
  snapshotBatchId: string;

  raceId: number;
  meetingId: number | null;

  meetingName: string | null;
  meetingDate: string | null;

  raceNumber: number | null;
  raceName: string | null;
  distanceM: number | null;

  conditionBand: string | null;
  fieldSizeBand: string | null;
  activeRunnerCount: number;

  raceConfidenceTier: string | null;
  raceConfidencePercent: number;
  raceGap: number;

  scoringVersion: string | null;
  classifierVersion: string | null;

  snapshotStage: string | null;
  snapshotAt: string | null;
};

export type ResearchSnapshotStatistics = {
  classificationSnapshotCount: number;
  predictionRunnerSnapshotCount: number;

  classificationBatchCount: number;
  predictionBatchCount: number;

  capturedRaceCount: number;
  capturedRunnerCount: number;

  legacyClassificationCount: number;
  legacyPredictionRunnerCount: number;
};

export type ResearchWarehouseHealth = {
  status: "healthy" | "warning" | "empty";

  warehouseHealthy: boolean;

  latestClassificationBatchId: string | null;
  latestPredictionBatchId: string | null;

  latestClassificationSnapshotAt: string | null;
  latestPredictionSnapshotAt: string | null;

  latestBatchIdsMatch: boolean;

  warnings: string[];
};

export type ResearchBatchDetails = {
  batch: ResearchBatchSummary | null;

  classificationSnapshots: ResearchClassificationSnapshot[];
  predictionSnapshots: ResearchPredictionRunnerSnapshot[];
  componentSnapshots: ResearchRunnerComponentSnapshot[];

  runners: ResearchBatchRunner[];

  analysis: ResearchRaceAnalysis | null;

  classificationCount: number;
  predictionRunnerCount: number;
  componentRunnerCount: number;

  expectedRunnerCount: number;
  runnerCountMatches: boolean;
  componentRunnerCountMatches: boolean;

  warnings: string[];
};

export type ResearchDashboard = {
  health: ResearchWarehouseHealth;
  statistics: ResearchSnapshotStatistics;

  latestBatch: ResearchBatchSummary | null;
  recentBatches: ResearchBatchSummary[];

  latestMeeting: string | null;
  latestRace: string | null;
  latestSnapshotAt: string | null;

  scoringVersion: string | null;
  classifierVersion: string | null;
};

async function requireResearchAdmin() {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    throw new Error("Unauthorized");
  }

  return profile;
}

function getServiceRoleConfiguration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration in environment variables.",
    );
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
}

async function serviceRoleSelect<T>(path: string): Promise<T[]> {
  const { supabaseUrl, headers } =
    getServiceRoleConfiguration();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText ||
        `Research warehouse request failed for ${path}`,
    );
  }

  const rows = await response.json();

  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function serviceRoleCount(
  table: string,
  filter = "",
): Promise<number> {
  const { supabaseUrl, headers } =
    getServiceRoleConfiguration();

  const suffix = filter
    ? `&${filter}`
    : "";

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=id&limit=1${suffix}`,
    {
      method: "GET",
      headers: {
        ...headers,
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText ||
        `Research warehouse count failed for ${table}`,
    );
  }

  const contentRange =
    response.headers.get("content-range") || "";

  const totalText = contentRange.split("/")[1];
  const total = Number(totalText);

  return Number.isFinite(total) ? total : 0;
}

function uniqueStrings(
  values: Array<string | null | undefined>,
) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function uniqueNumbers(
  values: Array<number | string | null | undefined>,
) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0,
        ),
    ),
  );
}
function roundResearchNumber(
  value: number,
  digits = 2,
) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function clampResearchNumber(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function averageResearchNumbers(
  values: number[],
): number | null {
  if (!values.length) return null;

  return (
    values.reduce(
      (total, value) => total + value,
      0,
    ) / values.length
  );
}

function medianResearchNumbers(
  values: number[],
): number | null {
  if (!values.length) return null;

  const ordered = [...values].sort(
    (a, b) => a - b,
  );

  const middleIndex = Math.floor(
    ordered.length / 2,
  );

  if (ordered.length % 2 === 1) {
    return ordered[middleIndex];
  }

  return (
    ordered[middleIndex - 1] +
    ordered[middleIndex]
  ) / 2;
}

function standardDeviationResearchNumbers(
  values: number[],
): number | null {
  if (!values.length) return null;

  const average =
    averageResearchNumbers(values);

  if (average === null) return null;

  const variance =
    values.reduce(
      (total, value) =>
        total +
        (value - average) ** 2,
      0,
    ) / values.length;

  return Math.sqrt(variance);
}

function normaliseEvidenceText(
  value: unknown,
) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function classifyEvidenceSource(
  section: unknown,
): ResearchEvidenceSource {
  if (
    !section ||
    typeof section !== "object"
  ) {
    return "unknown";
  }

  const sectionRecord =
    section as Record<string, unknown>;

  const details = Array.isArray(
    sectionRecord.details,
  )
    ? sectionRecord.details
        .map(normaliseEvidenceText)
        .join(" ")
    : "";

  const decisionLog = Array.isArray(
    sectionRecord.decisionLog,
  )
    ? sectionRecord.decisionLog
        .map(normaliseEvidenceText)
        .join(" ")
    : "";

  const summary = normaliseEvidenceText(
    sectionRecord.summary,
  );

  const status = normaliseEvidenceText(
    sectionRecord.status,
  );

  const combinedText = [
    details,
    decisionLog,
    summary,
  ]
    .filter(Boolean)
    .join(" ");

  /*
   * Prefer an explicitly selected evidence source.
   * This mirrors the Evidence Engine wording already
   * captured in scoring_audit.
   */
  if (
    combinedText.includes(
      "selected source: smartpunt history",
    ) ||
    combinedText.includes(
      "smartpunt history was selected",
    ) ||
    combinedText.includes(
      "exact smartpunt history used",
    )
  ) {
    return "smartpunt_history";
  }

  if (
    combinedText.includes(
      "selected source: stored record",
    ) ||
    combinedText.includes(
      "stored evidence was selected",
    ) ||
    combinedText.includes(
      "selected the stored record",
    )
  ) {
    return "stored_evidence";
  }

  if (
    combinedText.includes(
      "selected source: imported",
    ) ||
    combinedText.includes(
      "imported evidence was selected",
    ) ||
    combinedText.includes(
      "imported form used",
    )
  ) {
    return "imported_evidence";
  }

  if (
    status === "fallback" ||
    combinedText.includes("fallback")
  ) {
    return "fallback";
  }

  if (
    status === "neutral" ||
    combinedText.includes(
      "neutral applied",
    )
  ) {
    return "neutral";
  }

  return "unknown";
}

function buildEvidenceMix(
  componentSnapshots:
    ResearchRunnerComponentSnapshot[],
): ResearchEvidenceMix {
  const counts: Record<
    ResearchEvidenceSource,
    number
  > = {
    smartpunt_history: 0,
    stored_evidence: 0,
    imported_evidence: 0,
    neutral: 0,
    fallback: 0,
    unknown: 0,
  };

  for (const component of componentSnapshots) {
    const scoringAudit =
      component.scoring_audit;

    if (
      !scoringAudit ||
      typeof scoringAudit !== "object"
    ) {
      counts.unknown += 1;
      continue;
    }

    const sectionsValue =
      (
        scoringAudit as Record<
          string,
          unknown
        >
      ).sections;

    if (
      !sectionsValue ||
      typeof sectionsValue !== "object"
    ) {
      counts.unknown += 1;
      continue;
    }

    const sections =
      sectionsValue as Record<
        string,
        unknown
      >;

    for (const section of Object.values(
      sections,
    )) {
      const source =
        classifyEvidenceSource(section);

      counts[source] += 1;
    }
  }

  const observationCount =
    Object.values(counts).reduce(
      (total, count) => total + count,
      0,
    );

  function toPercent(count: number) {
    if (!observationCount) return 0;

    return roundResearchNumber(
      (count / observationCount) * 100,
      1,
    );
  }

  return {
    smartpuntHistoryCount:
      counts.smartpunt_history,

    storedEvidenceCount:
      counts.stored_evidence,

    importedEvidenceCount:
      counts.imported_evidence,

    neutralCount: counts.neutral,
    fallbackCount: counts.fallback,
    unknownCount: counts.unknown,

    observationCount,

    smartpuntHistoryPercent:
      toPercent(
        counts.smartpunt_history,
      ),

    storedEvidencePercent:
      toPercent(
        counts.stored_evidence,
      ),

    importedEvidencePercent:
      toPercent(
        counts.imported_evidence,
      ),

    neutralPercent:
      toPercent(counts.neutral),

    fallbackPercent:
      toPercent(counts.fallback),

    unknownPercent:
      toPercent(counts.unknown),
  };
}

function buildCompetitionAnalysis(
  predictionSnapshots:
    ResearchPredictionRunnerSnapshot[],
): ResearchCompetitionAnalysis {
  const orderedScores =
    predictionSnapshots
      .map((snapshot) =>
        Number(snapshot.score),
      )
      .filter((score) =>
        Number.isFinite(score),
      )
      .sort((a, b) => b - a);

  const runnerCount =
    orderedScores.length;

  if (runnerCount < 2) {
    return {
      runnerCount,

      topScore:
        orderedScores[0] ?? null,

      secondScore: null,
      thirdScore: null,

      lowestScore:
        orderedScores[0] ?? null,

      averageScore:
        orderedScores[0] ?? null,

      medianScore:
        orderedScores[0] ?? null,

      scoreStandardDeviation: null,

      topGap: null,
      secondGap: null,
      topThreeSpread: null,
      fieldSpread: null,
      averageAdjacentGap: null,

      competitionIndex: null,
      competitionBand:
        "Insufficient Data",
    };
  }

  const topScore =
    orderedScores[0];

  const secondScore =
    orderedScores[1];

  const thirdScore =
    orderedScores[2] ?? null;

  const lowestScore =
    orderedScores[
      orderedScores.length - 1
    ];

  const topGap =
    topScore - secondScore;

  const secondGap =
    thirdScore !== null
      ? secondScore - thirdScore
      : null;

  const topThreeSpread =
    thirdScore !== null
      ? topScore - thirdScore
      : null;

  const fieldSpread =
    topScore - lowestScore;

  const adjacentGaps: number[] = [];

  for (
    let index = 0;
    index < orderedScores.length - 1;
    index += 1
  ) {
    adjacentGaps.push(
      orderedScores[index] -
        orderedScores[index + 1],
    );
  }

  const averageScore =
    averageResearchNumbers(
      orderedScores,
    );

  const medianScore =
    medianResearchNumbers(
      orderedScores,
    );

  const scoreStandardDeviation =
    standardDeviationResearchNumbers(
      orderedScores,
    );

  const averageAdjacentGap =
    averageResearchNumbers(
      adjacentGaps,
    );

  /*
   * Provisional research-only index.
   *
   * A high value means the field is tightly grouped.
   * A low value means there is greater separation.
   *
   * These weights are deliberately versioned as V1
   * and will later be calibrated against historical
   * winners and tipping performance.
   */
  const rawCompetitionIndex =
    100 -
    topGap * 7 -
    (topThreeSpread ?? topGap) * 2.5 -
    (scoreStandardDeviation ?? 0) * 2;

  const competitionIndex =
    roundResearchNumber(
      clampResearchNumber(
        rawCompetitionIndex,
        0,
        100,
      ),
      1,
    );

  let competitionBand:
    ResearchCompetitionAnalysis["competitionBand"];

  if (
    topGap >= 8 &&
    fieldSpread >= 12
  ) {
    competitionBand = "Dominant";
  } else if (
    thirdScore !== null &&
    topGap <= 3 &&
    (secondGap ?? 0) >= 6
  ) {
    competitionBand = "Two-Horse";
  } else if (
    competitionIndex >= 82
  ) {
    competitionBand = "Wide-Open";
  } else if (
    competitionIndex >= 68
  ) {
    competitionBand = "Compressed";
  } else {
    competitionBand = "Competitive";
  }

  return {
    runnerCount,

    topScore:
      roundResearchNumber(topScore),

    secondScore:
      roundResearchNumber(secondScore),

    thirdScore:
      thirdScore !== null
        ? roundResearchNumber(
            thirdScore,
          )
        : null,

    lowestScore:
      roundResearchNumber(
        lowestScore,
      ),

    averageScore:
      averageScore !== null
        ? roundResearchNumber(
            averageScore,
          )
        : null,

    medianScore:
      medianScore !== null
        ? roundResearchNumber(
            medianScore,
          )
        : null,

    scoreStandardDeviation:
      scoreStandardDeviation !== null
        ? roundResearchNumber(
            scoreStandardDeviation,
          )
        : null,

    topGap:
      roundResearchNumber(topGap),

    secondGap:
      secondGap !== null
        ? roundResearchNumber(
            secondGap,
          )
        : null,

    topThreeSpread:
      topThreeSpread !== null
        ? roundResearchNumber(
            topThreeSpread,
          )
        : null,

    fieldSpread:
      roundResearchNumber(
        fieldSpread,
      ),

    averageAdjacentGap:
      averageAdjacentGap !== null
        ? roundResearchNumber(
            averageAdjacentGap,
          )
        : null,

    competitionIndex,
    competitionBand,
  };
}

export function analyseResearchBatch({
  batch,
  predictionSnapshots,
  componentSnapshots,
}: {
  batch: ResearchBatchSummary | null;

  predictionSnapshots:
    ResearchPredictionRunnerSnapshot[];

  componentSnapshots:
    ResearchRunnerComponentSnapshot[];
}): ResearchRaceAnalysis | null {
  if (
    !batch ||
    !batch.snapshotBatchId ||
    predictionSnapshots.length === 0
  ) {
    return null;
  }

  return {
    analysisVersion:
      "race-analysis-v1",

    snapshotBatchId:
      batch.snapshotBatchId,

    raceId: batch.raceId,
    meetingId: batch.meetingId,

    scoringVersion:
      batch.scoringVersion,

    classifierVersion:
      batch.classifierVersion,

    competition:
      buildCompetitionAnalysis(
        predictionSnapshots,
      ),

    evidence:
      buildEvidenceMix(
        componentSnapshots,
      ),

    analysedAt:
      new Date().toISOString(),
  };
}
function toBatchSummary(
  snapshot: ResearchClassificationSnapshot,
): ResearchBatchSummary | null {
  const snapshotBatchId = String(
    snapshot.snapshot_batch_id || "",
  ).trim();

  if (!snapshotBatchId) {
    return null;
  }

  return {
    snapshotBatchId,

    raceId: Number(snapshot.race_id),
    meetingId: snapshot.meeting_id
      ? Number(snapshot.meeting_id)
      : null,

    meetingName: snapshot.meeting_name || null,
    meetingDate: snapshot.meeting_date || null,

    raceNumber:
      snapshot.race_number !== null &&
      snapshot.race_number !== undefined
        ? Number(snapshot.race_number)
        : null,

    raceName: snapshot.race_name || null,

    distanceM:
      snapshot.distance_m !== null &&
      snapshot.distance_m !== undefined
        ? Number(snapshot.distance_m)
        : null,

    conditionBand: snapshot.condition_band || null,
    fieldSizeBand: snapshot.field_size_band || null,

    activeRunnerCount: Number(
      snapshot.active_runner_count || 0,
    ),

    raceConfidenceTier:
      snapshot.race_confidence_tier || null,

    raceConfidencePercent: Number(
      snapshot.race_confidence_percent || 0,
    ),

    raceGap: Number(snapshot.race_gap || 0),

    scoringVersion: snapshot.scoring_version || null,
    classifierVersion:
      snapshot.classifier_version || null,

    snapshotStage: snapshot.snapshot_stage || null,
    snapshotAt:
      snapshot.snapshot_at ||
      snapshot.created_at ||
      null,
  };
}

export async function getRecentSnapshotBatches(
  limit = 20,
): Promise<ResearchBatchSummary[]> {
  await requireResearchAdmin();

  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    100,
  );

  const rows =
    await serviceRoleSelect<ResearchClassificationSnapshot>(
      [
        "race_classification_snapshots",
        "?select=*",
        "&snapshot_batch_id=not.is.null",
        "&order=snapshot_at.desc",
        `&limit=${safeLimit}`,
      ].join(""),
    );

  const seenBatchIds = new Set<string>();
  const batches: ResearchBatchSummary[] = [];

  for (const row of rows) {
    const batch = toBatchSummary(row);

    if (!batch) continue;

    if (seenBatchIds.has(batch.snapshotBatchId)) {
      continue;
    }

    seenBatchIds.add(batch.snapshotBatchId);
    batches.push(batch);
  }

  return batches;
}

export async function getSnapshotStatistics(): Promise<ResearchSnapshotStatistics> {
  await requireResearchAdmin();

  const [
    classificationSnapshotCount,
    predictionRunnerSnapshotCount,
    legacyClassificationCount,
    legacyPredictionRunnerCount,
    classificationRows,
    predictionRows,
  ] = await Promise.all([
    serviceRoleCount(
      "race_classification_snapshots",
    ),

    serviceRoleCount(
      "race_prediction_snapshot_runners",
    ),

    serviceRoleCount(
      "race_classification_snapshots",
      "snapshot_batch_id=is.null",
    ),

    serviceRoleCount(
      "race_prediction_snapshot_runners",
      "snapshot_batch_id=is.null",
    ),

    serviceRoleSelect<{
      race_id: number;
      snapshot_batch_id: string | null;
    }>(
      [
        "race_classification_snapshots",
        "?select=race_id,snapshot_batch_id",
        "&snapshot_batch_id=not.is.null",
      ].join(""),
    ),

    serviceRoleSelect<{
      runner_id: number;
      snapshot_batch_id: string | null;
    }>(
      [
        "race_prediction_snapshot_runners",
        "?select=runner_id,snapshot_batch_id",
        "&snapshot_batch_id=not.is.null",
      ].join(""),
    ),
  ]);

  const classificationBatchIds = uniqueStrings(
    classificationRows.map(
      (row) => row.snapshot_batch_id,
    ),
  );

  const predictionBatchIds = uniqueStrings(
    predictionRows.map(
      (row) => row.snapshot_batch_id,
    ),
  );

  const capturedRaceIds = uniqueNumbers(
    classificationRows.map((row) => row.race_id),
  );

  const capturedRunnerIds = uniqueNumbers(
    predictionRows.map((row) => row.runner_id),
  );

  return {
    classificationSnapshotCount,
    predictionRunnerSnapshotCount,

    classificationBatchCount:
      classificationBatchIds.length,

    predictionBatchCount:
      predictionBatchIds.length,

    capturedRaceCount: capturedRaceIds.length,
    capturedRunnerCount: capturedRunnerIds.length,

    legacyClassificationCount,
    legacyPredictionRunnerCount,
  };
}

export async function getWarehouseHealth(): Promise<ResearchWarehouseHealth> {
  await requireResearchAdmin();

  const [
    latestClassificationRows,
    latestPredictionRows,
    classificationCount,
    predictionCount,
  ] = await Promise.all([
    serviceRoleSelect<ResearchClassificationSnapshot>(
      [
        "race_classification_snapshots",
        "?select=*",
        "&snapshot_batch_id=not.is.null",
        "&order=snapshot_at.desc",
        "&limit=1",
      ].join(""),
    ),

    serviceRoleSelect<ResearchPredictionRunnerSnapshot>(
      [
        "race_prediction_snapshot_runners",
        "?select=*",
        "&snapshot_batch_id=not.is.null",
        "&order=snapshot_at.desc",
        "&limit=1",
      ].join(""),
    ),

    serviceRoleCount(
      "race_classification_snapshots",
    ),

    serviceRoleCount(
      "race_prediction_snapshot_runners",
    ),
  ]);

  const latestClassification =
    latestClassificationRows[0] || null;

  const latestPrediction =
    latestPredictionRows[0] || null;

  const latestClassificationBatchId =
    latestClassification?.snapshot_batch_id || null;

  const latestPredictionBatchId =
    latestPrediction?.snapshot_batch_id || null;

  const latestBatchIdsMatch =
    Boolean(latestClassificationBatchId) &&
    Boolean(latestPredictionBatchId) &&
    latestClassificationBatchId ===
      latestPredictionBatchId;

  const warnings: string[] = [];

  if (classificationCount === 0) {
    warnings.push(
      "No race classification snapshots have been captured.",
    );
  }

  if (predictionCount === 0) {
    warnings.push(
      "No prediction runner snapshots have been captured.",
    );
  }

  if (
    classificationCount > 0 &&
    !latestClassificationBatchId
  ) {
    warnings.push(
      "The latest classification snapshot does not have a snapshot batch ID.",
    );
  }

  if (
    predictionCount > 0 &&
    !latestPredictionBatchId
  ) {
    warnings.push(
      "The latest prediction snapshot does not have a snapshot batch ID.",
    );
  }

  if (
    latestClassificationBatchId &&
    latestPredictionBatchId &&
    !latestBatchIdsMatch
  ) {
    warnings.push(
      "The latest classification and prediction snapshots belong to different batches.",
    );
  }

  const warehouseEmpty =
    classificationCount === 0 &&
    predictionCount === 0;

  const warehouseHealthy =
    !warehouseEmpty &&
    classificationCount > 0 &&
    predictionCount > 0 &&
    latestBatchIdsMatch &&
    warnings.length === 0;

  return {
    status: warehouseEmpty
      ? "empty"
      : warehouseHealthy
        ? "healthy"
        : "warning",

    warehouseHealthy,

    latestClassificationBatchId,
    latestPredictionBatchId,

    latestClassificationSnapshotAt:
      latestClassification?.snapshot_at ||
      latestClassification?.created_at ||
      null,

    latestPredictionSnapshotAt:
      latestPrediction?.snapshot_at ||
      latestPrediction?.created_at ||
      null,

    latestBatchIdsMatch,

    warnings,
  };
}

export async function getResearchBatch(
  snapshotBatchId: string,
): Promise<ResearchBatchDetails> {
  await requireResearchAdmin();

  const cleanedBatchId = String(
    snapshotBatchId || "",
  ).trim();

  if (!cleanedBatchId) {
    throw new Error(
      "A research snapshot batch ID is required.",
    );
  }

  const encodedBatchId =
    encodeURIComponent(cleanedBatchId);

  const [
    classificationSnapshots,
    predictionSnapshots,
    componentSnapshots,
  ] = await Promise.all([
    serviceRoleSelect<ResearchClassificationSnapshot>(
      [
        "race_classification_snapshots",
        "?select=*",
        `&snapshot_batch_id=eq.${encodedBatchId}`,
        "&order=snapshot_at.asc",
      ].join(""),
    ),

    serviceRoleSelect<ResearchPredictionRunnerSnapshot>(
      [
        "race_prediction_snapshot_runners",
        "?select=*",
        `&snapshot_batch_id=eq.${encodedBatchId}`,
        "&order=predicted_rank.asc",
      ].join(""),
    ),

    serviceRoleSelect<ResearchRunnerComponentSnapshot>(
      [
        "runner_component_snapshots",
        "?select=*",
        `&snapshot_batch_id=eq.${encodedBatchId}`,
        "&order=predicted_rank.asc",
      ].join(""),
    ),
  ]);

  const batch =
    classificationSnapshots.length > 0
      ? toBatchSummary(classificationSnapshots[0])
      : null;

  const expectedRunnerCount = Number(
    batch?.activeRunnerCount || 0,
  );

  const predictionRunnerCount =
    predictionSnapshots.length;

  const componentRunnerCount =
    componentSnapshots.length;

  const componentByRunnerId = new Map<
    number,
    ResearchRunnerComponentSnapshot
  >();

  for (const componentSnapshot of componentSnapshots) {
    const runnerId = Number(
      componentSnapshot.runner_id,
    );

    if (
      Number.isFinite(runnerId) &&
      runnerId > 0 &&
      !componentByRunnerId.has(runnerId)
    ) {
      componentByRunnerId.set(
        runnerId,
        componentSnapshot,
      );
    }
  }

  const runners: ResearchBatchRunner[] =
    predictionSnapshots.map((prediction) => {
      const runnerId = Number(
        prediction.runner_id,
      );

      const component =
        componentByRunnerId.get(runnerId) || null;

      return {
        runnerId,

        horseId:
          prediction.horse_id !== null &&
          prediction.horse_id !== undefined
            ? Number(prediction.horse_id)
            : null,

        predictedRank:
          prediction.predicted_rank !== null &&
          prediction.predicted_rank !== undefined
            ? Number(prediction.predicted_rank)
            : null,

        prediction,
        component,

        hasComponentSnapshot:
          component !== null,
      };
    });
  const analysis =
    analyseResearchBatch({
      batch,
      predictionSnapshots,
      componentSnapshots,
    });
  const runnerCountMatches =
    expectedRunnerCount > 0 &&
    predictionRunnerCount ===
      expectedRunnerCount;

  const componentRunnerCountMatches =
    expectedRunnerCount > 0 &&
    componentRunnerCount ===
      expectedRunnerCount;

  const warnings: string[] = [];

  if (!classificationSnapshots.length) {
    warnings.push(
      "No classification snapshot was found for this batch.",
    );
  }

  if (!predictionSnapshots.length) {
    warnings.push(
      "No prediction runner snapshots were found for this batch.",
    );
  }

  if (!componentSnapshots.length) {
    warnings.push(
      "No runner component snapshots were found for this batch.",
    );
  }

  if (
    expectedRunnerCount > 0 &&
    predictionRunnerCount !==
      expectedRunnerCount
  ) {
    warnings.push(
      `The classification snapshot expected ${expectedRunnerCount} active runners, but ${predictionRunnerCount} prediction runners were captured.`,
    );
  }

  if (
    expectedRunnerCount > 0 &&
    componentRunnerCount !==
      expectedRunnerCount
  ) {
    warnings.push(
      `The classification snapshot expected ${expectedRunnerCount} active runners, but ${componentRunnerCount} component snapshots were captured.`,
    );
  }
  const runnersWithoutComponents =
    runners.filter(
      (runner) => !runner.hasComponentSnapshot,
    );

  if (runnersWithoutComponents.length > 0) {
    warnings.push(
      `${runnersWithoutComponents.length} prediction runner${
        runnersWithoutComponents.length === 1
          ? ""
          : "s"
      } could not be matched to a component snapshot.`,
    );
  }
  const raceIds = uniqueNumbers([
    ...classificationSnapshots.map(
      (row) => row.race_id,
    ),
    ...predictionSnapshots.map(
      (row) => row.race_id,
    ),
    ...componentSnapshots.map(
      (row) => row.race_id,
    ),
  ]);

  if (raceIds.length > 1) {
    warnings.push(
      "This batch contains snapshots from more than one race.",
    );
  }

  return {
    batch,

    classificationSnapshots,
    predictionSnapshots,
    componentSnapshots,

    runners,
    analysis,

    classificationCount:
      classificationSnapshots.length,

    predictionRunnerCount,
    componentRunnerCount,

    expectedRunnerCount,
    runnerCountMatches,
    componentRunnerCountMatches,

    warnings,
  };
}

export async function getResearchDashboard(): Promise<ResearchDashboard> {
  await requireResearchAdmin();

  const [
    health,
    statistics,
    recentBatches,
  ] = await Promise.all([
    getWarehouseHealth(),
    getSnapshotStatistics(),
    getRecentSnapshotBatches(20),
  ]);

  const latestBatch =
    recentBatches[0] || null;

  const latestRace = latestBatch
    ? [
        latestBatch.meetingName,
        latestBatch.raceNumber
          ? `R${latestBatch.raceNumber}`
          : null,
        latestBatch.raceName,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return {
    health,
    statistics,

    latestBatch,
    recentBatches,

    latestMeeting:
      latestBatch?.meetingName || null,

    latestRace:
      latestRace || null,

    latestSnapshotAt:
      latestBatch?.snapshotAt || null,

    scoringVersion:
      latestBatch?.scoringVersion || null,

    classifierVersion:
      latestBatch?.classifierVersion || null,
  };
}
