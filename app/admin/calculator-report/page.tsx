import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  SMARTPUNT_SCORING_VERSION,
  calculateRaceConfidence,
} from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";
import PowerRatingDryRunPanel from "@/components/power-rating-dry-run-panel";
import { loadCalculatorReportResultsAction } from "@/lib/actions";

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
    is_smartpunt_tip?: boolean | null;
  smartpunt_tip_type?: string | null;
  race_confidence_percent?: number | string | null;
  race_confidence_tier?: string | null;
  suggested_bet?: string | null;
  race?: RaceWithMeeting | null;
horse?: {
  horse_name: string;
  smartpunt_power_rating: number | null;
} | null;
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
  const storedTip = rows.find((row) => row.is_smartpunt_tip === true);

  if (!storedTip) return null;

  return {
    ...storedTip,
    smartPuntSuggestedBet: storedTip.smartpunt_tip_type || "Tip",
    smartPuntRaceConfidence: Number(storedTip.race_confidence_percent || 0),
    smartPuntConfidenceTier: storedTip.race_confidence_tier || "",
    smartPuntVolatility: storedTip.suggested_bet || "",
  };
}

function winner(rows: Prediction[]) {
  return rows.find((row) => row.finishing_position === 1) || null;
}
function getPowerRating(row: Prediction) {
  return Number(row.horse?.smartpunt_power_rating || 0);
}

function getPowerRank(row: Prediction, raceRows: Prediction[]) {
  if (!row.horse?.smartpunt_power_rating) return null;

  const ranked = [...raceRows]
    .filter((runner) => runner.horse?.smartpunt_power_rating)
    .sort((a, b) => getPowerRating(b) - getPowerRating(a));

  const index = ranked.findIndex(
    (runner) => Number(runner.horse_id) === Number(row.horse_id),
  );

  return index >= 0 ? index + 1 : null;
}


type AuditComponentKey =
  | "recent_form_score"
  | "distance_score"
  | "track_score"
  | "condition_score"
  | "barrier_score"
  | "weight_score"
  | "jockey_score"
  | "trainer_score";

type AuditComponent = {
  key: AuditComponentKey;
  label: string;
};

const AUDIT_COMPONENTS: AuditComponent[] = [
  { key: "recent_form_score", label: "Recent Form" },
  { key: "distance_score", label: "Distance" },
  { key: "track_score", label: "Track" },
  { key: "condition_score", label: "Condition" },
  { key: "barrier_score", label: "Barrier" },
  { key: "weight_score", label: "Weight" },
  { key: "jockey_score", label: "Jockey" },
  { key: "trainer_score", label: "Trainer" },
];

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function roundedAverage(values: number[]) {
  const avg = average(values);
  return avg ? Math.round(avg) : 0;
}

function getComponentValue(row: Prediction, key: AuditComponentKey) {
  return toNumber(row[key]);
}

function getComponentTone(separation: number): "green" | "amber" | "rose" | "slate" {
  if (separation >= 6) return "green";
  if (separation >= 3) return "amber";
  if (separation <= -2) return "rose";
  return "slate";
}

function getComponentHealthLabel(separation: number) {
  if (separation >= 6) return "Strong separation";
  if (separation >= 3) return "Useful signal";
  if (separation <= -2) return "Review";
  return "Neutral";
}

