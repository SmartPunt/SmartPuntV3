import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  SMARTPUNT_SCORING_VERSION,
  calculateRaceConfidence,
} from "@/lib/calculator/scoring";
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

type SmartPuntGeneratedTip = Prediction & {
  smartPuntSuggestedBet: string;
  smartPuntRaceConfidence: number;
  smartPuntConfidenceTier: string;
  smartPuntVolatility: string;
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

type RaceRunnerRow = {
  id: number;
  horse_id: number | null;
};

function headers() {
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

    if (rows.length < pageSize) break;

    offset += pageSize;
  }

  return allRows;
}

function chunkValues<T>(values: T[], size = 400) {
  const chunks: T[][] = [];

  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }

  return chunks;
}

async function serviceSelectByIdChunks<T>({
  table,
  select,
  ids,
}: {
  table: string;
  select: string;
  ids: Array<number | string>;
}): Promise<T[]> {
  const cleanIds = Array.from(
    new Set(
      ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  if (!cleanIds.length) return [];

  const rows: T[] = [];

  for (const chunk of chunkValues(cleanIds)) {
    const chunkRows = await serviceSelect<T>(
      `${table}?select=${select}&id=in.(${chunk.join(",")})`,
    );
    rows.push(...chunkRows);
  }

  return rows;
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

  const perthDate = new Date(
    date.toLocaleString("en-US", {
      timeZone: "Australia/Perth",
    }),
  );

  const year = perthDate.getFullYear();
  const month = String(perthDate.getMonth() + 1).padStart(2, "0");
  const day = String(perthDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getHorseName(row: Prediction) {
  return row.horse?.horse_name || "Unknown";
}

function raceLabel(row: Prediction) {
  const meeting = row.race?.meeting?.meeting_name || "Meeting";
  const raceNumber = row.race?.race_number
    ? `R${row.race.race_number}`
    : "Race";
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
      rows: raceRows.sort((a, b) => a.rank - b.rank),
      meetingDate: raceRows[0]?.race?.meeting?.meeting_date || "",
      label: raceLabel(raceRows[0]),
    }))
    .sort((a, b) => {
      const aTime = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const bTime = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.raceId - a.raceId;
    });
}

function getRaceConfidenceForRows(rows: Prediction[]) {
  return calculateRaceConfidence(
    rows.map((row) => ({
      score: toNumber(row.score),
      placePercent: row.place_percent,
    })),
  );
}

function getSmartPuntCalculatorTip(
  rows: Prediction[],
): SmartPuntGeneratedTip | null {
  if (!rows.length) return null;

  const topRated = rows.find((row) => row.rank === 1) || rows[0] || null;
  if (!topRated) return null;

  const raceConfidence = getRaceConfidenceForRows(rows);

  if (raceConfidence.suggestedBet === "No Bet") {
    return null;
  }

  return {
    ...topRated,
    smartPuntSuggestedBet: raceConfidence.suggestedBet,
    smartPuntRaceConfidence: raceConfidence.confidencePercent,
    smartPuntConfidenceTier: raceConfidence.tier,
    smartPuntVolatility: raceConfidence.volatility,
  };
}

function winner(rows: Prediction[]) {
  return rows.find((row) => row.finishing_position === 1) || null;
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

  const raceIds = Array.from(
    new Set(predictions.map((row) => row.race_id).filter(Boolean)),
  );
  const runnerIds = Array.from(
    new Set(predictions.map((row) => row.runner_id).filter(Boolean)),
  );

  const raceRunners = await serviceSelectByIdChunks<RaceRunnerRow>({
    table: "race_runners",
    select: "id,horse_id",
    ids: runnerIds,
  });

  const runnerMap = new Map(raceRunners.map((row) => [Number(row.id), row]));

  const horseIds = Array.from(
    new Set(
      predictions
        .flatMap((row) => [
          row.horse_id,
          runnerMap.get(Number(row.runner_id))?.horse_id,
        ])
        .filter(
          (id): id is number =>
            typeof id === "number" && Number.isFinite(id) && id > 0,
        ),
    ),
  );

  const [races, horses] = await Promise.all([
    serviceSelectByIdChunks<RaceRow>({
      table: "races",
      select: "id,race_number,race_name,distance_m,meeting_id,status",
      ids: raceIds,
    }),
    serviceSelectByIdChunks<HorseRow>({
      table: "horses",
      select: "id,horse_name",
      ids: horseIds,
    }),
  ]);

  const meetingIds = Array.from(
    new Set(races.map((row) => row.meeting_id).filter(Boolean)),
  );

  const meetings = await serviceSelectByIdChunks<MeetingRow>({
    table: "meetings",
    select: "id,meeting_name,meeting_date,track_condition",
    ids: meetingIds,
  });

  const raceMap = new Map(races.map((row) => [Number(row.id), row]));
  const meetingMap = new Map(meetings.map((row) => [Number(row.id), row]));
  const horseMap = new Map(horses.map((row) => [Number(row.id), row]));

  return predictions.map((prediction) => {
    const race = raceMap.get(Number(prediction.race_id)) || null;
    const meeting = race
      ? meetingMap.get(Number(race.meeting_id)) || null
      : null;
    const runner = runnerMap.get(Number(prediction.runner_id)) || null;
    const horse =
      horseMap.get(Number(prediction.horse_id)) ||
      horseMap.get(Number(runner?.horse_id)) ||
      null;

    return {
      ...prediction,
      race: race ? { ...race, meeting } : null,
      horse,
    };
  });
}

function StatCard({
  label,
  value,
  hint,
  tone = "amber",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "amber" | "green" | "blue" | "rose" | "slate";
}) {
  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {label}
            </p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
          <Badge tone={tone}>{label}</Badge>
        </div>
        <p className="mt-3 text-sm text-zinc-500">{hint}</p>
      </div>
    </Panel>
  );
}

