"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
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
  form_last_3?: string | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function formatHorseMeta(horse: Horse | null) {
  if (!horse) return "";
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

function formatMeetingDate(value: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSettledAt(value?: string | null) {
  if (!value) return "Not settled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortRunnersByResult(runners: Runner[]) {
  return [...runners].sort((a, b) => {
    const aPos =
      a.finishing_position !== null && a.finishing_position !== undefined
        ? a.finishing_position
        : 9999;
    const bPos =
      b.finishing_position !== null && b.finishing_position !== undefined
        ? b.finishing_position
        : 9999;

    if (aPos !== bPos) return aPos - bPos;

    const aHorse = a.horse_id || 0;
    const bHorse = b.horse_id || 0;
    return aHorse - bHorse;
  });
}

export default function RaceArchivePage({
  currentUser,
  initialMeetings,
  initialRaces,
  initialHorses,
  initialRunners,
}: {
  currentUser: any;
  initialMeetings: Meeting[];
  initialRaces: Race[];
  initialHorses: Horse[];
  initialRunners: Runner[];
}) {
  const [meetingFilter, setMeetingFilter] = useState("all");
  const isAdmin = currentUser?.role === "admin";

  const closedRaces = useMemo(
    () => initialRaces.filter((race) => race.status === "closed"),
    [initialRaces],
  );

  const groupedMeetings = useMemo(() => {
    return initialMeetings
      .map((meeting) => {
        const meetingRaces = closedRaces.filter((race) => race.meeting_id === meeting.id);
        return {
          ...meeting,
          races: meetingRaces,
        };
      })
      .filter((meeting) => meeting.races.length > 0);
  }, [closedRaces, initialMeetings]);

  const filteredMeetings = useMemo(() => {
    if (meetingFilter === "all") return groupedMeetings;
    return groupedMeetings.filter((meeting) => String(meeting.id) === meetingFilter);
  }, [groupedMeetings, meetingFilter]);

  function runnersForRace(raceId: number) {
    return sortRunnersByResult(
      initialRunners.filter((runner) => runner.race_id === raceId),
    );
  }

  function findHorse(horseId: number) {
    return initialHorses.find((horse) => horse.id === horseId) || null;
  }

  function findHorseName(horseId: number) {
    return findHorse(horseId)?.horse_name || "Unknown horse";
  }

  function getTotalSettledRunners() {
    return initialRunners.filter((runner) =>
      closedRaces.some((race) => race.id === runner.race_id),
    ).length;
  }

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
              <Badge tone="rose">Race Archive</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isAdmin ? (
                  <>
                    <Link
                      href="/admin/race-builder"
                      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                    >
                      Race Builder
                    </Link>
                    <Link
                      href="/current-races"
                      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                    >
                      Current Races
                    </Link>
                    <Link
                      href="/"
                      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                    >
                      Back to Admin
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/current-races"
                      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                    >
                      Current Races
                    </Link>
                    <Link
                      href="/"
                      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                    >
                      Back to Dashboard
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Fortune on 5 race archive
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Closed races live here. This is your clean historical record of settled fields.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="rose">Closed races only</Badge>
                <Badge tone="blue">Read only</Badge>
                <Badge tone="amber">
                  {isAdmin ? "Historical form source" : "Subscriber archive view"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Archived races
              </p>
              <p className="mt-2 text-3xl font-bold">{closedRaces.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Completed races now living outside the live workflow.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Meetings in archive
              </p>
              <p className="mt-2 text-3xl font-bold">{groupedMeetings.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Meetings that already have closed races in the books.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Settled runners
              </p>
              <p className="mt-2 text-3xl font-bold">{getTotalSettledRunners()}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Historical runner records feeding your horse database.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-6">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Archive board</h2>
                  <p className="text-sm text-zinc-500">
                    Read-only race history, sorted by meeting and race.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-zinc-600">Meeting</label>
                  <select
                    value={meetingFilter}
                    onChange={(e) => setMeetingFilter(e.target.value)}
                    className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300"
                  >
                    <option value="all">All meetings</option>
                    {groupedMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {meeting.meeting_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredMeetings.length > 0 ? (
                <div className="space-y-6">
                  {filteredMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-[28px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-bold tracking-tight text-zinc-950">
                            {meeting.meeting_name}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {formatMeetingDate(meeting.meeting_date)}
                            {meeting.track_condition ? ` · ${meeting.track_condition}` : ""}
                          </p>
                        </div>

                        <Badge tone="rose">{meeting.races.length} archived races</Badge>
                      </div>

                      <div className="mt-5 space-y-5">
                        {meeting.races.map((race) => {
                          const raceRunners = runnersForRace(race.id);
                          const settledAt =
                            raceRunners.find((runner) => runner.settled_at)?.settled_at || null;

                          return (
                            <details
                              key={race.id}
                              className="group rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                            >
                              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-semibold text-zinc-950">
                                      R{race.race_number} {race.race_name}
                                    </p>
                                    <Badge tone="rose">closed</Badge>
                                    <Badge tone="blue">{raceRunners.length} runners</Badge>
                                  </div>

                                  <p className="mt-1 text-sm text-zinc-500">
                                    {race.distance_m || "—"}m · Settled {formatSettledAt(settledAt)}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition group-open:bg-amber-50 group-open:text-amber-900">
                                  View results
                                </div>
                              </summary>

                              <div className="mt-5 space-y-3 border-t border-zinc-200 pt-5">
                                {raceRunners.length > 0 ? (
                                  raceRunners.map((runner) => {
                                    const horse = findHorse(runner.horse_id);

                                    return (
                                      <div
                                        key={runner.id}
                                        className="rounded-2xl border border-zinc-200 bg-white p-4"
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold text-zinc-950">
                                              {findHorseName(runner.horse_id)}
                                            </p>
                                            <p className="text-sm text-zinc-500">
                                              {formatHorseMeta(horse) || "Horse profile not loaded yet"}
                                            </p>
                                            <p className="mt-1 text-sm text-zinc-500">
                                              Jockey: {runner.jockey_name || "—"}
                                              {runner.is_apprentice
                                                ? ` (Apprentice${
                                                    runner.apprentice_claim_kg !== null &&
                                                    runner.apprentice_claim_kg !== undefined
                                                      ? `, -${runner.apprentice_claim_kg}kg`
                                                      : ""
                                                  })`
                                                : ""}
                                              {" · "}Trainer: {runner.trainer_name || "—"}
                                            </p>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2">
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
                                            ) : (
                                              <Badge tone="slate">Fin: —</Badge>
                                            )}

                                            {runner.starting_price !== null &&
                                            runner.starting_price !== undefined ? (
                                              <Badge tone="amber">SP ${runner.starting_price}</Badge>
                                            ) : (
                                              <Badge tone="slate">SP —</Badge>
                                            )}

                                            {runner.won ? <Badge tone="green">Won</Badge> : null}
                                            {runner.placed ? <Badge tone="blue">Placed</Badge> : null}
                                            {runner.barrier ? (
                                              <Badge tone="blue">Barrier {runner.barrier}</Badge>
                                            ) : null}
                                            {runner.weight_kg !== null && runner.weight_kg !== undefined ? (
                                              <Badge tone="amber">{runner.weight_kg}kg</Badge>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                              Last 6
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                                              {runner.form_last_6 || "—"}
                                            </p>
                                          </div>

                                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                              Track form
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                                              {runner.track_form_last_6 || "—"}
                                            </p>
                                          </div>

                                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                              Distance form
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                                              {runner.distance_form_last_6 || "—"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-sm text-zinc-500">
                                    No runners were found for this archived race.
                                  </p>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">No archived races yet.</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Once races are settled and closed, they’ll land here automatically.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What archive does</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Stores closed races only</p>
                <p>• Keeps old meetings tidy</p>
                <p>• Shows settled runner results</p>
                <p>• Gives you clean historical review</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Why it matters</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Stops Current Races getting cluttered</p>
                <p>• Protects your old race history</p>
                <p>• Supports the horse form engine</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Next build step</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Scratch horse from Current Races</p>
                <p>• Edit runner details after publish</p>
                <p>• Auto-prefill horse form on future race builds</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