function buildScoringAuditSummary(rows: Prediction[], raceGroups: ReturnType<typeof groupByRace>) {
  const winners = rows.filter((row) => row.finishing_position === 1);
  const nonWinners = rows.filter((row) => row.finishing_position !== 1);

  const componentSummaries = AUDIT_COMPONENTS.map((component) => {
    const winnerAverage = roundedAverage(
      winners.map((row) => getComponentValue(row, component.key)),
    );
    const fieldAverage = roundedAverage(
      rows.map((row) => getComponentValue(row, component.key)),
    );
    const nonWinnerAverage = roundedAverage(
      nonWinners.map((row) => getComponentValue(row, component.key)),
    );
    const separation = winnerAverage - nonWinnerAverage;

    return {
      ...component,
      winnerAverage,
      fieldAverage,
      nonWinnerAverage,
      separation,
      tone: getComponentTone(separation),
      health: getComponentHealthLabel(separation),
    };
  });

  const unknownTrackRows = rows.filter((row) => Math.round(getComponentValue(row, "track_score")) === 50);
  const unknownDistanceRows = rows.filter((row) => Math.round(getComponentValue(row, "distance_score")) === 50);
  const unknownConditionRows = rows.filter((row) => Math.round(getComponentValue(row, "condition_score")) === 50);

  const highestRatedMisses = rows
    .filter(
      (row) =>
        toNumber(row.score) >= 68 &&
        row.finishing_position !== null &&
        row.finishing_position > 3,
    )
    .sort((a, b) => toNumber(b.score) - toNumber(a.score))
    .slice(0, 8);

  const underratedWinners = rows
    .filter((row) => row.finishing_position === 1 && toNumber(row.score) <= 62)
    .sort((a, b) => toNumber(a.score) - toNumber(b.score))
    .slice(0, 8);

  const topRatedMisses = raceGroups
    .map((race) => race.rows.find((row) => row.rank === 1) || race.rows[0] || null)
    .filter(
      (row): row is Prediction =>
        Boolean(row) &&
        row.finishing_position !== null &&
        row.finishing_position > 3,
    )
    .sort((a, b) => toNumber(b.score) - toNumber(a.score))
    .slice(0, 8);

  const reviewComponents = componentSummaries
    .filter((component) => component.tone === "rose" || component.tone === "slate")
    .map((component) => component.label);

  return {
    componentSummaries,
    unknownTrackRows,
    unknownDistanceRows,
    unknownConditionRows,
    highestRatedMisses,
    underratedWinners,
    topRatedMisses,
    reviewComponents,
  };
}

type ConfidenceAuditRace = {
  raceId: number;
  tier: string;
  confidence: number;
  tipType: "Win" | "Place";
  successful: boolean;
  weekend: boolean;
  gap: number;
};

type ConfidenceAuditRow = {
  label: string;
  races: number;
  winTips: number;
  winHits: number;
  placeTips: number;
  placeHits: number;
  avgConfidence: number;
};

function getMeetingDay(value?: string | null) {
  if (!value) return -1;

  const date = new Date(`${isoDate(value)}T00:00:00`);

  return Number.isNaN(date.getTime()) ? -1 : date.getDay();
}

