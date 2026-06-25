import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchValue = string | string[] | undefined;
type SearchParams = Record<string, SearchValue>;

type Prediction = {
  id: number;
  race_id: number;
  runner_id: number;
  horse_id: number;
  scoring_version: string;
  score: number | string;
  rank: number;
  win_percent: number | string | null;
  place_percent: number | string | null;
  recent_form_score: number | string | null;
  distance_score: number | string | null;
  track_score: number | string | null;
  condition_score: number | string | null;
  barrier_score: number | string | null;
  weight_score: number | string | null;
  jockey_score: number | string | null;
  trainer_score: number | string | null;
  predicted_at: string | null;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
};

type ComponentKey =
  | "recentForm"
  | "distance"
  | "track"
  | "condition"
  | "barrier"
  | "weight"
  | "jockey"
  | "trainer";

type WeightSet = Partial<Record<ComponentKey, number>>;

type OptimiserModel = {
  key: string;
  label: string;
  description: string;
  kind: "stored" | "weighted";
  weights?: WeightSet;
};

type ModelResult = {
  key: string;
  label: string;
  description: string;
  races: number;
  runners: number;
  topPickWins: number;
  topPickPlaces: number;
  winnerTop3: number;
  winnerTop5: number;
  avgWinnerRank: number;
  topPickWinRate: number;
  topPickPlaceRate: number;
  winnerTop3Rate: number;
  winnerTop5Rate: number;
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

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function isoDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function groupByRace(rows: Prediction[]) {
  const map = new Map<number, Prediction[]>();

  rows.forEach((row) => {
    const raceRows = map.get(row.race_id) || [];
    raceRows.push(row);
    map.set(row.race_id, raceRows);
  });

  return map;
}

function getComponentScore(row: Prediction, key: ComponentKey) {
  if (key === "recentForm") return toNumber(row.recent_form_score, 50);
  if (key === "distance") return toNumber(row.distance_score, 50);
  if (key === "track") return toNumber(row.track_score, 50);
  if (key === "condition") return toNumber(row.condition_score, 50);
  if (key === "barrier") return toNumber(row.barrier_score, 50);
  if (key === "weight") return toNumber(row.weight_score, 50);
  if (key === "jockey") return toNumber(row.jockey_score, 50);
  if (key === "trainer") return toNumber(row.trainer_score, 50);

  return 50;
}

function weightedScore(row: Prediction, weights: WeightSet) {
  const entries = Object.entries(weights) as [ComponentKey, number][];

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight <= 0) return 0;

  const total = entries.reduce((sum, [key, weight]) => {
    return sum + getComponentScore(row, key) * weight;
  }, 0);

  return total / totalWeight;
}

function modelScore(row: Prediction, model: OptimiserModel) {
  if (model.kind === "stored") return toNumber(row.score, 0);

  return weightedScore(row, model.weights || {});
}

function analyseModel(model: OptimiserModel, rows: Prediction[]): ModelResult {
  const raceMap = groupByRace(rows);

  let races = 0;
  let runners = 0;
  let topPickWins = 0;
  let topPickPlaces = 0;
  let winnerTop3 = 0;
  let winnerTop5 = 0;
  let totalWinnerRank = 0;

  raceMap.forEach((raceRows) => {
    const settledRows = raceRows.filter(
      (row) =>
        row.finishing_position !== null &&
        row.finishing_position !== undefined,
    );

    const winner = settledRows.find((row) => Number(row.finishing_position) === 1);

    if (!winner || settledRows.length < 2) return;

    const ranked = [...settledRows].sort((a, b) => {
      const scoreGap = modelScore(b, model) - modelScore(a, model);

      if (scoreGap !== 0) return scoreGap;

      return toNumber(a.rank, 999) - toNumber(b.rank, 999);
    });

    const topPick = ranked[0];
    const winnerIndex = ranked.findIndex(
      (row) => Number(row.finishing_position) === 1,
    );

    if (!topPick || winnerIndex < 0) return;

    const winnerRank = winnerIndex + 1;

    races += 1;
    runners += settledRows.length;

    if (Number(topPick.finishing_position) === 1) topPickWins += 1;
    if (topPick.placed === true) topPickPlaces += 1;
    if (winnerRank <= 3) winnerTop3 += 1;
    if (winnerRank <= 5) winnerTop5 += 1;

    totalWinnerRank += winnerRank;
  });

  return {
    key: model.key,
    label: model.label,
    description: model.description,
    races,
    runners,
    topPickWins,
    topPickPlaces,
    winnerTop3,
    winnerTop5,
    avgWinnerRank: races ? totalWinnerRank / races : 0,
    topPickWinRate: races ? (topPickWins / races) * 100 : 0,
    topPickPlaceRate: races ? (topPickPlaces / races) * 100 : 0,
    winnerTop3Rate: races ? (winnerTop3 / races) * 100 : 0,
    winnerTop5Rate: races ? (winnerTop5 / races) * 100 : 0,
  };
}

