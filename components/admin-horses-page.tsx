"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import { usePathname } from "next/navigation";
import { Badge, Panel } from "@/components/ui";

function NavLink({
  href,
  label,
  currentPath,
}: {
  href: string;
  label: string;
  currentPath: string;
}) {
  const isActive = currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold backdrop-blur-sm transition ${
        isActive
          ? "border-amber-300 bg-amber-300/20 text-amber-200"
          : "border-white/15 bg-black/45 text-white hover:bg-white/15"
      }`}
    >
      {label}
    </Link>
  );
}

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
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

type SortMode = "alphabetical" | "newest" | "most_used";

type HorseRow = Horse & {
  appearances: number;
  latestRunnerDate: string;
  latestJockey: string | null;
  latestTrainer: string | null;
  latestWeight: string | null;
  latestRaceLabel: string | null;
  latestMeetingLabel: string | null;
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

function formatHorseMeta(horse: Horse) {
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

export default function AdminHorsesPage({
  currentUser,
  initialHorses,
  initialRunners,
  initialRaces,
  initialMeetings,
}: {
  currentUser: any;
  initialHorses: Horse[];
  initialRunners: Runner[];
  initialRaces: Race[];
  initialMeetings: Meeting[];
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical");

  const horseRows = useMemo<HorseRow[]>(() => {
    const rows: HorseRow[] = initialHorses.map((horse) => {
      const runners = initialRunners.filter((runner) => runner.horse_id === horse.id);
      const latestRunner = runners[0] || null;
      const latestRace = latestRunner
        ? initialRaces.find((race) => race.id === latestRunner.race_id) || null
        : null;
      const latestMeeting = latestRace
        ? initialMeetings.find((meeting) => meeting.id === latestRace.meeting_id) || null
        : null;

      return {
        ...horse,
        appearances: runners.length,
        latestRunnerDate: latestRunner?.created_at || horse.created_at,
        latestJockey: latestRunner?.jockey_name || null,
        latestTrainer: latestRunner?.trainer_name || null,
        latestWeight:
          latestRunner?.weight_kg !== null && latestRunner?.weight_kg !== undefined
            ? `${latestRunner.weight_kg}kg`
            : null,
        latestRaceLabel: latestRace
          ? `R${latestRace.race_number} ${latestRace.race_name}`
          : null,
        latestMeetingLabel: latestMeeting
          ? `${latestMeeting.meeting_name} · ${latestMeeting.meeting_date}`
          : null,
      };
    });

    const filtered = rows.filter((horseRow: HorseRow) =>
      horseRow.horse_name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    if (sortMode === "most_used") {
      return filtered.sort(
        (a: HorseRow, b: HorseRow) =>
          b.appearances - a.appearances || a.horse_name.localeCompare(b.horse_name),
      );
    }

    if (sortMode === "newest") {
      return filtered.sort(
        (a: HorseRow, b: HorseRow) =>
          new Date(b.latestRunnerDate || b.created_at).getTime() -
          new Date(a.latestRunnerDate || a.created_at).getTime(),
      );
    }

    return filtered.sort((a: HorseRow, b: HorseRow) =>
      a.horse_name.localeCompare(b.horse_name),
    );
  }, [initialHorses, initialMeetings, initialRaces, initialRunners, search, sortMode]);

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
              <Badge tone="amber">Saved Horses</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <NavLink href="/race-builder" label="Race Builder" currentPath={pathname} />
                <NavLink href="/current-races" label="Current Races" currentPath={pathname} />
                <NavLink href="/race-archive" label="Race Archive" currentPath={pathname} />
                <NavLink href="/admin/horses" label="Saved Horses" currentPath={pathname} />

                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
<div className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
      Fortune on 5 current races
    </h1>
<p className="text-sm text-zinc-200 lg:text-base">
  Your saved horse master list, built from Race Builder and runner history.
</p>
  </div>

  <div className="flex items-center gap-2">
    <Link
      href="/"
      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
    >
      Back to Dashboard
    </Link>

    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
      >
        Log Out
      </button>
    </form>
  </div>
</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{initialHorses.length} horses saved</Badge>
                <Badge tone="blue">{initialRunners.length} runner records</Badge>
                <Badge tone="amber">Admin only</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Saved Horses</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{initialHorses.length}</p>
                <Badge tone="amber">Master list</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Runner Records</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{initialRunners.length}</p>
                <Badge tone="blue">History</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Visible Rows</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{horseRows.length}</p>
                <Badge tone="green">Filtered</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="grid gap-4 p-6 text-zinc-950 md:grid-cols-[1fr_220px]">
            <div>
              <label className="text-sm font-medium text-zinc-700">Search horses</label>
              <div className="mt-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search saved horse name"
                  className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700">Sort by</label>
              <div className="mt-2">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                >
                  <option value="alphabetical">Alphabetical</option>
                  <option value="newest">Newest activity</option>
                  <option value="most_used">Most used</option>
                </select>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Horse library</h2>
                <p className="text-sm text-zinc-500">
                  Click into any horse to inspect its saved runner history and build out form later.
                </p>
              </div>
              <Badge tone="amber">{horseRows.length} shown</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {horseRows.length > 0 ? (
                horseRows.map((horse) => (
                  <Link
                    key={horse.id}
                    href={`/admin/horses/${horse.id}`}
                    className="block rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-zinc-950">
                          {horse.horse_name}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatHorseMeta(horse) || "Profile still building"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          Added {formatDate(horse.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge tone="blue">{horse.appearances} appearances</Badge>
                        {horse.latestJockey ? (
                          <Badge tone="slate">Jockey: {horse.latestJockey}</Badge>
                        ) : null}
                        <Badge tone="amber">Open Profile</Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Latest meeting
                        </p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {horse.latestMeetingLabel || "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Latest race
                        </p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {horse.latestRaceLabel || "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Latest trainer
                        </p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {horse.latestTrainer || "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Latest weight
                        </p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                          {horse.latestWeight || "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  No horses matched that search.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
