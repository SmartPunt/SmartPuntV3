import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type CalculatorPrediction = {
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
  race?: {
    id: number;
    race_number: number;
    race_name: string;
    distance_m: number | null;
    meeting_id: number;
    status: string;
    meeting?: {
      meeting_name: string;
      meeting_date: string;
      track_condition: string | null;
    } | null;
  } | null;
  horse?: {
    horse_name: string;
  } | null;
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

type HorseRow = {
  id: number;
  horse_name: string;
};

function getServiceRoleHeaders() {
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

async function serviceRoleSelect<T>(path: string): Promise<T[]> {
  const { supabaseUrl, headers } = getServiceRoleHeaders();

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Service role request failed for ${path}`);
  }

  return response.json();
}

function toNumber(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isNaN(next) ? 0 : next;
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
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

function getRaceLabel(prediction: CalculatorPrediction) {
  const meeting = prediction.race?.meeting?.meeting_name || "Meeting";
  const raceNumber = prediction.race?.race_number ? `R${prediction.race.race_number}` : "Race";
  const raceName = prediction.race?.race_name || "";
  return `${meeting} ${raceNumber} ${raceName}`.trim();
}

function groupByRace(predictions: CalculatorPrediction[]) {
  const map = new Map<number, CalculatorPrediction[]>();

  predictions.forEach((prediction) => {
    const existing = map.get(prediction.race_id) || [];
    existing.push(prediction);
    map.set(prediction.race_id, existing);
  });

  return Array.from(map.entries())
    .map(([raceId, rows]) => ({
      raceId,
      rows: rows.sort((a, b) => a.rank - b.rank),
      meetingDate: rows[0]?.race?.meeting?.meeting_date || "",
      label: getRaceLabel(rows[0]),
    }))
    .sort((a, b) => {
      const aTime = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const bTime = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.raceId - a.raceId;
    });
}

function getWinner(rows: CalculatorPrediction[]) {
  return rows.find((row) => row.finishing_position === 1) || null;
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

async function fetchReportPredictions() {
  const predictionRows = await serviceRoleSelect<CalculatorPrediction>(
    [
      "calculator_predictions",
      "?select=*",
      "&settled_at=not.is.null",
      "&finishing_position=not.is.null",
      "&order=settled_at.desc",
    ].join(""),
  );

  const raceIds = Array.from(new Set(predictionRows.map((row) => row.race_id).filter(Boolean)));
  const horseIds = Array.from(new Set(predictionRows.map((row) => row.horse_id).filter(Boolean)));

  const races =
    raceIds.length > 0
      ? await serviceRoleSelect<RaceRow>(
          `races?select=id,race_number,race_name,distance_m,meeting_id,status&id=in.(${raceIds.join(
            ",",
          )})`,
        )
      : [];

  const meetingIds = Array.from(new Set(races.map((race) => race.meeting_id).filter(Boolean)));

  const meetings =
    meetingIds.length > 0
      ? await serviceRoleSelect<MeetingRow>(
          `meetings?select=id,meeting_name,meeting_date,track_condition&id=in.(${meetingIds.join(
            ",",
          )})`,
        )
      : [];

  const horses =
    horseIds.length > 0
      ? await serviceRoleSelect<HorseRow>(
          `horses?select=id,horse_name&id=in.(${horseIds.join(",")})`,
        )
      : [];

  const raceMap = new Map(races.map((race) => [Number(race.id), race]));
  const meetingMap = new Map(meetings.map((meeting) => [Number(meeting.id), meeting]));
  const horseMap = new Map(horses.map((horse) => [Number(horse.id), horse]));

  return predictionRows.map((prediction) => {
    const race = raceMap.get(Number(prediction.race_id)) || null;
    const meeting = race ? meetingMap.get(Number(race.meeting_id)) || null : null;
    const horse = horseMap.get(Number(prediction.horse_id)) || null;

    return {
      ...prediction,
      race: race
        ? {
            ...race,
            meeting,
          }
        : null,
      horse,
    };
  });
}

export default async function CalculatorReportPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!["admin", "staff_admin"].includes(profile.role)) {
    redirect("/");
  }

  let predictions: CalculatorPrediction[] = [];
  let errorMessage = "";

  try {
    predictions = await fetchReportPredictions();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Unknown error loading calculator report.";
  }

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
    .map((race) => race.rows.find((row) => row.rank === 1) || race.rows[0] || null)
    .filter((row): row is CalculatorPrediction => Boolean(row));

  const topRatedWins = topRatedRows.filter((row) => row.finishing_position === 1).length;
  const topRatedPlaces = topRatedRows.filter(
    (row) => row.finishing_position !== null && row.finishing_position <= 3,
  ).length;

  const topThreeHitRaces = raceGroups.filter((race) =>
    race.rows.some((row) => row.rank <= 3 && row.finishing_position === 1),
  ).length;

  const winners = raceGroups
    .map((race) => getWinner(race.rows))
    .filter((row): row is CalculatorPrediction => Boolean(row));

  const avgWinnerRank = winners.length
    ? (winners.reduce((sum, row) => sum + Number(row.rank || 0), 0) / winners.length).toFixed(1)
    : "—";

  const avgWinnerScore = winners.length
    ? Math.round(winners.reduce((sum, row) => sum + toNumber(row.score), 0) / winners.length)
    : "—";

  const strongestWinner = [...winners].sort((a, b) => toNumber(b.score) - toNumber(a.score))[0] || null;
  const biggestMiss = [...topRatedRows]
    .filter((row) => row.finishing_position !== null && row.finishing_position > 3)
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
                <Link href="/current-races" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Current Races
                </Link>
                <Link href="/admin/race-builder" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Race Builder
                </Link>
                <Link href="/admin/calculator" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Calculator Lab
                </Link>
                {profile.role === "admin" ? (
                  <Link href="/" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
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
                Daily and historical read on how the calculator is performing against final race results.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{totalRaces} races analysed</Badge>
                <Badge tone="blue">{totalRunners} runners analysed</Badge>
                <Badge tone="amber">Final field snapshots</Badge>
              </div>
            </div>
          </div>
        </div>

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

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Best calculator result</h2>
              {strongestWinner ? (
                <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm text-zinc-600">{getRaceLabel(strongestWinner)}</p>
                  <h3 className="mt-1 text-2xl font-bold">{strongestWinner.horse?.horse_name || "Unknown horse"}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="green">Won</Badge>
                    <Badge tone="amber">Rank #{strongestWinner.rank}</Badge>
                    <Badge tone="blue">Score {Math.round(toNumber(strongestWinner.score))}</Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No winning prediction data yet.</p>
              )}
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Biggest miss</h2>
              {biggestMiss ? (
                <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm text-zinc-600">{getRaceLabel(biggestMiss)}</p>
                  <h3 className="mt-1 text-2xl font-bold">{biggestMiss.horse?.horse_name || "Unknown horse"}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="rose">Finished {biggestMiss.finishing_position}</Badge>
                    <Badge tone="amber">Rank #{biggestMiss.rank}</Badge>
                    <Badge tone="blue">Score {Math.round(toNumber(biggestMiss.score))}</Badge>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No major misses recorded yet.</p>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Race-by-race breakdown</h2>
                <p className="text-sm text-zinc-500">
                  Final calculator snapshot compared with official finishing positions.
                </p>
              </div>
              <Badge tone="green">{totalRaces} races</Badge>
            </div>

            <div className="mt-5 space-y-5">
              {raceGroups.length > 0 ? (
                raceGroups.map((race) => {
                  const topRated = race.rows.find((row) => row.rank === 1) || race.rows[0];
                  const winner = getWinner(race.rows);
                  const topThreeHadWinner = race.rows.some(
                    (row) => row.rank <= 3 && row.finishing_position === 1,
                  );

                  return (
                    <div key={race.raceId} className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-zinc-500">{formatDate(race.meetingDate)}</p>
                          <h3 className="mt-1 text-lg font-bold text-zinc-950">{race.label}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={topRated?.finishing_position === 1 ? "green" : "amber"}>
                            Top: {topRated?.finishing_position === 1 ? "Won" : `Finished ${topRated?.finishing_position ?? "—"}`}
                          </Badge>
                          <Badge tone={topThreeHadWinner ? "green" : "rose"}>
                            Top 3 {topThreeHadWinner ? "hit" : "miss"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Top rated</p>
                          <p className="mt-2 font-bold text-zinc-950">{topRated?.horse?.horse_name || "—"}</p>
                          <p className="mt-1 text-sm text-zinc-600">
                            Score {Math.round(toNumber(topRated?.score))} · Win {topRated?.win_percent ?? 0}% · Place {topRated?.place_percent ?? 0}%
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Winner</p>
                          <p className="mt-2 font-bold text-zinc-950">{winner?.horse?.horse_name || "—"}</p>
                          <p className="mt-1 text-sm text-zinc-600">
                            Calculator rank #{winner?.rank ?? "—"} · Score {winner ? Math.round(toNumber(winner.score)) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.16em] text-zinc-500">
                              <th className="py-3 pr-3">Rank</th>
                              <th className="py-3 pr-3">Horse</th>
                              <th className="py-3 pr-3">Score</th>
                              <th className="py-3 pr-3">Win %</th>
                              <th className="py-3 pr-3">Place %</th>
                              <th className="py-3 pr-3">Finished</th>
                            </tr>
                          </thead>
                          <tbody>
                            {race.rows.map((row) => (
                              <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                                <td className="py-3 pr-3 font-semibold">#{row.rank}</td>
                                <td className="py-3 pr-3 font-semibold text-zinc-950">{row.horse?.horse_name || "Unknown"}</td>
                                <td className="py-3 pr-3">{Math.round(toNumber(row.score))}</td>
                                <td className="py-3 pr-3">{row.win_percent}%</td>
                                <td className="py-3 pr-3">{row.place_percent}%</td>
                                <td className="py-3 pr-3">
                                  <Badge tone={row.finishing_position === 1 ? "green" : row.finishing_position && row.finishing_position <= 3 ? "blue" : "rose"}>
                                    {row.finishing_position ?? "—"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="mt-3 text-xs text-zinc-500">
                        Snapshot settled: {formatDateTime(race.rows[0]?.settled_at)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">No settled calculator predictions yet.</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Once races are published and then resulted, the calculator report will fill in here.
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