function filterRows({
  rows,
  version,
  from,
  to,
}: {
  rows: Prediction[];
  version: string;
  from: string;
  to: string;
}) {
  return rows.filter((row) => {
    if (version && version !== "all" && row.scoring_version !== version) {
      return false;
    }

    const settledDate = isoDate(row.settled_at || row.predicted_at);

    if (from && settledDate && settledDate < from) return false;
    if (to && settledDate && settledDate > to) return false;

    return true;
  });
}

async function fetchPredictions() {
  return serviceSelectAllRows<Prediction>(
    "calculator_predictions?select=*&settled_at=not.is.null&finishing_position=not.is.null&order=settled_at.desc",
  );
}

const MODELS: OptimiserModel[] = [
  {
    key: "stored-current",
    label: "Current Stored Score",
    description:
      "The actual historical SmartPunt score saved at prediction time. Includes anything baked into the live score at the time.",
    kind: "stored",
  },
  {
    key: "v6-visible-components",
    label: "v6 Visible Component Blend",
    description:
      "Rebuilds the score using the visible stored component scores only. Does not include hidden consistency, Power, or standout adjustments.",
    kind: "weighted",
    weights: {
      recentForm: 25,
      distance: 21,
      condition: 18,
      track: 11,
      jockey: 7,
      barrier: 5,
      trainer: 2,
      weight: 0,
    },
  },
  {
    key: "recent-form-only",
    label: "Recent Form Only",
    description:
      "Ranks each race purely by recent form score. Useful as the clean benchmark.",
    kind: "weighted",
    weights: {
      recentForm: 100,
    },
  },
  {
    key: "contender-v7-test",
    label: "v7 Contender Test",
    description:
      "A cautious test blend that leans harder into form, distance and track while reducing barrier noise.",
    kind: "weighted",
    weights: {
      recentForm: 32,
      distance: 22,
      track: 18,
      condition: 16,
      jockey: 7,
      trainer: 3,
      barrier: 2,
      weight: 0,
    },
  },
  {
    key: "no-barrier-test",
    label: "No Barrier Test",
    description:
      "Same idea as the visible blend, but removes barrier influence entirely.",
    kind: "weighted",
    weights: {
      recentForm: 27,
      distance: 22,
      condition: 18,
      track: 12,
      jockey: 7,
      trainer: 3,
      barrier: 0,
      weight: 0,
    },
  },
  {
    key: "track-distance-test",
    label: "Track + Distance Lift",
    description:
      "Tests whether the data wants track and distance treated as stronger contender separators.",
    kind: "weighted",
    weights: {
      recentForm: 28,
      distance: 24,
      track: 20,
      condition: 14,
      jockey: 6,
      trainer: 3,
      barrier: 2,
      weight: 0,
    },
  },
];

function ResultCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Panel className="bg-white/95">
      <div className="p-5 text-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold">{value}</p>
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      </div>
    </Panel>
  );
}

