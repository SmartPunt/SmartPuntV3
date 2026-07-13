import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  calculateRaceConfidence,
  getCalculatorTipThresholds,
  getQualifiedCalculatorTip,
} from "@/lib/calculator/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditSection = {
  label?: string;
  score?: number | string;
  status?: string;
  summary?: string;
  details?: string[];
  decisionLog?: string[];
};

type ScoringAudit = {
  overall?: {
    score?: number | string;
    baseScore?: number | string;
    standoutBonus?: number | string;
    powerAdjustment?: number | string;
    overconfidenceDampenerApplied?: boolean;
  };
  sections?: {
    recentForm?: AuditSection;
    distance?: AuditSection;
    track?: AuditSection;
    condition?: AuditSection;
    barrier?: AuditSection;
    weight?: AuditSection;
    jockey?: AuditSection;
    trainer?: AuditSection;
    consistency?: AuditSection;
    power?: AuditSection;
  };
  decisionLog?: string[];
  version?: string;
};

type Prediction = {
  race_id: number;
  runner_id: number;
  horse_id: number;
  scoring_version: string;
  score: number | string;
  rank: number;
  win_percent: number;
  place_percent: number;
  recent_form_score: number | string;
  distance_score: number | string;
  track_score: number | string;
  condition_score: number | string;
  barrier_score: number | string;
  weight_score: number | string;
  jockey_score: number | string;
  trainer_score: number | string;
  predicted_at: string;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  race_gap: number | string | null;
  race_confidence_tier: string | null;
  race_confidence_percent: number | string | null;
  suggested_bet: string | null;
  is_smartpunt_tip?: boolean | null;
  smartpunt_tip_type?: string | null;
  audit_json?: ScoringAudit | null;
  scoring_audit?: ScoringAudit | null;
  race?: RaceWithMeeting | null;
  runner?: RaceRunnerRow | null;
  horse?: HorseRow | null;
};

type RaceRow = {
  id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  meeting_id: number;
  status: string;
  place_terms?: string | null;
};

type MeetingRow = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type RaceWithMeeting = RaceRow & {
  meeting?: MeetingRow | null;
};

type HorseRow = {
  id: number;
  horse_name: string;
  smartpunt_power_rating: number | null;
  smartpunt_class_rating: number | null;
  good_track_record: string | null;
  soft_track_record: string | null;
  heavy_track_record: string | null;
  synthetic_track_record: string | null;
};

type RaceRunnerRow = {
  id: number;
  horse_id: number | null;
  runner_number?: number | null;
  scratched?: boolean | null;
  barrier: number | null;
  weight_kg: number | null;
  apprentice_claim_kg: number | null;
  jockey_name: string | null;
  trainer_name: string | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  finishing_position: number | null;
  starting_price: number | null;
  won: boolean | null;
  placed: boolean | null;
};

function getServiceConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
}

async function serviceSelectAllRows<T>(path: string): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers } = getServiceConfig();
    const separator = path.includes("?") ? "&" : "?";
    const pagedPath = `${path}${separator}limit=${pageSize}&offset=${offset}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${pagedPath}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Service role request failed for ${path}`);
    }

    const rows = (await response.json()) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) break;

    offset += pageSize;
  }

  return allRows;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function serviceSelectByIds<T>({
  table,
  select,
  ids,
}: {
  table: string;
  select: string;
  ids: number[];
}): Promise<T[]> {
  const cleanIds = Array.from(new Set(ids.map(Number).filter(Boolean)));

  if (!cleanIds.length) return [];

  const rows: T[] = [];

  for (const idChunk of chunk(cleanIds, 200)) {
    rows.push(
      ...(await serviceSelectAllRows<T>(
        `${table}?select=${select}&id=in.(${idChunk.join(",")})`,
      )),
    );
  }

  return rows;
}

function isoDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function filterByDate(rows: Prediction[], from: string, to: string) {
  return rows.filter((row) => {
    const meetingDate = isoDate(row.race?.meeting?.meeting_date);

    if (!meetingDate) return true;
    if (from && meetingDate < from) return false;
    if (to && meetingDate > to) return false;

    return true;
  });
}

