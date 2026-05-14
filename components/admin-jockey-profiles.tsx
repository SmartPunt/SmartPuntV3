"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  deleteJockeyProfileAction,
  upsertJockeyProfileAction,
  signOutAction,
} from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";

type JockeyProfile = {
  id: number;
  jockey_name: string;
  normalised_name: string;
  state: string | null;
  category: string | null;
  rides: number;
  wins: number;
  seconds: number;
  thirds: number;
  strike_rate: number;
  place_rate: number;
  rating: number;
  manual_rating: number | null;
  confidence_tag: string | null;
  notes: string | null;
};

type JockeyRun = {
  id: number;
  jockey_name: string | null;
  finishing_position: number | null;
  settled_at: string | null;
  race?: {
    id: number;
    race_number: number;
    race_name: string;
    meeting?: {
      id: number;
      meeting_name: string;
      meeting_date: string;
      state: string | null;
    } | null;
  } | null;
};

function normaliseName(value: string) {
  return String(value || "").trim().toLowerCase();
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function getJockeyStats(profile: JockeyProfile, jockeyRuns: JockeyRun[]) {
  const key = normaliseName(profile.jockey_name);

  const runs = jockeyRuns
    .filter((run) => normaliseName(run.jockey_name || "") === key)
    .sort((a, b) => {
      const aTime = a.settled_at ? new Date(a.settled_at).getTime() : 0;
      const bTime = b.settled_at ? new Date(b.settled_at).getTime() : 0;
      return bTime - aTime;
    });

  const wins = runs.filter((run) => run.finishing_position === 1).length;
  const places = runs.filter(
    (run) =>
      run.finishing_position !== null &&
      run.finishing_position !== undefined &&
      run.finishing_position <= 3,
  ).length;

  const states = runs
    .map((run) => run.race?.meeting?.state)
    .filter((state): state is string => Boolean(state));

  const stateCounts = new Map<string, number>();

  states.forEach((state) => {
    stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
  });

  const mainState =
    Array.from(stateCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    profile.state ||
    "—";

  const last10 = runs
    .slice(0, 10)
    .map((run) =>
      run.finishing_position !== null && run.finishing_position !== undefined
        ? String(run.finishing_position)
        : "—",
    )
    .join(" • ");

  return {
    runs,
    rides: runs.length,
    wins,
    places,
    strikeRate: percent(wins, runs.length),
    placeRate: percent(places, runs.length),
    mainState,
    last10: last10 || "No resulted rides yet",
  };
}

export default function AdminJockeyProfiles({
  initialProfiles,
  jockeyRuns,
}: {
  initialProfiles: JockeyProfile[];
  jockeyRuns: JockeyRun[];
}) {
  const [search, setSearch] = useState("");

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return initialProfiles;

    return initialProfiles.filter((profile) =>
      profile.jockey_name.toLowerCase().includes(term),
    );
  }, [initialProfiles, search]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.08)_30%,rgba(0,0,0,0.60)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Jockey Profiles</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link href="/admin/calculator" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                  Calculator Lab
                </Link>
                <Link href="/" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                  Back to Admin
                </Link>
                <form action={signOutAction}>
                  <button className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30">
                    Log Out
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                SmartPunt jockey intelligence
              </h1>
              <p className="mt-2 text-sm text-zinc-200 lg:text-base">
                Rate jockeys manually while SmartPunt builds its own race history.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{initialProfiles.length} jockeys</Badge>
                <Badge tone="blue">Manual ratings active</Badge>
                <Badge tone="amber">Feeds calculator scoring</Badge>
              </div>
            </div>
          </div>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <h2 className="text-xl font-semibold">Add / update jockey</h2>
            <p className="text-sm text-zinc-500">
              Manual rating is your head-tipper judgement. 55 is neutral, 70+ is strong, 85+ is elite.
            </p>

            <form action={upsertJockeyProfileAction} className="mt-5 grid gap-4 md:grid-cols-4">
              <input name="jockey_name" placeholder="J McDonald" className="rounded-2xl border border-amber-200/30 px-4 py-3" />
              <input name="manual_rating" type="number" min="1" max="100" placeholder="Manual rating" className="rounded-2xl border border-amber-200/30 px-4 py-3" />
              <input name="confidence_tag" placeholder="Elite / Underrated / Wet rider" className="rounded-2xl border border-amber-200/30 px-4 py-3" />
              <button type="submit" className="rounded-2xl bg-black px-4 py-3 font-semibold text-amber-300">
                Save Jockey
              </button>

              <textarea
                name="notes"
                placeholder="Notes..."
                className="min-h-[90px] rounded-2xl border border-amber-200/30 px-4 py-3 md:col-span-4"
              />
            </form>
          </div>
        </Panel>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Jockey list</h2>
                <p className="text-sm text-zinc-500">
                  Search and tune jockey ratings.
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jockey..."
                className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 md:w-[320px]"
              />
            </div>

            <div className="mt-5 space-y-4">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile) => {
                  const stats = getJockeyStats(profile, jockeyRuns);

                  return (
                    <div key={profile.id} className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
                      <form action={upsertJockeyProfileAction}>
                        <input type="hidden" name="id" value={profile.id} />

                        <div className="grid gap-4 md:grid-cols-[1.2fr_0.7fr_0.9fr_auto]">
                          <input
                            name="jockey_name"
                            defaultValue={profile.jockey_name}
                            className="rounded-2xl border border-zinc-200 px-4 py-3 font-semibold"
                          />

                          <input
                            name="manual_rating"
                            type="number"
                            min="1"
                            max="100"
                            defaultValue={profile.manual_rating ?? ""}
                            placeholder="Manual rating"
                            className="rounded-2xl border border-zinc-200 px-4 py-3"
                          />

                          <input
                            name="confidence_tag"
                            defaultValue={profile.confidence_tag ?? ""}
                            placeholder="Tag"
                            className="rounded-2xl border border-zinc-200 px-4 py-3"
                          />

                          <button type="submit" className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300">
                            Save
                          </button>
                        </div>

                        <textarea
                          name="notes"
                          defaultValue={profile.notes ?? ""}
                          placeholder="Notes..."
                          className="mt-3 min-h-[80px] w-full rounded-2xl border border-zinc-200 px-4 py-3"
                        />
                      </form>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Last 10
                          </p>
                          <p className="mt-2 text-sm font-bold text-zinc-900">
                            {stats.last10}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            SmartPunt
                          </p>
                          <p className="mt-2 text-sm font-bold text-zinc-900">
                            {stats.rides} rides · {stats.wins} wins · {stats.places} places
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Strike
                          </p>
                          <p className="mt-2 text-sm font-bold text-zinc-900">
                            {stats.strikeRate}% win · {stats.placeRate}% place
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Main state
                          </p>
                          <p className="mt-2 text-sm font-bold text-zinc-900">
                            {stats.mainState}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="blue">Imported {profile.rating ?? 55}</Badge>
                        <Badge tone="amber">Manual {profile.manual_rating ?? "—"}</Badge>
                        <Badge tone="green">
                          Final approx{" "}
                          {profile.manual_rating !== null && profile.manual_rating !== undefined
                            ? Math.round(Number(profile.rating || 55) * 0.55 + Number(profile.manual_rating) * 0.45)
                            : profile.rating || 55}
                        </Badge>
                        {profile.confidence_tag ? <Badge tone="slate">{profile.confidence_tag}</Badge> : null}

                        <form action={deleteJockeyProfileAction} className="ml-auto">
                          <input type="hidden" name="id" value={profile.id} />
                          <button className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                  No jockey profiles found.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