export default async function CalculatorOptimiserPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const version = first(resolvedSearchParams.version) || "v6";
  const from = first(resolvedSearchParams.from);
  const to = first(resolvedSearchParams.to);

  let rows: Prediction[] = [];
  let filteredRows: Prediction[] = [];
  let results: ModelResult[] = [];
  let errorMessage = "";

  try {
    rows = await fetchPredictions();
    filteredRows = filterRows({ rows, version, from, to });
    results = MODELS.map((model) => analyseModel(model, filteredRows)).sort(
      (a, b) => b.topPickWinRate - a.topPickWinRate,
    );
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error loading calculator optimiser.";
  }

  const raceCount = groupByRace(filteredRows).size;
  const versions = Array.from(
    new Set(rows.map((row) => row.scoring_version).filter(Boolean)),
  ).sort();

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 text-white lg:p-8">
        <div className="mx-auto max-w-5xl">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h1 className="text-2xl font-bold">Calculator Optimiser</h1>
              <p className="mt-3 text-sm text-rose-700">{errorMessage}</p>
              <Link
                href="/admin/calculator-report"
                className="mt-5 inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Back to Calculator Report
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              SmartPunt Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold lg:text-4xl">
              Calculator Optimiser
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-zinc-300">
              Replays historical prediction snapshots with alternate scoring
              blends. This page does not change live scores, settlement,
              published tips or the Calculator Lab.
            </p>
          </div>

          <Link
            href="/admin/calculator-report"
            className="inline-flex rounded-full border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-300/10"
          >
            Back to Calculator Report
          </Link>
        </div>

        <Panel className="bg-white/95">
          <form className="grid gap-4 p-5 text-zinc-950 md:grid-cols-4">
            <label className="space-y-2 text-sm font-semibold">
              <span>Scoring version</span>
              <select
                name="version"
                defaultValue={version}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="all">All versions</option>
                {versions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold">
              <span>From</span>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold">
              <span>To</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Run optimiser
              </button>
              <Link
                href="/admin/calculator-optimiser"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Reset
              </Link>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4 md:grid-cols-3">
          <ResultCard
            label="Races Tested"
            value={raceCount}
            hint="Settled races included in the current filter."
          />
          <ResultCard
            label="Runners Tested"
            value={filteredRows.length}
            hint="Settled runner predictions included in the replay."
          />
          <ResultCard
            label="Mode"
            value={version === "all" ? "All" : version}
            hint="Default is v6 because that is the current live concern."
          />
        </div>

        <Panel className="bg-white/95">
          <div className="p-5 text-zinc-950">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Model Comparison</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Sorted by top-pick win strike. The current stored score is the
                  real historical SmartPunt baseline.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <th className="py-3 pr-4">Model</th>
                    <th className="py-3 pr-4 text-right">Top Win</th>
                    <th className="py-3 pr-4 text-right">Top Place</th>
                    <th className="py-3 pr-4 text-right">Winner Top 3</th>
                    <th className="py-3 pr-4 text-right">Winner Top 5</th>
                    <th className="py-3 pr-4 text-right">Avg Winner Rank</th>
                    <th className="py-3 pr-4 text-right">Races</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {results.map((result) => (
                    <tr key={result.key}>
                      <td className="max-w-md py-4 pr-4 align-top">
                        <p className="font-semibold text-zinc-950">
                          {result.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {result.description}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-right font-semibold">
                        {percent(result.topPickWinRate)}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        {percent(result.topPickPlaceRate)}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        {percent(result.winnerTop3Rate)}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        {percent(result.winnerTop5Rate)}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        {result.avgWinnerRank.toFixed(2)}
                      </td>
                      <td className="py-4 pr-4 text-right">{result.races}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel className="bg-amber-50/95">
          <div className="p-5 text-sm leading-6 text-zinc-800">
            <h2 className="text-lg font-bold text-zinc-950">
              Important reading note
            </h2>
            <p className="mt-2">
              This first optimiser uses the historical component scores already
              stored in <strong>calculator_predictions</strong>. It can compare
              visible factor blends safely, but it cannot perfectly isolate
              hidden items that were not snapshotted separately, such as Power
              adjustment, consistency and standout bonus.
            </p>
            <p className="mt-2">
              The safest use is to compare whether simpler visible blends beat
              the stored live score before we change any production scoring.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
