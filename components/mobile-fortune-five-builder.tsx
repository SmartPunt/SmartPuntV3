"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  createFortuneFiveAction,
} from "@/lib/actions";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  status: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  runner_number: number | null;
  barrier: number | null;
  scratched: boolean | null;
};

type Horse = {
  id: number;
  horse_name: string;
};

type DayDates = {
  today: string;
  tomorrow: string;
};

type SelectedDay =
  keyof DayDates;

type LegState = {
  raceId: string;
  runnerId: string;
  betType: "Win" | "Place";
};

function createEmptyLeg(): LegState {
  return {
    raceId: "",
    runnerId: "",
    betType: "Win",
  };
}

export default function MobileFortuneFiveBuilder({
  meetings,
  races,
  runners,
  horses,
  dayDates,
}: {
  meetings: Meeting[];
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  dayDates: DayDates;
}) {
  const [
    selectedDay,
    setSelectedDay,
  ] =
    useState<SelectedDay>(
      "today",
    );

  const [
    title,
    setTitle,
  ] = useState(
    "The Maverick’s Fortune on 5",
  );

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    legs,
    setLegs,
  ] = useState<LegState[]>([
    createEmptyLeg(),
    createEmptyLeg(),
    createEmptyLeg(),
    createEmptyLeg(),
    createEmptyLeg(),
  ]);

  const activeDate =
    dayDates[selectedDay];

  const meetingMap =
    useMemo(
      () =>
        new Map(
          meetings.map(
            (meeting) => [
              Number(
                meeting.id,
              ),
              meeting,
            ],
          ),
        ),
      [meetings],
    );

  const horseMap =
    useMemo(
      () =>
        new Map(
          horses.map(
            (horse) => [
              Number(
                horse.id,
              ),
              horse,
            ],
          ),
        ),
      [horses],
    );

  const availableRaceIds =
    useMemo(() => {
      const activeMeetingIds =
        new Set(
          meetings
            .filter(
              (meeting) =>
                meeting.meeting_date ===
                activeDate,
            )
            .map(
              (meeting) =>
                Number(
                  meeting.id,
                ),
            ),
        );

      return new Set(
        races
          .filter(
            (race) =>
              activeMeetingIds.has(
                Number(
                  race.meeting_id,
                ),
              ),
          )
          .map(
            (race) =>
              Number(race.id),
          ),
      );
    }, [
      activeDate,
      meetings,
      races,
    ]);

  const dayRaces =
    useMemo(
      () =>
        races
          .filter(
            (race) =>
              availableRaceIds.has(
                Number(
                  race.id,
                ),
              ),
          )
          .sort(
            (a, b) => {
              const meetingA =
                meetingMap.get(
                  Number(
                    a.meeting_id,
                  ),
                );

              const meetingB =
                meetingMap.get(
                  Number(
                    b.meeting_id,
                  ),
                );

              const meetingGap =
                String(
                  meetingA?.meeting_name ||
                    "",
                ).localeCompare(
                  String(
                    meetingB?.meeting_name ||
                      "",
                  ),
                );

              if (
                meetingGap !== 0
              ) {
                return meetingGap;
              }

              return (
                Number(
                  a.race_number,
                ) -
                Number(
                  b.race_number,
                )
              );
            },
          ),
      [
        availableRaceIds,
        meetingMap,
        races,
      ],
    );

  function updateLeg(
    index: number,
    update:
      Partial<LegState>,
  ) {
    setLegs(
      (current) =>
        current.map(
          (leg, legIndex) =>
            legIndex === index
              ? {
                  ...leg,
                  ...update,
                }
              : leg,
        ),
    );
  }

  function resetLegs() {
    setLegs([
      createEmptyLeg(),
      createEmptyLeg(),
      createEmptyLeg(),
      createEmptyLeg(),
      createEmptyLeg(),
    ]);
  }

  const selectedRunnerIds =
    new Set(
      legs
        .map((leg) =>
          Number(
            leg.runnerId,
          ),
        )
        .filter(Boolean),
    );

  const completeLegCount =
    legs.filter(
      (leg) =>
        leg.raceId &&
        leg.runnerId,
    ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.22),transparent_30%),linear-gradient(180deg,#030303_0%,#09090b_50%,#020617_100%)] px-3 py-4 text-white">
      <div className="mx-auto max-w-[460px]">
        <header className="sticky top-2 z-30 overflow-hidden rounded-[1.75rem] border border-amber-300/30 bg-black/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <img
              src="/maverick/maverick-shield.png"
              alt="The Maverick"
              className="h-14 w-14 shrink-0 object-contain"
            />

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
                The Maverick
              </p>

              <h1 className="mt-1 text-xl font-black">
                Fortune on 5
              </h1>
            </div>

            <Link
              href="/mobile-admin"
              className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white"
            >
              Admin Home
            </Link>
          </div>
        </header>

        <main className="mt-4 space-y-4 pb-12">
          <section className="rounded-[1.75rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(120,53,15,0.22),rgba(0,0,0,0.92))] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Build the five
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Choose five different runners. Each leg can be a Win or Place selection.
            </p>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-xs font-bold text-zinc-300">
                Legs selected
              </span>

              <span
                className={`text-lg font-black ${
                  completeLegCount === 5
                    ? "text-emerald-300"
                    : "text-amber-300"
                }`}
              >
                {completeLegCount}/5
              </span>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/70 p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(
                    "today",
                  );
                  resetLegs();
                }}
                className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] ${
                  selectedDay ===
                  "today"
                    ? "border-amber-300 bg-amber-300 text-black"
                    : "border-white/10 bg-white/5 text-zinc-300"
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDay(
                    "tomorrow",
                  );
                  resetLegs();
                }}
                className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] ${
                  selectedDay ===
                  "tomorrow"
                    ? "border-amber-300 bg-amber-300 text-black"
                    : "border-white/10 bg-white/5 text-zinc-300"
                }`}
              >
                Tomorrow
              </button>
            </div>
          </section>

          <form
            action={
              createFortuneFiveAction
            }
            className="space-y-4"
          >
            <input
              type="hidden"
              name="return_to"
              value="/mobile-admin/fortune-on-5"
            />

            <input
              type="hidden"
              name="published_date"
              value={activeDate}
            />

            <section className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                  Title
                </span>

                <input
                  name="title"
                  value={title}
                  onChange={(
                    event,
                  ) =>
                    setTitle(
                      event.target.value,
                    )
                  }
                  required
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                  Maverick Notes
                </span>

                <textarea
                  name="description"
                  value={
                    description
                  }
                  onChange={(
                    event,
                  ) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder="Optional Fortune on 5 commentary..."
                  className="mt-2 min-h-[100px] w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-amber-300"
                />
              </label>
            </section>

            {legs.map(
              (
                leg,
                index,
              ) => {
                const race =
                  dayRaces.find(
                    (item) =>
                      String(
                        item.id,
                      ) ===
                      leg.raceId,
                  ) || null;

                const raceRunners =
                  race
                    ? runners
                        .filter(
                          (runner) =>
                            Number(
                              runner.race_id,
                            ) ===
                              Number(
                                race.id,
                              ) &&
                            runner.scratched !==
                              true,
                        )
                        .sort(
                          (
                            a,
                            b,
                          ) =>
                            Number(
                              a.runner_number ||
                                999,
                            ) -
                            Number(
                              b.runner_number ||
                                999,
                            ),
                        )
                    : [];

                return (
                  <section
                    key={index}
                    className={`rounded-[1.75rem] border p-4 ${
                      leg.runnerId
                        ? "border-amber-300/35 bg-amber-300/[0.07]"
                        : "border-white/10 bg-black/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                          Leg{" "}
                          {index + 1}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          Select race, horse and bet type
                        </p>
                      </div>

                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${
                          leg.runnerId
                            ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-300"
                            : "border-white/15 bg-white/5 text-zinc-500"
                        }`}
                      >
                        {leg.runnerId
                          ? "✓"
                          : index +
                            1}
                      </span>
                    </div>

                    <label className="mt-4 block">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                        Race
                      </span>

                      <select
                        value={
                          leg.raceId
                        }
                        onChange={(
                          event,
                        ) =>
                          updateLeg(
                            index,
                            {
                              raceId:
                                event
                                  .target
                                  .value,
                              runnerId:
                                "",
                            },
                          )
                        }
                        required
                        className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
                      >
                        <option value="">
                          Select race
                        </option>

                        {dayRaces.map(
                          (
                            item,
                          ) => {
                            const meeting =
                              meetingMap.get(
                                Number(
                                  item.meeting_id,
                                ),
                              );

                            return (
                              <option
                                key={
                                  item.id
                                }
                                value={String(
                                  item.id,
                                )}
                              >
                                {meeting?.meeting_name ||
                                  "Meeting"}{" "}
                                R
                                {
                                  item.race_number
                                }{" "}
                                {item.race_name ||
                                  ""}
                              </option>
                            );
                          },
                        )}
                      </select>
                    </label>

                    <label className="mt-3 block">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                        Horse
                      </span>

                      <select
                        name={`leg_${index + 1}_race_runner_id`}
                        value={
                          leg.runnerId
                        }
                        disabled={
                          !leg.raceId
                        }
                        onChange={(
                          event,
                        ) =>
                          updateLeg(
                            index,
                            {
                              runnerId:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        required
                        className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300 disabled:opacity-40"
                      >
                        <option value="">
                          {leg.raceId
                            ? "Select horse"
                            : "Select race first"}
                        </option>

                        {raceRunners.map(
                          (
                            runner,
                          ) => {
                            const horse =
                              horseMap.get(
                                Number(
                                  runner.horse_id,
                                ),
                              );

                            const alreadyUsed =
                              selectedRunnerIds.has(
                                Number(
                                  runner.id,
                                ),
                              ) &&
                              Number(
                                leg.runnerId,
                              ) !==
                                Number(
                                  runner.id,
                                );

                            return (
                              <option
                                key={
                                  runner.id
                                }
                                value={String(
                                  runner.id,
                                )}
                                disabled={
                                  alreadyUsed
                                }
                              >
                                {runner.runner_number
                                  ? `#${runner.runner_number} `
                                  : ""}
                                {horse?.horse_name ||
                                  "Unknown horse"}
                                {alreadyUsed
                                  ? " — already selected"
                                  : ""}
                              </option>
                            );
                          },
                        )}
                      </select>
                    </label>

                    <div className="mt-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                        Bet Type
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(
                          [
                            "Win",
                            "Place",
                          ] as const
                        ).map(
                          (
                            betType,
                          ) => (
                            <label
                              key={
                                betType
                              }
                              className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] ${
                                leg.betType ===
                                betType
                                  ? "border-amber-300 bg-amber-300 text-black"
                                  : "border-white/10 bg-white/5 text-zinc-300"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`leg_${index + 1}_bet_type`}
                                value={
                                  betType
                                }
                                checked={
                                  leg.betType ===
                                  betType
                                }
                                onChange={() =>
                                  updateLeg(
                                    index,
                                    {
                                      betType,
                                    },
                                  )
                                }
                                className="sr-only"
                              />

                              {betType}
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                  </section>
                );
              },
            )}

            <section className="rounded-[1.75rem] border border-amber-300/25 bg-black/75 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                Fortune on 5 Review
              </p>

              <div className="mt-3 space-y-2">
                {legs.map(
                  (
                    leg,
                    index,
                  ) => {
                    const runner =
                      runners.find(
                        (
                          item,
                        ) =>
                          String(
                            item.id,
                          ) ===
                          leg.runnerId,
                      );

                    const horse =
                      runner
                        ? horseMap.get(
                            Number(
                              runner.horse_id,
                            ),
                          )
                        : null;

                    const race =
                      runner
                        ? races.find(
                            (
                              item,
                            ) =>
                              Number(
                                item.id,
                              ) ===
                              Number(
                                runner.race_id,
                              ),
                          )
                        : null;

                    const meeting =
                      race
                        ? meetingMap.get(
                            Number(
                              race.meeting_id,
                            ),
                          )
                        : null;

                    return (
                      <div
                        key={
                          index
                        }
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-xs font-black text-black">
                          {index +
                            1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-white">
                            {horse?.horse_name ||
                              "Not selected"}
                          </p>

                          {race &&
                          meeting ? (
                            <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-500">
                              {
                                meeting.meeting_name
                              }{" "}
                              R
                              {
                                race.race_number
                              }
                            </p>
                          ) : null}
                        </div>

                        <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase text-amber-200">
                          {
                            leg.betType
                          }
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </section>

            <button
              type="submit"
              disabled={
                completeLegCount !==
                5
              }
              className="w-full rounded-[1.4rem] bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-black shadow-[0_18px_45px_rgba(245,158,11,0.20)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publish Fortune on 5
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
