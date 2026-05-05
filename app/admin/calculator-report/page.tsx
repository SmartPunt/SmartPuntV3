import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SMARTPUNT_SCORING_VERSION } from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";

type SearchValue = string | string[] | undefined;
type CalculatorReportSearchParams = Record<string, SearchValue>;

type Prediction = {
  id: number;
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

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
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

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toNumber(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isNaN(next) ? 0 : next;
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function isoDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function pastIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildQuery(params: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

function raceLabel(row: Prediction) {
  const meeting = row.race?.meeting?.meeting_name || "Meeting";
  const raceNumber = row.race?.race_number ? `R${row.race.race_number}` : "Race";
  return `${meeting} ${raceNumber} ${row.race?.race_name || ""}`.trim();
}

function groupByRace(rows: Prediction[]) {
  const map = new Map<number, Prediction[]>();

  rows.forEach((row) => {
    const existing = map.get(row.race_id) || [];
    existing.push(row);
    map.set(row.race_id, existing);
  });

  return Array.from(map.entries())
    .map(([raceId, raceRows]) => ({
      raceId,
      rows: raceRows.sort((a, b) => a.rank - b.rank
