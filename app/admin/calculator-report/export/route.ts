import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

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
    select: "id,race_number,race_name,distance_m,meeting_id,status",
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
      "id,horse_id,barrier,weight_kg,apprentice_claim_kg,jockey_name,trainer_name,form_last_6,track_form_last_6,distance_form_last_6,finishing_position,starting_price,won,placed",
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

function auditSection(
  row: Prediction,
  section: keyof NonNullable<ScoringAudit["sections"]>,
) {
  return row.scoring_audit?.sections?.[section] || null;
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
  return row.scoring_audit?.decisionLog?.join(" | ") || "";
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

function buildCsv(rows: Prediction[]) {
  const raceMap = groupByRace(rows);

  const headers = [
    "meeting_date",
    "meeting_name",
    "track_condition",
    "race_id",
    "race_number",
    "race_name",
    "distance_m",

    "runner_id",
    "horse_id",
    "horse_name",

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

    "race_gap",
    "race_confidence_tier",
    "race_confidence_percent",
    "suggested_bet",

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
    const raceRows = raceMap.get(row.race_id) || [];

    const winnerRow =
      raceRows.find((runner) => runner.finishing_position === 1) || null;

    const winnerRank = winnerRow?.rank ?? "";

    const powerRankedRows = [...raceRows].sort((a, b) => {
      const aRating = Number(a.horse?.smartpunt_power_rating || 0);
      const bRating = Number(b.horse?.smartpunt_power_rating || 0);

      return bRating - aRating;
    });

    const powerRankByHorseId = new Map<number, number>();

    powerRankedRows.forEach((runner, index) => {
      powerRankByHorseId.set(Number(runner.horse_id), index + 1);
    });

    const powerRatingRank = powerRankByHorseId.get(Number(row.horse_id)) || "";
    const winnerPowerRating = winnerRow?.horse?.smartpunt_power_rating ?? "";
    const winnerPowerRatingRank = winnerRow
      ? powerRankByHorseId.get(Number(winnerRow.horse_id)) || ""
      : "";

    return [
      row.race?.meeting?.meeting_date || "",
      row.race?.meeting?.meeting_name || "",
      row.race?.meeting?.track_condition || "",
      row.race_id,
      row.race?.race_number || "",
      row.race?.race_name || "",
      row.race?.distance_m || "",

      row.runner_id,
      row.horse_id,
      row.horse?.horse_name || "",

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

      row.race_gap ?? "",
      row.race_confidence_tier ?? "",
      row.race_confidence_percent ?? "",
      row.suggested_bet ?? "",

      winnerRank,
      winnerPowerRating,
      winnerPowerRatingRank,
      winnerRank !== "" && winnerRank <= 3 ? "YES" : "NO",
      winnerRank !== "" && winnerRank <= 5 ? "YES" : "NO",
      winnerRank !== "" && winnerRank <= 10 ? "YES" : "NO",

      row.predicted_at,
      row.settled_at || "",
    ];
  });

  return [headers, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
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
        "Content-Disposition": `attachment; filename="smartpunt-calculator-forensic-${suffix}.csv"`,
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
