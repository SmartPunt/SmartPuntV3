import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { SMARTPUNT_SCORING_VERSION } from "@/lib/calculator/scoring";

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
  race?: RaceWithMeeting | null;
  horse?: { horse_name: string } | null;
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
};

function headers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration in environment variables.");
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

async function serviceSelect<T>(path: string): Promise<T[]> {
  const { supabaseUrl, headers: h } = headers();
  const separator = path.includes("?") ? "&" : "?";
  const pathWithLimit = `${path}${separator}limit=1000`;

  const response = await fetch(`${supabaseUrl}/rest/v1/${pathWithLimit}`, {
    method: "GET",
    headers: h,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Service role request failed for ${path}`);
  }

  return response.json();
}

async function serviceSelectAllRows<T>(path: string): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers: h } = headers();
    const separator = path.includes("?") ? "&" : "?";
    const pagedPath = `${path}${separator}limit=${pageSize}&offset=${offset}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${pagedPath}`, {
      method: "GET",
      headers: h,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Service role request failed for ${path}`);
    }

    const rows = (await response.json()) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
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
    `calculator_predictions?select=*&settled_at=not.is.null&finishing_position=not.is.null&scoring_version=eq.${encodeURIComponent(
      SMARTPUNT_SCORING_VERSION,
    )}&order=settled_at.desc`,
  );

  const raceIds = Array.from(new Set(predictions.map((row) => row.race_id).filter(Boolean)));
  const horseIds = Array.from(new Set(predictions.map((row) => row.horse_id).filter(Boolean)));

  const races = raceIds.length
    ? await serviceSelect<RaceRow>(
        `races?select=id,race_number,race_name,distance_m,meeting_id,status&id=in.(${raceIds.join(",")})`,
      )
    : [];

  const meetingIds = Array.from(new Set(races.map((row) => row.meeting_id).filter(Boolean)));

  const meetings = meetingIds.length
    ? await serviceSelect<MeetingRow>(
        `meetings?select=id,meeting_name,meeting_date,track_condition&id=in.(${meetingIds.join(",")})`,
      )
    : [];

  const horses = horseIds.length
    ? await serviceSelect<HorseRow>(`horses?select=id,horse_name&id=in.(${horseIds.join(",")})`)
    : [];

  const raceMap = new Map(races.map((row) => [Number(row.id), row]));
  const meetingMap = new Map(meetings.map((row) => [Number(row.id), row]));
  const horseMap = new Map(horses.map((row) => [Number(row.id), row]));

  return predictions.map((prediction) => {
    const race = raceMap.get(Number(prediction.race_id)) || null;
    const meeting = race ? meetingMap.get(Number(race.meeting_id)) || null : null;
    const horse = horseMap.get(Number(prediction.horse_id)) || null;

    return {
      ...prediction,
      race: race ? { ...race, meeting } : null,
      horse,
    };
  });
}

function buildCsv(rows: Prediction[]) {
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
    "scoring_version",
    "predicted_rank",
    "finishing_position",
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
    "predicted_at",
    "settled_at",
  ];

  const body = rows.map((row) => [
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
    row.scoring_version,
    row.rank,
    row.finishing_position ?? "",
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
    row.predicted_at,
    row.settled_at || "",
  ]);

  return [headers, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
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
      "Content-Disposition": `attachment; filename="smartpunt-calculator-report-${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