async function fetchPredictions() {
  const predictions = await serviceSelectAllRows<Prediction>(
    "calculator_predictions?select=*&settled_at=not.is.null&finishing_position=not.is.null&order=settled_at.desc",
  );

  const raceIds = predictions.map((row) => Number(row.race_id)).filter(Boolean);
  const runnerIds = predictions.map((row) => Number(row.runner_id)).filter(Boolean);

  const races = await serviceSelectByIds<RaceRow>({
    table: "races",
    select: "id,race_number,race_name,distance_m,meeting_id,status,place_terms",
    ids: raceIds,
  });

  const meetingIds = races.map((row) => Number(row.meeting_id)).filter(Boolean);

  const meetings = await serviceSelectByIds<MeetingRow>({
    table: "meetings",
    select: "id,meeting_name,meeting_date,track_condition",
    ids: meetingIds,
  });

  const raceRunners = await serviceSelectByIds<RaceRunnerRow>({
    table: "race_runners",
    select:
      "id,horse_id,runner_number,scratched,barrier,weight_kg,apprentice_claim_kg,jockey_name,trainer_name,form_last_6,track_form_last_6,distance_form_last_6,finishing_position,starting_price,won,placed",
    ids: runnerIds,
  });

  const resolvedHorseIds = raceRunners
    .map((row) => Number(row.horse_id))
    .filter(Boolean);

  const horses = await serviceSelectByIds<HorseRow>({
    table: "horses",
    select:
      "id,horse_name,smartpunt_power_rating,smartpunt_class_rating,good_track_record,soft_track_record,heavy_track_record,synthetic_track_record",
    ids: resolvedHorseIds,
  });

  const raceMap = new Map(races.map((row) => [Number(row.id), row]));
  const meetingMap = new Map(meetings.map((row) => [Number(row.id), row]));
  const runnerMap = new Map(raceRunners.map((row) => [Number(row.id), row]));
  const horseMap = new Map(horses.map((row) => [Number(row.id), row]));

  return predictions.map((prediction) => {
    const race = raceMap.get(Number(prediction.race_id)) || null;
    const meeting = race ? meetingMap.get(Number(race.meeting_id)) || null : null;
    const runner = runnerMap.get(Number(prediction.runner_id)) || null;

    const horse =
      horseMap.get(Number(prediction.horse_id)) ||
      (runner?.horse_id ? horseMap.get(Number(runner.horse_id)) || null : null);

    return {
      ...prediction,
      race: race ? { ...race, meeting } : null,
      runner,
      horse,
    };
  });
}

function groupByRace(rows: Prediction[]) {
  const map = new Map<number, Prediction[]>();

  rows.forEach((row) => {
    const existing = map.get(row.race_id) || [];
    existing.push(row);
    map.set(row.race_id, existing);
  });

  return map;
}


function normaliseAuditStatus(value?: string | null) {
  if (!value) return "";

  if (value === "positive") return "Positive";
  if (value === "neutral") return "Neutral";
  if (value === "risk") return "Risk";
  if (value === "fallback") return "Fallback";

  return value;
}

function getScoringAudit(row: Prediction) {
  return row.audit_json || row.scoring_audit || null;
}

function auditSection(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return getScoringAudit(row)?.sections?.[section] || null;
}

function auditStatus(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return normaliseAuditStatus(auditSection(row, section)?.status || "");
}

function auditDetails(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return auditSection(row, section)?.details || [];
}

function auditSummary(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return auditSection(row, section)?.summary || "";
}

function auditDecisionLog(row: Prediction) {
  return getScoringAudit(row)?.decisionLog?.join(" | ") || "";
}

function firstRunCountFromText(values: string[]) {
  for (const value of values) {
    const match = value.match(/(\d+)\s+runs?/i);
    if (match) return match[1];
  }

  return "";
}

function sectionRunCount(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return firstRunCountFromText(auditDetails(row, section));
}

function isUnknownEvidence(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  const status = auditStatus(row, section).toLowerCase();
  const summary = auditSummary(row, section).toLowerCase();
  const details = auditDetails(row, section).join(" ").toLowerCase();
  const runCount = sectionRunCount(row, section);

  return (
    (status === "neutral" && summary.includes("no exact")) ||
    (status === "neutral" && runCount === "0") ||
    details.includes("neutral score applied")
  );
}