export default async function CalculatorReportPage({
  searchParams,
}: {
  searchParams?: Promise<CalculatorReportSearchParams>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  const resolvedSearchParams: CalculatorReportSearchParams = searchParams
    ? await searchParams
    : {};
  const dateFrom = first(resolvedSearchParams.from);
  const dateTo = first(resolvedSearchParams.to);

  let predictions: Prediction[] = [];
  let errorMessage = "";

  try {
    const allPredictions = await fetchPredictions();
    predictions = filterByDate(allPredictions, dateFrom, dateTo);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error loading calculator report.";
  }

  const exportHref = `/admin/calculator-report/export${buildQuery({ from: dateFrom, to: dateTo })}`;

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
        <div className="mx-auto max-w-5xl">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h1 className="text-2xl font-bold">Calculator Report</h1>
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const raceGroups = groupByRace(predictions);
  const totalRaces = raceGroups.length;
  const totalRunners = predictions.length;
  const topRatedRows = raceGroups
    .map(
      (race) => race.rows.find((row) => row.rank === 1) || race.rows[0] || null,
    )
    .filter((row): row is Prediction => Boolean(row));

  const calculatorGeneratedTips = raceGroups
    .map((race) => getSmartPuntCalculatorTip(race.rows))
    .filter((row): row is SmartPuntGeneratedTip => Boolean(row));

  const calculatorNoBetRaces = Math.max(
    totalRaces - calculatorGeneratedTips.length,
    0,
  );

  const topRatedWins = topRatedRows.filter(
    (row) => row.finishing_position === 1,
  ).length;
  const topRatedPlaces = topRatedRows.filter(
    (row) => row.finishing_position !== null && row.finishing_position <= 3,
  ).length;

  const calculatorWinTips = calculatorGeneratedTips.filter((row) =>
    String(row.smartPuntSuggestedBet || "").toLowerCase().includes("win"),
  );
  const calculatorPlaceTips = calculatorGeneratedTips.filter((row) =>
    String(row.smartPuntSuggestedBet || "").toLowerCase().includes("place"),
  );

  const calculatorTipWins = calculatorWinTips.filter(
    (row) => row.won === true || row.finishing_position === 1,
  ).length;

  const calculatorTipPlaces = calculatorPlaceTips.filter(
    (row) =>
      row.placed === true ||
      (row.finishing_position !== null && row.finishing_position <= 3),
  ).length;

  const calculatorTipAvgConfidence = calculatorGeneratedTips.length
    ? Math.round(
        calculatorGeneratedTips.reduce(
          (sum, row) => sum + Number(row.smartPuntRaceConfidence || 0),
          0,
        ) / calculatorGeneratedTips.length,
      )
    : 0;

  const topThreeHitRaces = raceGroups.filter((race) =>
    race.rows.some((row) => row.rank <= 3 && row.finishing_position === 1),
  ).length;
  const winners = raceGroups
    .map((race) => winner(race.rows))
    .filter((row): row is Prediction => Boolean(row));
  const avgWinnerRank = winners.length
    ? (
        winners.reduce((sum, row) => sum + Number(row.rank || 0), 0) /
        winners.length
      ).toFixed(1)
    : "—";
  const avgWinnerScore = winners.length
    ? Math.round(
        winners.reduce((sum, row) => sum + toNumber(row.score), 0) /
          winners.length,
      )
    : "—";
  const strongestWinner =
    [...winners].sort((a, b) => toNumber(b.score) - toNumber(a.score))[0] ||
    null;
  const biggestMiss =
    [...topRatedRows]
      .filter(
        (row) => row.finishing_position !== null && row.finishing_position > 3,
      )
      .sort((a, b) => toNumber(b.score) - toNumber(a.score))[0] || null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.58)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Calculator Report</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/current-races"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Current Races
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
                <Link
                  href="/admin/calculator"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Calculator Lab
                </Link>
                {profile.role === "admin" ? (
                  <Link
                    href="/"
                    className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                  >
                    Back to Admin
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                SmartPunt calculator performance
              </h1>
              <p className="mt-2 text-sm text-zinc-200 lg:text-base">
                Daily and historical read on how the calculator is performing
                against final race results.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{totalRaces} races analysed</Badge>
                <Badge tone="blue">{totalRunners} runners analysed</Badge>
                <Badge tone="amber">Final field snapshots</Badge>
              </div>
            </div>
          </div>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Report controls</h2>
                <p className="text-sm text-zinc-500">
                  Filter by meeting date, then export the same range as CSV.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/calculator-report${buildQuery({ from: todayIso(), to: todayIso() })}`}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Today
                </Link>
                <Link
                  href={`/admin/calculator-report${buildQuery({ from: pastIso(7), to: todayIso() })}`}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Last 7 days
                </Link>
                <Link
                  href={`/admin/calculator-report${buildQuery({ from: pastIso(30), to: todayIso() })}`}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Last 30 days
                </Link>
                <Link
                  href="/admin/calculator-report"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  All history
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto_auto]">
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
              <form
                id="calculator-report-filter-form"
                className="contents"
                action="/admin/calculator-report"
              >
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Date from
                  </label>
                  <input
                    type="date"
                    name="from"
                    defaultValue={dateFrom}
                    className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Date to
                  </label>
                  <input
                    type="date"
                    name="to"
                    defaultValue={dateTo}
                    className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                  >
                    Apply Filter
                  </button>
                </div>
              </form>

              <div className="flex items-end">
                <a
                  href={exportHref}
                  download
                  className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Export CSV
                </a>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {dateFrom || dateTo ? (
                <Badge tone="blue">
                  Showing {dateFrom || "start"} to {dateTo || "today"}
                </Badge>
              ) : (
                <Badge tone="slate">Showing all settled predictions</Badge>
              )}
              <Badge tone="green">{totalRaces} races</Badge>
              <Badge tone="blue">{totalRunners} runners</Badge>
            </div>
          </div>
        </Panel>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Top win strike"
            value={`${percent(topRatedWins, topRatedRows.length)}%`}
            hint={`${topRatedWins}/${topRatedRows.length} top-rated runners won.`}
            tone="green"
          />
          <StatCard
            label="Top place strike"
            value={`${percent(topRatedPlaces, topRatedRows.length)}%`}
            hint={`${topRatedPlaces}/${topRatedRows.length} top-rated runners placed.`}
            tone="blue"
          />
          <StatCard
            label="Top 3 winner hit"
            value={`${percent(topThreeHitRaces, totalRaces)}%`}
            hint={`${topThreeHitRaces}/${totalRaces} winners were in the calculator top 3.`}
            tone="amber"
          />
          <StatCard
            label="Avg winner rank"
            value={avgWinnerRank}
            hint={`Average score of winners: ${avgWinnerScore}.`}
            tone="slate"
          />
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                SmartPunt calculator opportunities
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                Measures every calculator-generated opportunity from final
                settled prediction snapshots, whether or not it was published to
                subscribers.
              </p>
            </div>
            <Badge tone="amber">Report-only calculator reads</Badge>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tip win strike"
              value={`${percent(calculatorTipWins, calculatorWinTips.length)}%`}
              hint={`${calculatorTipWins}/${calculatorWinTips.length} calculator win opportunities won.`}
              tone="green"
            />
            <StatCard
              label="Tip place strike"
              value={`${percent(calculatorTipPlaces, calculatorPlaceTips.length)}%`}
              hint={`${calculatorTipPlaces}/${calculatorPlaceTips.length} calculator place opportunities placed.`}
              tone="blue"
            />
            <StatCard
              label="Tip volume"
              value={calculatorGeneratedTips.length}
              hint={`${calculatorGeneratedTips.length} calculator opportunities generated. ${calculatorNoBetRaces} races were No Bet.`}
              tone="amber"
            />
            <StatCard
              label="Avg race confidence"
              value={
                calculatorGeneratedTips.length
                  ? `${calculatorTipAvgConfidence}%`
                  : "—"
              }
              hint="Average race-confidence score across calculator-generated opportunities."
              tone="slate"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Best calculator result</h2>
              {strongestWinner ? (
                <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm text-zinc-600">
                    {raceLabel(strongestWinner)}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold">
                    {getHorseName(strongestWinner)}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="green">Won</Badge>
                    <Badge tone="amber">Rank #{strongestWinner.rank}</Badge>
                    <Badge tone="blue">
                      Score {Math.round(toNumber(strongestWinner.score))}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  No winning prediction data yet.
                </p>
              )}
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Biggest miss</h2>
              {biggestMiss ? (
                <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm text-zinc-600">
                    {raceLabel(biggestMiss)}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold">
                    {getHorseName(biggestMiss)}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="rose">
                      Finished {biggestMiss.finishing_position}
                    </Badge>
                    <Badge tone="amber">Rank #{biggestMiss.rank}</Badge>
                    <Badge tone="blue">
                      Score {Math.round(toNumber(biggestMiss.score))}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  No major misses recorded yet.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Race-by-race breakdown
                </h2>
                <p className="text-sm text-zinc-500">
                  Each race is collapsed by default. Open a race to view the
                  full runner table.
                </p>
              </div>
              <Badge tone="green">{totalRaces} races</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {raceGroups.length > 0 ? (
                raceGroups.map((race) => {
                  const topRated =
                    race.rows.find((row) => row.rank === 1) || race.rows[0];
                  const raceWinner = winner(race.rows);
                  const smartPuntTip = getSmartPuntCalculatorTip(race.rows);
                  const topThreeHadWinner = race.rows.some(
                    (row) => row.rank <= 3 && row.finishing_position === 1,
                  );

                  return (
                    <details
                      key={race.raceId}
                      className="group rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-zinc-500">
                              {formatDate(race.meetingDate)}
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-zinc-950">
                              <span className="mr-2 inline-block text-amber-700 transition group-open:rotate-90">
                                ▶
                              </span>
                              {race.label}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-600">
                              Top rated:{" "}
                              {topRated ? getHorseName(topRated) : "—"} ·
                              Winner:{" "}
                              {raceWinner ? getHorseName(raceWinner) : "—"}
                              {smartPuntTip
                                ? ` · Calculator opportunity: ${getHorseName(smartPuntTip)}`
                                : " · Calculator opportunity: No Bet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                topRated?.finishing_position === 1
                                  ? "green"
                                  : "amber"
                              }
                            >
                              Top:{" "}
                              {topRated?.finishing_position === 1
                                ? "Won"
                                : `Finished ${topRated?.finishing_position ?? "—"}`}
                            </Badge>
                            <Badge tone={topThreeHadWinner ? "green" : "rose"}>
                              Top 3 {topThreeHadWinner ? "hit" : "miss"}
                            </Badge>
                            <Badge tone="slate">
                              {race.rows.length} runners
                            </Badge>
                            {smartPuntTip ? (
                              <Badge
                                tone={
                                  smartPuntTip.finishing_position === 1
                                    ? "green"
                                    : smartPuntTip.finishing_position &&
                                        smartPuntTip.finishing_position <= 3
                                      ? "blue"
                                      : "rose"
                                }
                              >
                                SP {smartPuntTip.smartPuntSuggestedBet}:{" "}
                                {smartPuntTip.finishing_position === 1
                                  ? "Won"
                                  : smartPuntTip.finishing_position &&
                                      smartPuntTip.finishing_position <= 3
                                    ? "Placed"
                                    : `Finished ${smartPuntTip.finishing_position ?? "—"}`}
                              </Badge>
                            ) : (
                              <Badge tone="slate">SP No Bet</Badge>
                            )}
                          </div>
                        </div>
                      </summary>

                      <div className="mt-5 border-t border-zinc-200 pt-5">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Top rated
                            </p>
                            <p className="mt-2 font-bold text-zinc-950">
                              {topRated ? getHorseName(topRated) : "—"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Score {Math.round(toNumber(topRated?.score))} ·
                              Win {topRated?.win_percent ?? 0}% · Place{" "}
                              {topRated?.place_percent ?? 0}%
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              SmartPunt calculator opportunity
                            </p>
                            <p className="mt-2 font-bold text-zinc-950">
                              {smartPuntTip
                                ? getHorseName(smartPuntTip)
                                : "No Bet"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {smartPuntTip
                                ? `${smartPuntTip.smartPuntSuggestedBet} · Confidence ${smartPuntTip.smartPuntRaceConfidence}% · ${smartPuntTip.smartPuntConfidenceTier}`
                                : "Confidence layer did not find enough edge for a SmartPunt calculator opportunity."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Winner
                            </p>
                            <p className="mt-2 font-bold text-zinc-950">
                              {raceWinner ? getHorseName(raceWinner) : "—"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Calculator rank #{raceWinner?.rank ?? "—"} · Score{" "}
                              {raceWinner
                                ? Math.round(toNumber(raceWinner.score))
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[1060px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                <th className="py-3 pr-3">Rank</th>
                                <th className="py-3 pr-3">Horse</th>
                                <th className="py-3 pr-3">Score</th>
                                <th className="py-3 pr-3">Win %</th>
                                <th className="py-3 pr-3">Place %</th>
                                <th className="py-3 pr-3">Finished</th>
                                <th className="py-3 pr-3">Form</th>
                                <th className="py-3 pr-3">Distance</th>
                                <th className="py-3 pr-3">Track</th>
                                <th className="py-3 pr-3">Barrier</th>
                                <th className="py-3 pr-3">Weight</th>
                                <th className="py-3 pr-3">Jockey</th>
                              </tr>
                            </thead>
                            <tbody>
                              {race.rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-zinc-100 last:border-0"
                                >
                                  <td className="py-3 pr-3 font-semibold">
                                    #{row.rank}
                                  </td>
                                  <td className="py-3 pr-3 font-semibold text-zinc-950">
                                    {getHorseName(row)}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.score))}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {row.win_percent}%
                                  </td>
                                  <td className="py-3 pr-3">
                                    {row.place_percent}%
                                  </td>
                                  <td className="py-3 pr-3">
                                    <Badge
                                      tone={
                                        row.finishing_position === 1
                                          ? "green"
                                          : row.finishing_position &&
                                              row.finishing_position <= 3
                                            ? "blue"
                                            : "rose"
                                      }
                                    >
                                      {row.finishing_position ?? "—"}
                                    </Badge>
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(
                                      toNumber(row.recent_form_score),
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.distance_score))}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.track_score))}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.barrier_score))}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.weight_score))}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {Math.round(toNumber(row.jockey_score))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <p className="mt-3 text-xs text-zinc-500">
                          Snapshot settled:{" "}
                          {formatDateTime(race.rows[0]?.settled_at)}
                        </p>
                      </div>
                    </details>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">
                    No settled calculator predictions yet.
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Once races are published and then resulted, the calculator
                    report will fill in here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