function getPlaceLimit(placeTerms?: string | null) {
  if (placeTerms === "win_only") return 1;
  if (placeTerms === "top_2") return 2;
  return 3;
}
function isPlacedForRace(
  finishingPosition: number | null | undefined,
  placeTerms?: string | null,
) {
  if (finishingPosition === null || finishingPosition === undefined) {
    return false;
  }

  return finishingPosition <= getPlaceLimit(placeTerms);
}
function buildConfidenceAudit(raceGroups: ReturnType<typeof groupByRace>) {
  const auditRaces: ConfidenceAuditRace[] = raceGroups
    .map((race) => {
      const tip = getSmartPuntCalculatorTip(race.rows);

      if (!tip) return null;

      const tipTypeRaw = String(tip.smartPuntSuggestedBet || "")
        .trim()
        .toLowerCase();

      const tipType: "Win" | "Place" =
        tipTypeRaw.includes("place") ? "Place" : "Win";

      const finishingPosition =
        tip.finishing_position !== null &&
        tip.finishing_position !== undefined
          ? Number(tip.finishing_position)
          : null;

      const placeLimit = getPlaceLimit(tip.race?.place_terms);
      const successful =
        finishingPosition !== null &&
        (tipType === "Win"
          ? finishingPosition === 1
          : finishingPosition >= 1 && finishingPosition <= placeLimit);

      const top = race.rows[0] || null;
      const second = race.rows[1] || null;
      const gap =
        top && second
          ? Math.round(toNumber(top.score) - toNumber(second.score))
          : 0;

      const day = getMeetingDay(race.meetingDate);

      return {
        raceId: race.raceId,
        tier: tip.smartPuntConfidenceTier || "Unknown",
        confidence: Number(tip.smartPuntRaceConfidence || 0),
        tipType,
        successful,
        weekend: day === 0 || day === 6,
        gap,
      };
    })
    .filter((row): row is ConfidenceAuditRace => Boolean(row));

  function summarise(
    label: string,
    rows: ConfidenceAuditRace[],
  ): ConfidenceAuditRow {
    const winRows = rows.filter((row) => row.tipType === "Win");
    const placeRows = rows.filter((row) => row.tipType === "Place");

    return {
      label,
      races: rows.length,
      winTips: winRows.length,
      winHits: winRows.filter((row) => row.successful).length,
      placeTips: placeRows.length,
      placeHits: placeRows.filter((row) => row.successful).length,
      avgConfidence: rows.length
        ? Math.round(
            rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length,
          )
        : 0,
    };
  }

  const tierOrder = ["Elite", "High", "Medium", "Low", "Unknown"];
  const tierRows = tierOrder
    .map((tier) =>
      summarise(
        tier,
        auditRaces.filter((row) => row.tier === tier),
      ),
    )
    .filter((row) => row.races > 0);

  const confidenceBands = [
    { label: "95–100", min: 95, max: 100 },
    { label: "90–94", min: 90, max: 94 },
    { label: "85–89", min: 85, max: 89 },
    { label: "80–84", min: 80, max: 84 },
    { label: "75–79", min: 75, max: 79 },
    { label: "70–74", min: 70, max: 74 },
    { label: "65–69", min: 65, max: 69 },
    { label: "60–64", min: 60, max: 64 },
    { label: "55–59", min: 55, max: 59 },
    { label: "Below 55", min: 0, max: 54 },
  ];

  const bandRows = confidenceBands
    .map((band) =>
      summarise(
        band.label,
        auditRaces.filter(
          (row) =>
            row.confidence >= band.min && row.confidence <= band.max,
        ),
      ),
    )
    .filter((row) => row.races > 0);

  const weekendRows = [
    summarise(
      "Weekday",
      auditRaces.filter((row) => !row.weekend),
    ),
    summarise(
      "Weekend",
      auditRaces.filter((row) => row.weekend),
    ),
  ];

  const gapBands = [
    { label: "Gap 0–1", min: 0, max: 1 },
    { label: "Gap 2–3", min: 2, max: 3 },
    { label: "Gap 4–5", min: 4, max: 5 },
    { label: "Gap 6+", min: 6, max: Number.POSITIVE_INFINITY },
  ];

  const gapRows = gapBands
    .map((band) =>
      summarise(
        band.label,
        auditRaces.filter(
          (row) => row.gap >= band.min && row.gap <= band.max,
        ),
      ),
    )
    .filter((row) => row.races > 0);

  return {
    totalTips: auditRaces.length,
    tierRows,
    bandRows,
    weekendRows,
    gapRows,
  };
}