function buildReviewReasons(row: Prediction) {
  const reasons: string[] = [];
  const totalScore = Number(row.score || 0);
  const finish = Number(row.finishing_position || row.runner?.finishing_position || 0);

  if (totalScore >= 75 && finish > 6) {
    reasons.push("High-rated miss");
  }

  if (finish === 1 && totalScore > 0 && totalScore < 60) {
    reasons.push("Underrated winner");
  }

  if (isUnknownEvidence(row, "track") && Number(row.track_score || 0) > 50) {
    reasons.push("Track unknown but scored above neutral");
  }

  if (isUnknownEvidence(row, "distance") && Number(row.distance_score || 0) > 50) {
    reasons.push("Distance unknown but scored above neutral");
  }

  const jockeyDetails = auditDetails(row, "jockey").join(" ").toLowerCase();
  if (Number(row.jockey_score || 0) >= 70 && jockeyDetails.includes("0 runs")) {
    reasons.push("High jockey score with no horse/jockey history");
  }

  const trainerDetails = auditDetails(row, "trainer").join(" ").toLowerCase();
  if (Number(row.trainer_score || 0) >= 60 && trainerDetails.includes("0 wins")) {
    reasons.push("High trainer score with no trainer wins");
  }

  return reasons;
}

function needsReview(row: Prediction) {
  return buildReviewReasons(row).length ? "YES" : "NO";
}

function reviewReason(row: Prediction) {
  return buildReviewReasons(row).join(" | ");
}


function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function dayOfWeek(value?: string | null) {
  const dateValue = isoDate(value);
  if (!dateValue) return "";

  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}

function median(values: number[]) {
  const clean = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!clean.length) return 0;

  const middle = Math.floor(clean.length / 2);

  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2;
}

function placeLimit(placeTerms?: string | null) {
  if (placeTerms === "win_only") return 1;
  if (placeTerms === "top_2") return 2;
  return 3;
}

