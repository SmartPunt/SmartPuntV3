"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteMaverickExoticTipAction,
  upsertMaverickExoticTipAction,
} from "@/lib/actions";

type Meeting = {
  id: number;
  meeting_name: string | null;
  meeting_date: string | null;
};

type Race = {
  id: number;
  meeting_id: number | null;
  race_number: number | null;
  race_name: string | null;
  status?: string | null;
};

type Runner = {
  id: number;
  race_id: number | null;
  horse_id: number | null;
  runner_number?: number | null;
  barrier?: number | null;
  scratched?: boolean | null;
};

type Horse = {
  id: number;
  horse_name: string | null;
};

type ExoticSelection = {
  race_runner_id: number;
  horse_id?: number | null;
  horse?: string | null;
  runner_number?: number | null;
  positions?: number[];
};

type ExoticTip = {
  id: number;
  race_id: number;
  bet_type: "quinella" | "trifecta";
  mode:
    | "all_ways"
    | "positional"
    | null;
  selections: ExoticSelection[];
  created_at?: string | null;
  updated_at?: string | null;
};

type DayDates = {
  today: string;
  tomorrow: string;
};

type SelectedRunnerState = {
  runnerId: number;
  positions: number[];
};

export default function MobileAdminExotics({
  meetings,
  races,
  runners,
  horses,
  existingTips,
  dayDates,
}: {
  meetings: Meeting[];
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  existingTips: ExoticTip[];
  dayDates: DayDates;
}) {
  const router = useRouter();

  const [
    selectedDay,
    setSelectedDay,
  ] = useState<
    "today" | "tomorrow"
  >("today");

  const [
    selectedMeetingId,
    setSelectedMeetingId,
  ] = useState("");

  const [
    selectedRaceId,
    setSelectedRaceId,
  ] = useState("");

  const [
    betType,
    setBetType,
  ] = useState<
    "quinella" | "trifecta"
  >("quinella");

  const [
    trifectaMode,
    setTrifectaMode,
  ] = useState<
    "all_ways" | "positional"
  >("all_ways");

  const [
    selectedRunners,
    setSelectedRunners,
  ] = useState<
    SelectedRunnerState[]
  >([]);

  const [
    editingId,
    setEditingId,
  ] = useState<
    number | null
  >(null);

  const [
    visibleTips,
    setVisibleTips,
  ] = useState<
    ExoticTip[]
  >(existingTips);

  const [
    deletingIds,
    setDeletingIds,
  ] = useState<
    Set<number>
  >(new Set());

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    isPending,
    startTransition,
  ] = useTransition();

  useEffect(() => {
    setVisibleTips(
      existingTips,
    );
  }, [existingTips]);

  const selectedDate =
    selectedDay === "today"
      ? dayDates.today
      : dayDates.tomorrow;

  const availableMeetings =
    useMemo(
      () =>
        meetings.filter(
          (meeting) =>
            meeting.meeting_date ===
            selectedDate,
        ),
      [
        meetings,
        selectedDate,
      ],
    );

  const availableRaces =
    useMemo(() => {
      const meetingId =
        Number(
          selectedMeetingId,
        );

      if (!meetingId) {
        return [];
      }

      return races
        .filter(
          (race) =>
            Number(
              race.meeting_id,
            ) === meetingId,
        )
        .sort(
          (a, b) =>
            Number(
              a.race_number ||
                0,
            ) -
            Number(
              b.race_number ||
                0,
            ),
        );
    }, [
      races,
      selectedMeetingId,
    ]);

  const availableRunners =
    useMemo(() => {
      const raceId =
        Number(
          selectedRaceId,
        );

      if (!raceId) {
        return [];
      }

      return runners
        .filter(
          (runner) =>
            Number(
              runner.race_id,
            ) === raceId &&
            runner.scratched !==
              true,
        )
        .sort(
          (a, b) =>
            Number(
              a.runner_number ||
                999,
            ) -
            Number(
              b.runner_number ||
                999,
            ),
        );
    }, [
      runners,
      selectedRaceId,
    ]);

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

  const raceMap =
    useMemo(
      () =>
        new Map(
          races.map(
            (race) => [
              Number(
                race.id,
              ),
              race,
            ],
          ),
        ),
      [races],
    );

  const selectedMeeting =
    availableMeetings.find(
      (meeting) =>
        String(
          meeting.id,
        ) ===
        selectedMeetingId,
    ) || null;

  const selectedRace =
    availableRaces.find(
      (race) =>
        String(
          race.id,
        ) ===
        selectedRaceId,
    ) || null;

  function clearSelection() {
    setSelectedRunners(
      [],
    );
  }

  function resetBelowDay() {
    setSelectedMeetingId(
      "",
    );
    setSelectedRaceId(
      "",
    );
    clearSelection();
  }

  function resetBelowMeeting() {
    setSelectedRaceId(
      "",
    );
    clearSelection();
  }

  function clearForm() {
    setEditingId(null);
    setSelectedMeetingId(
      "",
    );
    setSelectedRaceId(
      "",
    );
    setBetType(
      "quinella",
    );
    setTrifectaMode(
      "all_ways",
    );
    setSelectedRunners(
      [],
    );
    setMessage("");
    setError("");
  }

  function isRunnerSelected(
    runnerId: number,
  ) {
    return selectedRunners.some(
      (item) =>
        Number(
          item.runnerId,
        ) ===
        Number(
          runnerId,
        ),
    );
  }

  function toggleRunner(
    runnerId: number,
  ) {
    setMessage("");
    setError("");

    const alreadySelected =
      isRunnerSelected(
        runnerId,
      );

    if (alreadySelected) {
      setSelectedRunners(
        (current) =>
          current.filter(
            (item) =>
              Number(
                item.runnerId,
              ) !==
              Number(
                runnerId,
              ),
          ),
      );

      return;
    }

if (
  betType ===
    "quinella" &&
  selectedRunners.length >=
    4
) {
  setError(
    "A Quinella can contain a maximum of 4 horses.",
  );
  return;
}

    if (
      betType ===
        "trifecta" &&
      selectedRunners.length >=
        8
    ) {
      setError(
        "A Trifecta can contain a maximum of 8 horses.",
      );
      return;
    }

    setSelectedRunners(
      (current) => [
        ...current,
        {
          runnerId,
          positions:
            betType ===
              "trifecta" &&
            trifectaMode ===
              "positional"
              ? []
              : [],
        },
      ],
    );
  }

  function togglePosition(
    runnerId: number,
    position: number,
  ) {
    setSelectedRunners(
      (current) =>
        current.map(
          (item) => {
            if (
              Number(
                item.runnerId,
              ) !==
              Number(
                runnerId,
              )
            ) {
              return item;
            }

            const hasPosition =
              item.positions.includes(
                position,
              );

            return {
              ...item,
              positions:
                hasPosition
                  ? item.positions.filter(
                      (value) =>
                        value !==
                        position,
                    )
                  : [
                      ...item.positions,
                      position,
                    ].sort(
                      (
                        a,
                        b,
                      ) =>
                        a - b,
                    ),
            };
          },
        ),
    );
  }

  function changeBetType(
    nextType:
      | "quinella"
      | "trifecta",
  ) {
    setBetType(
      nextType,
    );

    setSelectedRunners(
      [],
    );

    setMessage("");
    setError("");

    if (
      nextType ===
      "quinella"
    ) {
      setTrifectaMode(
        "all_ways",
      );
    }
  }

  function changeTrifectaMode(
    nextMode:
      | "all_ways"
      | "positional",
  ) {
    setTrifectaMode(
      nextMode,
    );

    setSelectedRunners(
      (current) =>
        current.map(
          (item) => ({
            ...item,
            positions: [],
          }),
        ),
    );

    setMessage("");
    setError("");
  }

  function validateForm() {
    if (
      !selectedRaceId
    ) {
      return "Select a race first.";
    }

if (
  betType ===
    "quinella" &&
  (
    selectedRunners.length <
      2 ||
    selectedRunners.length >
      4
  )
) {
  return "A Quinella requires between 2 and 4 horses.";
}

    if (
      betType ===
        "trifecta" &&
      (
        selectedRunners.length <
          3 ||
        selectedRunners.length >
          8
      )
    ) {
      return "A Trifecta requires between 3 and 8 horses.";
    }

    if (
      betType ===
        "trifecta" &&
      trifectaMode ===
        "positional"
    ) {
      const emptyHorse =
        selectedRunners.some(
          (item) =>
            !item.positions
              .length,
        );

      if (emptyHorse) {
        return "Give every selected horse at least one finishing position.";
      }

      const hasFirst =
        selectedRunners.some(
          (item) =>
            item.positions.includes(
              1,
            ),
        );

      const hasSecond =
        selectedRunners.some(
          (item) =>
            item.positions.includes(
              2,
            ),
        );

      const hasThird =
        selectedRunners.some(
          (item) =>
            item.positions.includes(
              3,
            ),
        );

      if (
        !hasFirst ||
        !hasSecond ||
        !hasThird
      ) {
        return "Your Trifecta needs at least one runner available for 1st, 2nd and 3rd.";
      }
    }

    return null;
  }

  function handleSubmit() {
    setMessage("");
    setError("");

    const validationError =
      validateForm();

    if (
      validationError
    ) {
      setError(
        validationError,
      );
      return;
    }

    const selections =
      selectedRunners.map(
        (item) => ({
          race_runner_id:
            item.runnerId,

          ...(
            betType ===
              "trifecta" &&
            trifectaMode ===
              "positional"
              ? {
                  positions:
                    item.positions,
                }
              : {}
          ),
        }),
      );

    const formData =
      new FormData();

    if (editingId) {
      formData.set(
        "id",
        String(
          editingId,
        ),
      );
    }

    formData.set(
      "race_id",
      selectedRaceId,
    );

    formData.set(
      "bet_type",
      betType,
    );

    formData.set(
      "mode",
      betType ===
        "trifecta"
        ? trifectaMode
        : "",
    );

    formData.set(
      "selections",
      JSON.stringify(
        selections,
      ),
    );

    startTransition(
      async () => {
        try {
          await upsertMaverickExoticTipAction(
            formData,
          );

          setMessage(
            editingId
              ? "Exotic tip updated."
              : "Exotic tip published.",
          );

          setEditingId(
            null,
          );

          setSelectedRunners(
            [],
          );

          router.refresh();
        } catch (
          submitError
        ) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : "Failed to save exotic tip.",
          );
        }
      },
    );
  }

  function loadTipIntoForm(
    tip: ExoticTip,
  ) {
    setMessage("");
    setError("");

    const race =
      raceMap.get(
        Number(
          tip.race_id,
        ),
      );

    if (!race) {
      setError(
        "This exotic tip is no longer linked to a current published race and cannot be edited here.",
      );
      return;
    }

    const meeting =
      meetingMap.get(
        Number(
          race.meeting_id,
        ),
      );

    if (!meeting) {
      setError(
        "The meeting for this exotic tip could not be found.",
      );
      return;
    }

    const day =
      meeting.meeting_date ===
      dayDates.tomorrow
        ? "tomorrow"
        : "today";

    setSelectedDay(
      day,
    );

    setSelectedMeetingId(
      String(
        meeting.id,
      ),
    );

    setSelectedRaceId(
      String(
        race.id,
      ),
    );

    setBetType(
      tip.bet_type,
    );

    setTrifectaMode(
      tip.bet_type ===
        "trifecta"
        ? tip.mode ||
            "all_ways"
        : "all_ways",
    );

    setSelectedRunners(
      (
        tip.selections ||
        []
      ).map(
        (selection) => ({
          runnerId:
            Number(
              selection.race_runner_id,
            ),
          positions:
            Array.isArray(
              selection.positions,
            )
              ? selection.positions.map(
                  Number,
                )
              : [],
        }),
      ),
    );

    setEditingId(
      Number(
        tip.id,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleDelete(
    tipId: number,
  ) {
    setMessage("");
    setError("");

    setDeletingIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        next.add(
          tipId,
        );

        return next;
      },
    );

    setVisibleTips(
      (current) =>
        current.filter(
          (tip) =>
            Number(
              tip.id,
            ) !==
            Number(
              tipId,
            ),
        ),
    );

    startTransition(
      async () => {
        try {
          const formData =
            new FormData();

          formData.set(
            "id",
            String(
              tipId,
            ),
          );

          await deleteMaverickExoticTipAction(
            formData,
          );

          if (
            editingId ===
            tipId
          ) {
            clearForm();
          }
        } catch (
          deleteError
        ) {
          setVisibleTips(
            existingTips,
          );

          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Failed to delete exotic tip.",
          );
        } finally {
          setDeletingIds(
            (current) => {
              const next =
                new Set(
                  current,
                );

              next.delete(
                tipId,
              );

              return next;
            },
          );
        }
      },
    );
  }

  function getTipRaceLabel(
    tip: ExoticTip,
  ) {
    const race =
      raceMap.get(
        Number(
          tip.race_id,
        ),
      );

    if (!race) {
      return "Race unavailable";
    }

    const meeting =
      meetingMap.get(
        Number(
          race.meeting_id,
        ),
      );

    return `${meeting?.meeting_name || "Meeting"} R${race.race_number || "—"}`;
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(0,0,0,0.98),rgba(24,24,27,0.98),rgba(120,53,15,0.28))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-3">
          <img
            src="/maverick/maverick-shield.png"
            alt="The Maverick"
            className="h-14 w-14 shrink-0 object-contain"
          />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              The Maverick
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Exotic Tips
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Build a Quinella or Trifecta for today&apos;s racing.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
          Race Day
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDay(
                "today",
              );
              resetBelowDay();
            }}
            className={`rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
              selectedDay ===
              "today"
                ? "border border-amber-300/50 bg-amber-300/15 text-amber-200"
                : "border border-white/10 bg-white/5 text-zinc-300"
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
              resetBelowDay();
            }}
            className={`rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
              selectedDay ===
              "tomorrow"
                ? "border border-amber-300/50 bg-amber-300/15 text-amber-200"
                : "border border-white/10 bg-white/5 text-zinc-300"
            }`}
          >
            Tomorrow
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Meeting
          </span>

          <select
            value={
              selectedMeetingId
            }
            onChange={(event) => {
              setSelectedMeetingId(
                event.target.value,
              );

              resetBelowMeeting();
            }}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
          >
            <option value="">
              Select meeting
            </option>

            {availableMeetings.map(
              (meeting) => (
                <option
                  key={
                    meeting.id
                  }
                  value={String(
                    meeting.id,
                  )}
                >
                  {meeting.meeting_name ||
                    "Meeting"}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Race
          </span>

          <select
            value={
              selectedRaceId
            }
            disabled={
              !selectedMeetingId
            }
            onChange={(event) => {
              setSelectedRaceId(
                event.target.value,
              );

              clearSelection();
            }}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300 disabled:opacity-40"
          >
            <option value="">
              {selectedMeetingId
                ? "Select race"
                : "Select meeting first"}
            </option>

            {availableRaces.map(
              (race) => (
                <option
                  key={
                    race.id
                  }
                  value={String(
                    race.id,
                  )}
                >
                  R
                  {race.race_number ||
                    "—"}{" "}
                  {race.race_name ||
                    ""}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
          Bet Type
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              changeBetType(
                "quinella",
              )
            }
            className={`rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
              betType ===
              "quinella"
                ? "border border-amber-300/50 bg-amber-300/15 text-amber-200"
                : "border border-white/10 bg-white/5 text-zinc-300"
            }`}
          >
            Quinella
          </button>

          <button
            type="button"
            onClick={() =>
              changeBetType(
                "trifecta",
              )
            }
            className={`rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
              betType ===
              "trifecta"
                ? "border border-amber-300/50 bg-amber-300/15 text-amber-200"
                : "border border-white/10 bg-white/5 text-zinc-300"
            }`}
          >
            Trifecta
          </button>
        </div>

        {betType ===
        "trifecta" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                changeTrifectaMode(
                  "all_ways",
                )
              }
              className={`rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                trifectaMode ===
                "all_ways"
                  ? "border border-sky-300/50 bg-sky-300/15 text-sky-200"
                  : "border border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              All Ways
            </button>

            <button
              type="button"
              onClick={() =>
                changeTrifectaMode(
                  "positional",
                )
              }
              className={`rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                trifectaMode ===
                "positional"
                  ? "border border-sky-300/50 bg-sky-300/15 text-sky-200"
                  : "border border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              Set Positions
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
              Select Horses
            </p>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
{betType ===
"quinella"
  ? "Choose between 2 and 4 runners."
  : "Choose between 3 and 8 runners."}
            </p>
          </div>

          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black text-amber-200">
            {
              selectedRunners.length
            }
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {selectedRaceId ? (
            availableRunners.length ? (
              availableRunners.map(
                (runner) => {
                  const horse =
                    horseMap.get(
                      Number(
                        runner.horse_id,
                      ),
                    );

                  const selected =
                    selectedRunners.find(
                      (item) =>
                        Number(
                          item.runnerId,
                        ) ===
                        Number(
                          runner.id,
                        ),
                    );

                  const isSelected =
                    Boolean(
                      selected,
                    );

                  return (
                    <div
                      key={
                        runner.id
                      }
                      className={`rounded-[1.4rem] border p-3 transition ${
                        isSelected
                          ? "border-amber-300/45 bg-amber-300/[0.09]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleRunner(
                            Number(
                              runner.id,
                            ),
                          )
                        }
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${
                            isSelected
                              ? "border-amber-300/50 bg-amber-300/20 text-amber-200"
                              : "border-white/10 bg-black text-zinc-400"
                          }`}
                        >
                          {runner.runner_number ||
                            "—"}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-white">
                            {horse?.horse_name ||
                              "Unknown horse"}
                          </span>

                          {runner.barrier ? (
                            <span className="mt-0.5 block text-[10px] font-semibold text-zinc-500">
                              Barrier{" "}
                              {
                                runner.barrier
                              }
                            </span>
                          ) : null}
                        </span>

                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                            isSelected
                              ? "border-amber-300 bg-amber-300 text-black"
                              : "border-white/15 text-zinc-500"
                          }`}
                        >
                          {isSelected
                            ? "✓"
                            : "+"}
                        </span>
                      </button>

                      {isSelected &&
                      betType ===
                        "trifecta" &&
                      trifectaMode ===
                        "positional" ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                          {[
                            1,
                            2,
                            3,
                          ].map(
                            (
                              position,
                            ) => {
                              const active =
                                selected?.positions.includes(
                                  position,
                                );

                              return (
                                <button
                                  key={
                                    position
                                  }
                                  type="button"
                                  onClick={() =>
                                    togglePosition(
                                      Number(
                                        runner.id,
                                      ),
                                      position,
                                    )
                                  }
                                  className={`rounded-xl border px-2 py-2 text-[9px] font-black uppercase tracking-[0.1em] ${
                                    active
                                      ? "border-sky-300/50 bg-sky-300/15 text-sky-200"
                                      : "border-white/10 bg-black/40 text-zinc-500"
                                  }`}
                                >
                                  {position ===
                                  1
                                    ? "1st"
                                    : position ===
                                        2
                                      ? "2nd"
                                      : "3rd"}
                                </button>
                              );
                            },
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm font-semibold text-zinc-500">
                No active runners available.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm font-semibold text-zinc-500">
              Select a meeting and race first.
            </div>
          )}
        </div>
      </section>

      {selectedRace &&
      selectedMeeting &&
      selectedRunners.length ? (
        <section className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
            Ready to Publish
          </p>

          <p className="mt-2 text-lg font-black uppercase text-white">
            {betType ===
            "quinella"
              ? "Quinella"
              : "Trifecta"}
            {betType ===
              "trifecta" &&
            trifectaMode ===
              "all_ways"
              ? " · All Ways"
              : ""}
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-400">
            {selectedMeeting.meeting_name}{" "}
            R
            {
              selectedRace.race_number
            }
          </p>

          <p className="mt-3 text-sm font-black leading-6 text-amber-100">
            {selectedRunners
              .map(
                (item) => {
                  const runner =
                    availableRunners.find(
                      (entry) =>
                        Number(
                          entry.id,
                        ) ===
                        Number(
                          item.runnerId,
                        ),
                    );

                  if (!runner) {
                    return "";
                  }

                  const horse =
                    horseMap.get(
                      Number(
                        runner.horse_id,
                      ),
                    );

                  return runner.runner_number
                    ? `#${runner.runner_number} ${horse?.horse_name || ""}`
                    : horse?.horse_name ||
                        "";
                },
              )
              .filter(Boolean)
              .join(" · ")}
          </p>
        </section>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={
          handleSubmit
        }
        disabled={
          isPending ||
          !selectedRaceId ||
          selectedRunners.length ===
            0
        }
        className="w-full rounded-[1.4rem] bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-4 py-4 text-sm font-black uppercase tracking-[0.13em] text-black shadow-[0_18px_45px_rgba(245,158,11,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending
          ? editingId
            ? "Updating..."
            : "Publishing..."
          : editingId
            ? "Update Exotic Tip"
            : "Publish Exotic Tip"}
      </button>

      {editingId ? (
        <button
          type="button"
          onClick={
            clearForm
          }
          disabled={
            isPending
          }
          className="w-full rounded-[1.4rem] border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
        >
          Cancel Edit
        </button>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
              Current Exotic Tips
            </p>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Manage The Maverick&apos;s Quinellas and Trifectas.
            </p>
          </div>

          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black text-amber-200">
            {
              visibleTips.length
            }
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {visibleTips.length ? (
            visibleTips.map(
              (tip) => (
                <div
                  key={
                    tip.id
                  }
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black uppercase text-white">
                        {tip.bet_type ===
                        "quinella"
                          ? "Quinella"
                          : "Trifecta"}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-zinc-400">
                        {getTipRaceLabel(
                          tip,
                        )}
                      </p>
                    </div>

                    {tip.bet_type ===
                      "trifecta" &&
                    tip.mode ? (
                      <span className="shrink-0 rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-sky-200">
                        {tip.mode ===
                        "all_ways"
                          ? "All Ways"
                          : "Positions"}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-200">
                        Maverick
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {(
                      tip.selections ||
                      []
                    ).map(
                      (
                        selection,
                        index,
                      ) => (
                        <div
                          key={`${tip.id}-${selection.race_runner_id}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-sm font-bold text-zinc-200">
                            {selection.runner_number
                              ? `#${selection.runner_number} `
                              : ""}
                            {selection.horse ||
                              "Selection"}
                          </span>

                          {tip.bet_type ===
                            "trifecta" &&
                          tip.mode ===
                            "positional" &&
                          selection.positions?.length ? (
                            <span className="shrink-0 text-[9px] font-black uppercase text-sky-200">
                              {selection.positions
                                .map(
                                  (
                                    position,
                                  ) =>
                                    position ===
                                    1
                                      ? "1st"
                                      : position ===
                                          2
                                        ? "2nd"
                                        : "3rd",
                                )
                                .join(
                                  " / ",
                                )}
                            </span>
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        loadTipIntoForm(
                          tip,
                        )
                      }
                      disabled={
                        deletingIds.has(
                          Number(
                            tip.id,
                          ),
                        )
                      }
                      className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-300/15 disabled:opacity-40"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          Number(
                            tip.id,
                          ),
                        )
                      }
                      disabled={
                        deletingIds.has(
                          Number(
                            tip.id,
                          ),
                        )
                      }
                      className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-40"
                    >
                      {deletingIds.has(
                        Number(
                          tip.id,
                        ),
                      )
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm font-semibold text-zinc-500">
              No exotic tips published.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