function ConfidenceAuditTable({
  rows,
}: {
  rows: ConfidenceAuditRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <th className="py-3 pr-3">Group</th>
            <th className="py-3 pr-3">Tips</th>
            <th className="py-3 pr-3">Win tips</th>
            <th className="py-3 pr-3">Win strike</th>
            <th className="py-3 pr-3">Place tips</th>
            <th className="py-3 pr-3">Place strike</th>
            <th className="py-3 pr-3">Avg conf.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-zinc-100 last:border-0"
            >
              <td className="py-3 pr-3 font-bold text-zinc-950">
                {row.label}
              </td>
              <td className="py-3 pr-3">{row.races}</td>
              <td className="py-3 pr-3">{row.winTips}</td>
              <td className="py-3 pr-3 font-semibold">
                {row.winTips
                  ? `${percent(row.winHits, row.winTips)}% (${row.winHits}/${row.winTips})`
                  : "—"}
              </td>
              <td className="py-3 pr-3">{row.placeTips}</td>
              <td className="py-3 pr-3 font-semibold">
                {row.placeTips
                  ? `${percent(row.placeHits, row.placeTips)}% (${row.placeHits}/${row.placeTips})`
                  : "—"}
              </td>
              <td className="py-3 pr-3">
                {row.races ? `${row.avgConfidence}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

async function fetchPredictions({
  from,
  to,
  allHistory = false,
}: {
  from: string;
  to: string;
  allHistory?: boolean;
}) {
  const filters = [
    "select=*",
    "settled_at=not.is.null",
    "finishing_position=not.is.null",
  ];

  filters.push("order=settled_at.desc");

const allPredictionVersions = await serviceSelectAllRows<Prediction>(
  `calculator_predictions?${filters.join("&")}`,
);

const latestPredictionByRunner = new Map<string, Prediction>();

for (const prediction of allPredictionVersions) {
  const key = `${Number(prediction.race_id)}-${Number(prediction.runner_id)}`;
  const existing = latestPredictionByRunner.get(key);

  if (!existing) {
    latestPredictionByRunner.set(key, prediction);
    continue;
  }

  const existingTime = new Date(
    existing.predicted_at || existing.settled_at || 0,
  ).getTime();

  const predictionTime = new Date(
    prediction.predicted_at || prediction.settled_at || 0,
  ).getTime();

  if (predictionTime >= existingTime) {
    latestPredictionByRunner.set(key, prediction);
  }
}

const predictions = Array.from(latestPredictionByRunner.values());

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
  select: "id,race_number,race_name,distance_m,meeting_id,status,place_terms",
  ids: raceIds,
}),
    serviceSelectByIdChunks<HorseRow>({
      table: "horses",
select: "id,horse_name,smartpunt_power_rating",
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
  const allHistory = first(resolvedSearchParams.range) === "all";
  const yesterday = pastIso(1);
  const dateFrom = allHistory ? "" : first(resolvedSearchParams.from) || yesterday;
  const dateTo = allHistory ? "" : first(resolvedSearchParams.to) || yesterday;

  let predictions: Prediction[] = [];
  let errorMessage = "";

  try {
predictions = filterByDate(
  await fetchPredictions({
    from: dateFrom,
    to: dateTo,
    allHistory,
  }),
  dateFrom,
  dateTo,
);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error loading calculator report.";
  }

  const exportHref = allHistory
    ? "/admin/calculator-report/export"
    : `/admin/calculator-report/export${buildQuery({ from: dateFrom, to: dateTo })}`;

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

  const calculatorWinTips = calculatorGeneratedTips.filter((row) => {
    const tipType = String(row.smartPuntSuggestedBet || "").trim().toLowerCase();

    return tipType === "win" || tipType === "best bet";
  });

  const calculatorPlaceTips = calculatorGeneratedTips.filter((row) => {
    const tipType = String(row.smartPuntSuggestedBet || "").trim().toLowerCase();

    return tipType === "place" || tipType === "strong place";
  });

  const calculatorTipWins = calculatorWinTips.filter(
    (row) => row.won === true || row.finishing_position === 1,
  ).length;

const calculatorTipPlaces = calculatorPlaceTips.filter((row) =>
  isPlacedForRace(
    row.finishing_position,
    row.race?.place_terms,
  ),
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
  const powerTopRatedRows = raceGroups
  .map(
    (race) =>
      [...race.rows]
        .filter((row) => row.horse?.smartpunt_power_rating)
        .sort((a, b) => getPowerRating(b) - getPowerRating(a))[0] || null,
  )
  .filter((row): row is Prediction => Boolean(row));

const powerTopWins = powerTopRatedRows.filter(
  (row) => row.finishing_position === 1,
).length;

const powerTopPlaces = powerTopRatedRows.filter(
  (row) => row.finishing_position !== null && row.finishing_position <= 3,
).length;

const powerTopThreeHitRaces = raceGroups.filter((race) => {
  const raceWinner = winner(race.rows);
  const powerRank = raceWinner ? getPowerRank(raceWinner, race.rows) : null;

  return powerRank !== null && powerRank <= 3;
}).length;

const powerTopFiveHitRaces = raceGroups.filter((race) => {
  const raceWinner = winner(race.rows);
  const powerRank = raceWinner ? getPowerRank(raceWinner, race.rows) : null;

  return powerRank !== null && powerRank <= 5;
}).length;
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


  const scoringAudit = buildScoringAuditSummary(predictions, raceGroups);
  const confidenceAudit = buildConfidenceAudit(raceGroups);

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
  href="/admin/calculator-report?range=all"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  All history
                </Link>
              </div>
            </div>

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

                               <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                  >
                    Apply Filter
                  </button>

                  <button
                    type="submit"
                    formAction={loadCalculatorReportResultsAction}
                    className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black transition hover:bg-amber-400"
                  >
                    Repair Results
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
                SmartPunt Power Rating results
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                Compares current SmartPunt Power Ratings against settled race
                results. Ratings are current, not historical snapshots.
              </p>
            </div>
            <Badge tone="blue">Power Rating audit</Badge>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Power #1 win"
              value={`${percent(powerTopWins, powerTopRatedRows.length)}%`}
              hint={`${powerTopWins}/${powerTopRatedRows.length} highest Power Rating runners won.`}
              tone="green"
            />
            <StatCard
              label="Power #1 place"
              value={`${percent(powerTopPlaces, powerTopRatedRows.length)}%`}
              hint={`${powerTopPlaces}/${powerTopRatedRows.length} highest Power Rating runners placed.`}
              tone="blue"
            />
            <StatCard
              label="Power Top 3 winner"
              value={`${percent(powerTopThreeHitRaces, totalRaces)}%`}
              hint={`${powerTopThreeHitRaces}/${totalRaces} winners were in the Power Rating top 3.`}
              tone="amber"
            />
            <StatCard
              label="Power Top 5 winner"
              value={`${percent(powerTopFiveHitRaces, totalRaces)}%`}
              hint={`${powerTopFiveHitRaces}/${totalRaces} winners were in the Power Rating top 5.`}
              tone="slate"
            />
          </div>
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
  label="Win opportunities"
  value={calculatorWinTips.length}
  hint={`${calculatorWinTips.length} win opportunities generated by the Calculator Lab.`}
  tone="green"
/>

<StatCard
  label="Place opportunities"
  value={calculatorPlaceTips.length}
  hint={`${calculatorPlaceTips.length} place opportunities generated by the Calculator Lab.`}
  tone="blue"
/>

<StatCard
  label="No Bet races"
  value={calculatorNoBetRaces}
  hint={`${calculatorNoBetRaces} races did not meet Calculator Lab tipping standards.`}
  tone="rose"
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

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                🎯 Race Confidence Audit
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                Tests whether higher race-confidence ratings are producing
                stronger Calculator tips, including weekend and score-gap
                comparisons.
              </p>
            </div>
            <Badge tone="amber">
              {confidenceAudit.totalTips} settled tips
            </Badge>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      Confidence tier performance
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Elite, High, Medium and Low tiers compared with actual tip
                      outcomes.
                    </p>
                  </div>
                  <Badge tone="blue">Tier calibration</Badge>
                </div>

                <div className="mt-4">
                  <ConfidenceAuditTable rows={confidenceAudit.tierRows} />
                </div>
              </div>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      Weekend versus weekday
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Saturday and Sunday tips compared with Monday to Friday.
                    </p>
                  </div>
                  <Badge tone="amber">Weekend check</Badge>
                </div>

                <div className="mt-4">
                  <ConfidenceAuditTable rows={confidenceAudit.weekendRows} />
                </div>
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      Confidence percentage bands
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Fine-grained view showing where confidence performance
                      starts to strengthen or fall away.
                    </p>
                  </div>
                  <Badge tone="green">Confidence bands</Badge>
                </div>

                <div className="mt-4">
                  <ConfidenceAuditTable rows={confidenceAudit.bandRows} />
                </div>
              </div>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Score-gap analysis</h3>
                    <p className="text-sm text-zinc-500">
                      Measures whether stronger separation from the second-rated
                      runner leads to better tip performance.
                    </p>
                  </div>
                  <Badge tone="slate">Race separation</Badge>
                </div>

                <div className="mt-4">
                  <ConfidenceAuditTable rows={confidenceAudit.gapRows} />
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="mt-4 bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">How to read this audit</h3>
                  <p className="text-sm text-zinc-500">
                    Use larger samples before adjusting thresholds. A healthy
                    confidence engine should show improving strike rates as
                    confidence and score gap rise.
                  </p>
                </div>
                <Badge tone="amber">Reporting only</Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-950">
                    Healthy calibration
                  </p>
                  <p className="mt-2 text-sm text-emerald-800">
                    Elite and High should outperform Medium, while larger gaps
                    should outperform compressed races.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-950">
                    Weekend warning
                  </p>
                  <p className="mt-2 text-sm text-amber-800">
                    A materially lower weekend strike rate can justify a future
                    weekend-specific confidence adjustment.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-bold text-blue-950">
                    Correct place terms
                  </p>
                  <p className="mt-2 text-sm text-blue-800">
                    Place-tip success respects Win Only, Pay 1 &amp; 2 and Pay
                    1, 2 &amp; 3 race terms.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                🔬 Scoring Audit
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                Daily scoring health check. This highlights which components separated winners from the field and which horses deserve review.
              </p>
            </div>
            <Badge tone="amber">Model development</Badge>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Unknown Track"
              value={scoringAudit.unknownTrackRows.length}
              hint={`${percent(scoringAudit.unknownTrackRows.length, totalRunners)}% of runners had neutral track evidence.`}
              tone="amber"
            />
            <StatCard
              label="Unknown Distance"
              value={scoringAudit.unknownDistanceRows.length}
              hint={`${percent(scoringAudit.unknownDistanceRows.length, totalRunners)}% of runners had neutral distance evidence.`}
              tone="amber"
            />
            <StatCard
              label="Review Components"
              value={scoringAudit.reviewComponents.length}
              hint={
                scoringAudit.reviewComponents.length
                  ? scoringAudit.reviewComponents.join(", ")
                  : "All components showed useful separation."
              }
              tone={scoringAudit.reviewComponents.length ? "rose" : "green"}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Component effectiveness</h3>
                    <p className="text-sm text-zinc-500">
                      Winner average compared with non-winners. Positive separation means winners were scoring higher in that component.
                    </p>
                  </div>
                  <Badge tone="blue">Evidence check</Badge>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <th className="py-3 pr-3">Component</th>
                        <th className="py-3 pr-3">Field Avg</th>
                        <th className="py-3 pr-3">Winner Avg</th>
                        <th className="py-3 pr-3">Non-winner Avg</th>
                        <th className="py-3 pr-3">Separation</th>
                        <th className="py-3 pr-3">Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoringAudit.componentSummaries.map((component) => (
                        <tr key={component.key} className="border-b border-zinc-100 last:border-0">
                          <td className="py-3 pr-3 font-semibold text-zinc-950">
                            {component.label}
                          </td>
                          <td className="py-3 pr-3">{component.fieldAverage}</td>
                          <td className="py-3 pr-3">{component.winnerAverage}</td>
                          <td className="py-3 pr-3">{component.nonWinnerAverage}</td>
                          <td className="py-3 pr-3 font-semibold">
                            {component.separation > 0 ? "+" : ""}
                            {component.separation}
                          </td>
                          <td className="py-3 pr-3">
                            <Badge tone={component.tone}>{component.health}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Horses worth reviewing</h3>
                    <p className="text-sm text-zinc-500">
                      Automatic watchlist for high-rated misses, top-rated misses and low-rated winners.
                    </p>
                  </div>
                  <Badge tone="rose">Audit queue</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-bold text-rose-950">Highest-rated misses</p>
                    <div className="mt-3 space-y-2">
                      {scoringAudit.highestRatedMisses.length ? (
                        scoringAudit.highestRatedMisses.slice(0, 4).map((row) => (
                          <div key={`high-miss-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                            <div>
                              <p className="font-semibold text-zinc-950">{getHorseName(row)}</p>
                              <p className="text-xs text-zinc-500">{raceLabel(row)}</p>
                            </div>
                            <Badge tone="rose">
                              Score {Math.round(toNumber(row.score))} · Finished {row.finishing_position ?? "—"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">No high-rated misses in this range.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-950">Top-rated misses</p>
                    <div className="mt-3 space-y-2">
                      {scoringAudit.topRatedMisses.length ? (
                        scoringAudit.topRatedMisses.slice(0, 4).map((row) => (
                          <div key={`top-miss-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                            <div>
                              <p className="font-semibold text-zinc-950">{getHorseName(row)}</p>
                              <p className="text-xs text-zinc-500">{raceLabel(row)}</p>
                            </div>
                            <Badge tone="amber">
                              Rank #{row.rank} · Finished {row.finishing_position ?? "—"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">No top-rated misses in this range.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-950">Underrated winners</p>
                    <div className="mt-3 space-y-2">
                      {scoringAudit.underratedWinners.length ? (
                        scoringAudit.underratedWinners.slice(0, 4).map((row) => (
                          <div key={`under-winner-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                            <div>
                              <p className="font-semibold text-zinc-950">{getHorseName(row)}</p>
                              <p className="text-xs text-zinc-500">{raceLabel(row)}</p>
                            </div>
                            <Badge tone="green">
                              Won · Score {Math.round(toNumber(row.score))} · Rank #{row.rank}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">No low-scored winners in this range.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="mt-4 bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Development notes</h3>
                  <p className="text-sm text-zinc-500">
                    Current model-watch items based on recent audit findings.
                  </p>
                </div>
                <Badge tone="slate">Scoring version {SMARTPUNT_SCORING_VERSION}</Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-950">Track / Distance fallback removed</p>
                  <p className="mt-2 text-sm text-emerald-800">
                    Unknown track or distance evidence now stays neutral instead of being lifted by imported records.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-950">Jockey / Trainer watch</p>
                  <p className="mt-2 text-sm text-amber-800">
                    Review any day where these components show weak or negative winner separation.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-bold text-blue-950">Consistency sample size</p>
                  <p className="mt-2 text-sm text-blue-800">
                    Monitor whether limited-history horses are still being lifted too strongly by consistency scoring.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
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
    : isPlacedForRace(
        smartPuntTip.finishing_position,
        smartPuntTip.race?.place_terms,
      )
      ? "blue"
      : "rose"
}
                              >
                                SP {smartPuntTip.smartPuntSuggestedBet}:{" "}
smartPuntTip.finishing_position === 1
  ? "Won"
  : isPlacedForRace(
      smartPuntTip.finishing_position,
      smartPuntTip.race?.place_terms,
    )
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
  : isPlacedForRace(
      row.finishing_position,
      race.rows[0]?.race?.place_terms,
    )
    ? "blue"
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

        <PowerRatingDryRunPanel />
      </div>
    </div>
  );
}