function raceAuditMetrics(raceRows: Prediction[]) {
  const ranked = [...raceRows].sort((a, b) => Number(a.rank) - Number(b.rank));
  const scores = ranked.map((row) => toNumber(row.score));
  const top = ranked[0] || null;
  const second = ranked[1] || null;
  const third = ranked[2] || null;
  const fourth = ranked[3] || null;

  const topScore = top ? toNumber(top.score) : 0;
  const secondScore = second ? toNumber(second.score) : 0;
  const thirdScore = third ? toNumber(third.score) : 0;
  const fourthScore = fourth ? toNumber(fourth.score) : 0;
  const gap = top && second ? Math.round(topScore - secondScore) : 0;
  const topFourSpread = top && fourth ? Math.round(topScore - fourthScore) : gap;
  const topFourAverage = ranked.length
    ? Number(
        (
          ranked
            .slice(0, 4)
            .reduce((sum, row) => sum + toNumber(row.score), 0) /
          Math.min(ranked.length, 4)
        ).toFixed(2),
      )
    : 0;

  const race = top?.race || null;
  const meeting = race?.meeting || null;
  const trackCondition = String(meeting?.track_condition || "").toLowerCase();
  const raceName = String(race?.race_name || "").toLowerCase();
  const placeTerms = String(race?.place_terms || "top_3");

  const confidence = calculateRaceConfidence(
    ranked.map((row) => ({
      score: toNumber(row.score),
      placePercent: toNumber(row.place_percent),
    })),
    {
      trackCondition: meeting?.track_condition || null,
      raceName: race?.race_name || null,
      placeTerms,
    },
  );

  const baseConfidence = 30;
  const topScoreBoost = Math.max(
    0,
    Math.min(18, Math.round((topScore - 58) * 0.9)),
  );
  const gapBoost = Math.max(0, Math.min(18, gap * 3));
  const topPlacePercent = top ? toNumber(top.place_percent) : 0;
  const placeBoost = Math.max(
    0,
    Math.min(8, Math.round((topPlacePercent - 30) * 0.35)),
  );
  const compressionPenalty =
    ranked.length >= 4 && topFourSpread <= 3
      ? 22
      : ranked.length >= 4 && topFourSpread <= 5
        ? 12
        : ranked.length >= 4 && topFourSpread <= 7
          ? 6
          : 0;
  const fieldSizeAdjustment =
    ranked.length <= 7
      ? 4
      : ranked.length >= 14
        ? -12
        : ranked.length >= 11
          ? -6
          : 0;
  const conditionPenalty = trackCondition.startsWith("heavy")
    ? 14
    : trackCondition.startsWith("soft")
      ? 5
      : 0;
  const placeTermsPenalty =
    placeTerms === "win_only" ? 10 : placeTerms === "top_2" ? 5 : 0;
  const maidenPenalty =
    raceName.includes("maiden") || /\bmdn\b/i.test(raceName) ? 10 : 0;

  const qualifiedTip = getQualifiedCalculatorTip(ranked, {
    trackCondition: meeting?.track_condition || null,
    raceName: race?.race_name || null,
    placeTerms,
  });

  const thresholds = getCalculatorTipThresholds(confidence, {
    trackCondition: meeting?.track_condition || null,
    placeTerms,
  });

  const storedTip =
    ranked.find((row) => row.is_smartpunt_tip === true) || null;
  const storedTipType = String(
    storedTip?.smartpunt_tip_type || storedTip?.suggested_bet || "",
  ).trim();

  let qualificationFailureReason = "";

  if (!qualifiedTip) {
    if (confidence.tier === "Low") {
      qualificationFailureReason = "Low race confidence";
    } else if (!top) {
      qualificationFailureReason = "No scored runners";
    } else {
      const winFailures: string[] = [];
      if (thresholds.minWinScore === null) {
        winFailures.push("win score threshold unavailable");
      } else if (topScore < thresholds.minWinScore) {
        winFailures.push(`win score below ${thresholds.minWinScore}`);
      }
      if (gap < thresholds.minWinGap) {
        winFailures.push(`win gap below ${thresholds.minWinGap}`);
      }
      if (toNumber(top.win_percent) < thresholds.minWinPercent) {
        winFailures.push(`win percent below ${thresholds.minWinPercent}`);
      }

      const placeFailures: string[] = [];
      if (!thresholds.placeBettingAllowed) {
        placeFailures.push("place betting disabled");
      }
      if (
        thresholds.minPlaceScore !== null &&
        topScore < thresholds.minPlaceScore
      ) {
        placeFailures.push(`place score below ${thresholds.minPlaceScore}`);
      }
      if (toNumber(top.place_percent) < thresholds.minPlacePercent) {
        placeFailures.push(`place percent below ${thresholds.minPlacePercent}`);
      }
      if (gap < thresholds.minPlaceGap) {
        placeFailures.push(`place gap below ${thresholds.minPlaceGap}`);
      }

      qualificationFailureReason = [
        winFailures.length ? `Win: ${winFailures.join("; ")}` : "",
        placeFailures.length ? `Place: ${placeFailures.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    }
  }

  return {
    fieldSize: ranked.length,
    topScore,
    secondScore,
    thirdScore,
    fourthScore,
    gap,
    topFourSpread,
    topFourAverage,
    averageScore: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : 0,
    medianScore: Number(median(scores).toFixed(2)),
    minScore: scores.length ? Math.min(...scores) : 0,
    maxScore: scores.length ? Math.max(...scores) : 0,
    confidence,
    baseConfidence,
    topScoreBoost,
    gapBoost,
    placeBoost,
    compressionPenalty,
    fieldSizeAdjustment,
    conditionPenalty,
    placeTermsPenalty,
    maidenPenalty,
    isMaiden: maidenPenalty > 0,
    qualifiedTip,
    qualificationFailureReason,
    storedTip,
    storedTipType,
  };
}

function buildCsv(rows: Prediction[]) {
  const grouped = groupByRace(rows);

  const headers = [
    "meeting_date",
    "day_of_week",
    "is_weekend",
    "meeting_name",
    "track_condition",
    "race_id",
    "race_number",
    "race_name",
    "distance_m",
    "race_status",
    "place_terms",
    "field_size",

    "runner_id",
    "runner_number",
    "horse_id",
    "horse_name",
    "scratched",
    "barrier",
    "weight_kg",
    "apprentice_claim_kg",
    "jockey_name",
    "trainer_name",
    "form_last_6",
    "track_form_last_6",
    "distance_form_last_6",

    "good_track_record",
    "soft_track_record",
    "heavy_track_record",
    "synthetic_track_record",

    "smartpunt_power_rating",
    "smartpunt_class_rating",
    "power_rating_rank",

    "scoring_version",
    "predicted_rank",
    "finishing_position",
    "actual_finish",
    "starting_price",
    "won",
    "placed",

    "total_score",
    "win_percent",
    "place_percent",
    "recent_form_score",
    "distance_score",
    "track_score",
    "condition_score",
    "barrier_score",
    "weight_score",
    "jockey_score",
    "trainer_score",

    "form_status",
    "track_status",
    "distance_status",
    "condition_status",
    "jockey_status",
    "trainer_status",
    "consistency_status",
    "power_status",

    "form_history_runs",
    "track_history_runs",
    "distance_history_runs",
    "condition_history_runs",
    "jockey_history_runs",
    "trainer_history_runs",

    "track_unknown",
    "distance_unknown",
    "condition_unknown",
    "needs_review",
    "review_reason",
    "audit_decision_log",
    "full_scoring_audit_json",

    "race_top_score",
    "race_second_score",
    "race_third_score",
    "race_fourth_score",
    "race_average_score",
    "race_median_score",
    "race_min_score",
    "race_max_score",
    "race_gap",
    "top_four_spread",
    "top_four_average",
    "race_volatility",

    "race_confidence_tier",
    "race_confidence_percent",
    "confidence_base",
    "confidence_top_score_boost",
    "confidence_gap_boost",
    "confidence_place_boost",
    "confidence_compression_penalty",
    "confidence_field_size_adjustment",
    "confidence_condition_penalty",
    "confidence_place_terms_penalty",
    "confidence_maiden_penalty",
    "is_maiden",
    "race_suggested_bet",

    "is_smartpunt_tip",
    "smartpunt_tip_type",
    "tip_horse",
    "tip_runner_id",
    "tip_finishing_position",
    "tip_success",
    "qualified_tip_type",
    "qualified_tip_runner_id",
    "qualified_as_strong_win",
    "qualified_as_strong_place",
    "qualification_failure_reason",
    "no_bet_race",

    "winner_rank",
    "winner_power_rating",
    "winner_power_rating_rank",
    "winner_in_top_3",
    "winner_in_top_5",
    "winner_in_top_10",

    "predicted_at",
    "settled_at",
  ];

  const body = rows.map((row) => {
    const raceRows = grouped.get(row.race_id) || [];
    const metrics = raceAuditMetrics(raceRows);
    const race = row.race;
    const meeting = race?.meeting;
    const meetingDay = dayOfWeek(meeting?.meeting_date);
    const isWeekend = meetingDay === "Saturday" || meetingDay === "Sunday";

    const winnerRow =
      raceRows.find((runner) => runner.finishing_position === 1) || null;
    const winnerRank = winnerRow?.rank ?? "";

    const powerRankedRows = [...raceRows]
      .filter((runner) => Number(runner.horse?.smartpunt_power_rating || 0) > 0)
      .sort(
        (a, b) =>
          Number(b.horse?.smartpunt_power_rating || 0) -
          Number(a.horse?.smartpunt_power_rating || 0),
      );

    const powerRankByHorseId = new Map<number, number>();
    powerRankedRows.forEach((runner, index) => {
      powerRankByHorseId.set(Number(runner.horse_id), index + 1);
    });

    const powerRatingRank = powerRankByHorseId.get(Number(row.horse_id)) || "";
    const winnerPowerRating = winnerRow?.horse?.smartpunt_power_rating ?? "";
    const winnerPowerRatingRank = winnerRow
      ? powerRankByHorseId.get(Number(winnerRow.horse_id)) || ""
      : "";

    const storedTip = metrics.storedTip;
    const storedTipType = metrics.storedTipType;
    const tipFinish =
      storedTip?.finishing_position !== null &&
      storedTip?.finishing_position !== undefined
        ? Number(storedTip.finishing_position)
        : null;
    const tipSuccess =
      tipFinish === null
        ? ""
        : storedTipType.toLowerCase().includes("place")
          ? tipFinish <= placeLimit(race?.place_terms)
            ? "YES"
            : "NO"
          : tipFinish === 1
            ? "YES"
            : "NO";

    const qualifiedTip = metrics.qualifiedTip;

    return [
      meeting?.meeting_date || "",
      meetingDay,
      isWeekend ? "YES" : "NO",
      meeting?.meeting_name || "",
      meeting?.track_condition || "",
      row.race_id,
      race?.race_number || "",
      race?.race_name || "",
      race?.distance_m || "",
      race?.status || "",
      race?.place_terms || "top_3",
      metrics.fieldSize,

      row.runner_id,
      row.runner?.runner_number ?? "",
      row.horse_id,
      row.horse?.horse_name || "",
      row.runner?.scratched ? "YES" : "NO",
      row.runner?.barrier ?? "",
      row.runner?.weight_kg ?? "",
      row.runner?.apprentice_claim_kg ?? "",
      row.runner?.jockey_name || "",
      row.runner?.trainer_name || "",
      row.runner?.form_last_6 || "",
      row.runner?.track_form_last_6 || "",
      row.runner?.distance_form_last_6 || "",

      row.horse?.good_track_record || "",
      row.horse?.soft_track_record || "",
      row.horse?.heavy_track_record || "",
      row.horse?.synthetic_track_record || "",

      row.horse?.smartpunt_power_rating ?? "",
      row.horse?.smartpunt_class_rating ?? "",
      powerRatingRank,

      row.scoring_version,
      row.rank,
      row.finishing_position ?? "",
      row.runner?.finishing_position ?? row.finishing_position ?? "",
      row.runner?.starting_price ?? "",
      row.won ?? "",
      row.placed ?? "",

      row.score,
      row.win_percent,
      row.place_percent,
      row.recent_form_score,
      row.distance_score,
      row.track_score,
      row.condition_score,
      row.barrier_score,
      row.weight_score,
      row.jockey_score,
      row.trainer_score,

      auditStatus(row, "recentForm"),
      auditStatus(row, "track"),
      auditStatus(row, "distance"),
      auditStatus(row, "condition"),
      auditStatus(row, "jockey"),
      auditStatus(row, "trainer"),
      auditStatus(row, "consistency"),
      auditStatus(row, "power"),

      sectionRunCount(row, "recentForm"),
      sectionRunCount(row, "track"),
      sectionRunCount(row, "distance"),
      sectionRunCount(row, "condition"),
      sectionRunCount(row, "jockey"),
      sectionRunCount(row, "trainer"),

      isUnknownEvidence(row, "track") ? "YES" : "NO",
      isUnknownEvidence(row, "distance") ? "YES" : "NO",
      isUnknownEvidence(row, "condition") ? "YES" : "NO",
      needsReview(row),
      reviewReason(row),
      auditDecisionLog(row),
      JSON.stringify(getScoringAudit(row) || {}),

      metrics.topScore,
      metrics.secondScore,
      metrics.thirdScore,
      metrics.fourthScore,
      metrics.averageScore,
      metrics.medianScore,
      metrics.minScore,
      metrics.maxScore,
      metrics.gap,
      metrics.topFourSpread,
      metrics.topFourAverage,
      metrics.confidence.volatility,

      metrics.confidence.tier,
      metrics.confidence.confidencePercent,
      metrics.baseConfidence,
      metrics.topScoreBoost,
      metrics.gapBoost,
      metrics.placeBoost,
      metrics.compressionPenalty,
      metrics.fieldSizeAdjustment,
      metrics.conditionPenalty,
      metrics.placeTermsPenalty,
      metrics.maidenPenalty,
      metrics.isMaiden ? "YES" : "NO",
      metrics.confidence.suggestedBet,

      row.is_smartpunt_tip === true ? "YES" : "NO",
      row.smartpunt_tip_type || "",
      storedTip?.horse?.horse_name || "",
      storedTip?.runner_id || "",
      tipFinish ?? "",
      tipSuccess,
      qualifiedTip?.type || "",
qualifiedTip
  ? Number(qualifiedTip.runner.runner_id ?? 0) || ""
  : "",
      qualifiedTip?.qualifiesAsStrongWin ? "YES" : "NO",
      qualifiedTip?.qualifiesAsStrongPlace ? "YES" : "NO",
      metrics.qualificationFailureReason,
      qualifiedTip ? "NO" : "YES",

      winnerRank,
      winnerPowerRating,
      winnerPowerRatingRank,
      winnerRank !== "" && Number(winnerRank) <= 3 ? "YES" : "NO",
      winnerRank !== "" && Number(winnerRank) <= 5 ? "YES" : "NO",
      winnerRank !== "" && Number(winnerRank) <= 10 ? "YES" : "NO",

      row.predicted_at,
      row.settled_at || "",
    ];
  });

  return [headers, ...body]
    .map((csvRow) => csvRow.map(csvCell).join(","))
    .join("\n");
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();

    if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";

    const rows = filterByDate(await fetchPredictions(), from, to);
    const csv = buildCsv(rows);
    const suffix = from || to ? `${from || "start"}_to_${to || "today"}` : "all_history";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smartpunt-master-audit-${suffix}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export calculator report.",
      },
      { status: 500 },
    );
  }
}
