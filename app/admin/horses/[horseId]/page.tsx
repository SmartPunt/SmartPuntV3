import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;

  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;

  created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  finishing_position: number | null;
  starting_price: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type EnrichedRunner = Runner & {
  race: Race | null;
  meeting: Meeting | null;
};

type StatRow = {
  label: string;
  runs: number;
  wins: number;
  places: number;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFormLine(runs: EnrichedRunner[]) {
  if (!runs.length) return "—";

  return runs
    .slice(0, 6)
    .map((run) => {
      if (run.finishing_position === null || run.finishing_position === undefined) return "—";
      return String(run.finishing_position);
    })
    .join(" • ");
}

function formatHorseMeta(horse: Horse) {
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

function getConditionBucket(condition?: string | null) {
  const value = String(condition || "").toLowerCase();

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  return "Other";
}

function getDistanceBucket(distance?: number | null) {
  if (!distance) return "Unknown";

  if (distance <= 1200) return "1000–1200m";
  if (distance <= 1400) return "1201–1400m";
  if (distance <= 1600) return "1401–1600m";
  if (distance <= 1800) return "1601–1800m";
  if (distance <= 2200) return "1801–2200m";
  return "2200m+";
}

function buildStatRows(
  runs: EnrichedRunner[],
  getLabel: (run: EnrichedRunner) => string | null,
): StatRow[] {
  const map = new Map<string, StatRow>();

  runs.forEach((run) => {
    const label = getLabel(run);
    if (!label) return;

    const current = map.get(label) || {
      label,
      runs: 0,
      wins: 0,
      places: 0,
    };

    current.runs += 1;
    if (run.finishing_position === 1) current.wins += 1;
    if (
      run.finishing_position !== null &&
      run.finishing_position !== undefined &&
      run.finishing_position <= 3
    ) {
      current.places += 1;
    }

    map.set(label, current);
  });

  return Array.from(map.values()).sort((a, b) => b.runs - a.runs || a.label.localeCompare(b.label));
}

function getRaceStatusTone(status?: Race["status"] | null) {
  if (status === "published") return "green";
  if (status === "closed") return "rose";
  return "amber";
}

function StatCard({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: StatRow[];
  emptyLabel: string;
}) {
  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge tone="amber">{rows.length}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {rows.length > 0 ? (
            rows.map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-zinc-900">{row.label}</p>
                  <Badge tone="blue">
                    {row.runs}:{row.wins}-{row.places}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {row.runs} runs • {row.wins} wins • {row.places} places
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ horseId: string }>;
}) {
  const { horseId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const horseIdNumber = Number(horseId);

  if (!horseIdNumber) {
    notFound();
  }

  const supabase = await createClient();

  const { data: horse, error: horseError } = await supabase
    .from("horses")
    .select("*")
    .eq("id", horseIdNumber)
    .maybeSingle();

  if (horseError || !horse) {
    notFound();
  }

  const { data: allRunners } = await supabase
    .from("race_runners")
    .select("*")
    .eq("horse_id", horseIdNumber)
    .order("created_at", { ascending: false });

  const { data: races } = await supabase
    .from("races")
    .select("*")
    .order("meeting_id", { ascending: false })
    .order("race_number", { ascending: true });

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  const runners: Runner[] = allRunners || [];
  const raceList: Race[] = races || [];
  const meetingList: Meeting[] = meetings || [];

  const enrichedRuns: EnrichedRunner[] = runners.map((runner) => {
    const race = raceList.find((item) => item.id === runner.race_id) || null;
    const meeting = race
      ? meetingList.find((item) => item.id === race.meeting_id) || null
      : null;

    return {
      ...runner,
      race,
      meeting,
    };
  });

  const resultedRuns = enrichedRuns.filter(
    (run) => run.finishing_position !== null && run.finishing_position !== undefined,
  );

  const sortedResultedRuns = [...resultedRuns].sort((a, b) => {
    const aDate = a.meeting?.meeting_date
      ? new Date(a.meeting.meeting_date).getTime()
      : 0;
    const bDate = b.meeting?.meeting_date
      ? new Date(b.meeting.meeting_date).getTime()
      : 0;

    if (bDate !== aDate) return bDate - aDate;

    const aRaceNo = a.race?.race_number || 0;
    const bRaceNo = b.race?.race_number || 0;

    return bRaceNo - aRaceNo;
  });

const latestRunner = sortedResultedRuns[0] || enrichedRuns[0] || null;

function parseImportedForm(value?: string | null) {
  const cleaned = String(value || "").trim();

  if (!cleaned || cleaned === "—") return [];

  if (/^[0-9xX]+$/.test(cleaned)) {
    return cleaned
      .split("")
      .map((item: string) => (item.toLowerCase() === "x" ? null : Number(item)))
      .filter((item: number | null): item is number => item !== null && !Number.isNaN(item));
  }

  return cleaned
    .split(/[-•,\s]+/)
    .map((item: string) => Number(item))
    .filter((item: number) => !Number.isNaN(item));
}

function parseImportedRecord(value?: string | null) {
  const cleaned = String(value || "").trim();

  const match = cleaned.match(/^(\d+):([0-9]+),([0-9]+),([0-9]+)$/);

  if (!match) {
    return null;
  }

  const runs = Number(match[1]);
  const wins = Number(match[2]);
  const seconds = Number(match[3]);
  const thirds = Number(match[4]);

  return {
    runs: Number.isNaN(runs) ? 0 : runs,
    wins: Number.isNaN(wins) ? 0 : wins,
    places:
      (Number.isNaN(wins) ? 0 : wins) +
      (Number.isNaN(seconds) ? 0 : seconds) +
      (Number.isNaN(thirds) ? 0 : thirds),
  };
}

const importedFormSource =
  horse.form_last_6 ||
  enrichedRuns.find((runner) => runner.form_last_6)?.form_last_6 ||
  "";

const importedTrackSource =
  horse.track_form_last_6 ||
  enrichedRuns.find((runner) => runner.track_form_last_6)?.track_form_last_6 ||
  "";

const importedDistanceSource =
  horse.distance_form_last_6 ||
  enrichedRuns.find((runner) => runner.distance_form_last_6)?.distance_form_last_6 ||
  "";

const importedFormNumbers = parseImportedForm(importedFormSource);

const totalRuns =
  sortedResultedRuns.length > 0 ? sortedResultedRuns.length : importedFormNumbers.length;

const totalWins =
  sortedResultedRuns.length > 0
    ? sortedResultedRuns.filter((run) => run.finishing_position === 1).length
    : importedFormNumbers.filter((position: number) => position === 1).length;

const totalPlaces =
  sortedResultedRuns.length > 0
    ? sortedResultedRuns.filter(
        (run) =>
          run.finishing_position !== null &&
          run.finishing_position !== undefined &&
          run.finishing_position <= 3,
      ).length
    : importedFormNumbers.filter(
        (position: number) => position >= 1 && position <= 3,
      ).length;

const uniqueJockeys = Array.from(
  new Set(enrichedRuns.map((runner) => runner.jockey_name).filter(Boolean)),
);

const uniqueTrainers = Array.from(
  new Set(enrichedRuns.map((runner) => runner.trainer_name).filter(Boolean)),
);

const importedDistanceRecord = parseImportedRecord(importedDistanceSource);
const importedTrackRecord = parseImportedRecord(importedTrackSource);

const distanceStats =
  sortedResultedRuns.length > 0
    ? buildStatRows(sortedResultedRuns, (run) => getDistanceBucket(run.race?.distance_m))
    : importedDistanceRecord
      ? [
          {
            label: latestRunner?.race?.distance_m
              ? `${latestRunner.race.distance_m}m`
              : "Imported distance form",
            runs: importedDistanceRecord.runs,
            wins: importedDistanceRecord.wins,
            places: importedDistanceRecord.places,
          },
        ]
      : [];

const trackStats =
  sortedResultedRuns.length > 0
    ? buildStatRows(sortedResultedRuns, (run) => run.meeting?.meeting_name || null)
    : importedTrackRecord
      ? [
          {
            label: latestRunner?.meeting?.meeting_name || "Imported track form",
            runs: importedTrackRecord.runs,
            wins: importedTrackRecord.wins,
            places: importedTrackRecord.places,
          },
        ]
      : [];

const conditionStats = buildStatRows(sortedResultedRuns, (run) =>
  getConditionBucket(run.meeting?.track_condition),
);

const recentFormLine =
  sortedResultedRuns.length > 0
    ? formatFormLine(sortedResultedRuns)
    : importedFormSource || "—";
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Horse Profile</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Saved Horses
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  {horse.horse_name}
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
Saved horse profile built from SmartPunt form history.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {profile.full_name || profile.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {horse.sex ? <Badge tone="blue">{horse.sex}</Badge> : null}
                {horse.age !== null && horse.age !== undefined ? (
                  <Badge tone="amber">{horse.age}yo</Badge>
                ) : null}
                <Badge tone="green">{totalRuns} runs</Badge>
                <Badge tone="blue">{totalWins} wins</Badge>
                <Badge tone="amber">{totalPlaces} places</Badge>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Recent form
                </p>
                <p className="mt-2 text-2xl font-bold tracking-wide text-white">
                  {recentFormLine}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Horse Name</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{horse.horse_name}</p>
                <Badge tone="amber">Saved</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Horse Type</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{horse.sex || "—"}</p>
                <Badge tone="blue">Profile</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Age</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">
                  {horse.age !== null && horse.age !== undefined ? `${horse.age}yo` : "—"}
                </p>
                <Badge tone="amber">Profile</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Jockey</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.jockey_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Trainer</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.trainer_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <StatCard
            title="Distance record"
            rows={distanceStats}
            emptyLabel="No resulted distance history yet."
          />
          <StatCard
            title="Track record"
            rows={trackStats}
            emptyLabel="No resulted track history yet."
          />
          <StatCard
            title="Condition record"
            rows={conditionStats}
            emptyLabel="No resulted condition history yet."
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Horse summary</h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Profile
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {formatHorseMeta(horse) || "Profile still being built"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Normalised name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {horse.normalised_name || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Overall record
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {totalRuns}:{totalWins}-{totalPlaces}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Runs : Wins - Places
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Jockeys used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueJockeys.length > 0 ? (
                      uniqueJockeys.map((jockey) => (
                        <Badge key={jockey} tone="blue">
                          {jockey}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Trainers used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueTrainers.length > 0 ? (
                      uniqueTrainers.map((trainer) => (
                        <Badge key={trainer} tone="amber">
                          {trainer}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Runner history</h2>
                  <p className="text-sm text-zinc-500">
                    This is the saved in-app history for this horse from Race Builder.
                  </p>
                </div>
                <Badge tone="green">{enrichedRuns.length} records</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {enrichedRuns.length > 0 ? (
                  enrichedRuns.map((runner) => (
                    <div
                      key={runner.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">
                            {runner.meeting
                              ? `${runner.meeting.meeting_name} · ${runner.meeting.meeting_date}`
                              : "Unknown meeting"}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                            {runner.race
                              ? `R${runner.race.race_number} ${runner.race.race_name}`
                              : "Unknown race"}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {runner.race?.status ? (
                            <Badge tone={getRaceStatusTone(runner.race.status)}>
                              {runner.race.status}
                            </Badge>
                          ) : null}
                          {runner.race?.distance_m ? (
                            <Badge tone="blue">{runner.race.distance_m}m</Badge>
                          ) : null}
                          {runner.meeting?.track_condition ? (
                            <Badge tone="amber">{runner.meeting.track_condition}</Badge>
                          ) : null}
                          {runner.finishing_position !== null &&
                          runner.finishing_position !== undefined ? (
                            <Badge
                              tone={
                                runner.finishing_position === 1
                                  ? "green"
                                  : runner.finishing_position <= 3
                                    ? "blue"
                                    : "rose"
                              }
                            >
                              Fin: {runner.finishing_position}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Jockey
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.jockey_name || "—"}
                          </p>
                          {runner.is_apprentice ? (
                            <p className="mt-1 text-xs text-zinc-600">
                              Apprentice
                              {runner.apprentice_claim_kg !== null &&
                              runner.apprentice_claim_kg !== undefined
                                ? ` · -${runner.apprentice_claim_kg}kg`
                                : ""}
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Trainer
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.trainer_name || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Barrier / Weight
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.barrier ?? "—"} /{" "}
                            {runner.weight_kg !== null && runner.weight_kg !== undefined
                              ? `${runner.weight_kg}kg`
                              : "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Market
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.starting_price !== null && runner.starting_price !== undefined
                              ? `$${runner.starting_price}`
                              : runner.market_price !== null && runner.market_price !== undefined
                                ? `$${runner.market_price}`
                                : "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Settled
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {formatDate(runner.settled_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Last 6
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_6 || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Track form
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.track_form_last_6 || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Distance form
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.distance_form_last_6 || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No runner history saved for this horse yet.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
