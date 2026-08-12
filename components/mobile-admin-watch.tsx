"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteWatchItemAction,
  upsertWatchItem,
} from "@/lib/actions";

type Meeting = {
  id: number;
  meeting_name: string | null;
  meeting_date: string | null;
  track_condition?: string | null;
};

type Race = {
  id: number;
  meeting_id: number | null;
  race_number: number | null;
  race_name: string | null;
  distance_m?: number | null;
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

type DayDates = {
  today: string;
  tomorrow: string;
};

type WatchItem = {
  id: number;
  label?: string | null;
  horse?: string | null;
  race?: string | null;
  commentary?: string | null;
  meeting_id?: number | null;
  race_id?: number | null;
  race_runner_id?: number | null;
  horse_id?: number | null;
  created_at?: string | null;
};

export default function MobileAdminWatch({
  meetings,
  races,
  runners,
  horses,
  watchItems,
  dayDates,
}: {
  meetings: Meeting[];
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  watchItems: WatchItem[];
  dayDates: DayDates;
}) {
  const [selectedDay, setSelectedDay] =
    useState<"today" | "tomorrow">("today");

  const [selectedMeetingId, setSelectedMeetingId] =
    useState("");

  const [selectedRaceId, setSelectedRaceId] =
    useState("");

  const [selectedRunnerId, setSelectedRunnerId] =
    useState("");

  const [label, setLabel] =
    useState("Horse to Watch");

  const [commentary, setCommentary] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

const [isPending, startTransition] =
    useTransition();

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [visibleWatchItems, setVisibleWatchItems] =
    useState<WatchItem[]>(watchItems);

  const [deletingIds, setDeletingIds] =
    useState<Set<number>>(new Set());

  const router = useRouter();

  useEffect(() => {
    setVisibleWatchItems(watchItems);
  }, [watchItems]);

  const selectedDate =
    selectedDay === "today"
      ? dayDates.today
      : dayDates.tomorrow;

  const availableMeetings = useMemo(
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

  const availableRaces = useMemo(() => {
    const meetingId =
      Number(selectedMeetingId);

    if (!meetingId) {
      return [];
    }

    return races
      .filter(
        (race) =>
          Number(race.meeting_id) ===
          meetingId,
      )
      .sort(
        (a, b) =>
          Number(
            a.race_number || 0,
          ) -
          Number(
            b.race_number || 0,
          ),
      );
  }, [
    races,
    selectedMeetingId,
  ]);

  const availableRunners = useMemo(() => {
    const raceId =
      Number(selectedRaceId);

    if (!raceId) {
      return [];
    }

    return runners
      .filter(
        (runner) =>
          Number(runner.race_id) ===
            raceId &&
          runner.scratched !== true,
      )
      .sort(
        (a, b) =>
          Number(
            a.runner_number || 999,
          ) -
          Number(
            b.runner_number || 999,
          ),
      );
  }, [
    runners,
    selectedRaceId,
  ]);

  const horseMap = useMemo(
    () =>
      new Map(
        horses.map((horse) => [
          Number(horse.id),
          horse,
        ]),
      ),
    [horses],
  );

  const selectedMeeting =
    availableMeetings.find(
      (meeting) =>
        String(meeting.id) ===
        selectedMeetingId,
    ) || null;

  const selectedRace =
    availableRaces.find(
      (race) =>
        String(race.id) ===
        selectedRaceId,
    ) || null;

  const selectedRunner =
    availableRunners.find(
      (runner) =>
        String(runner.id) ===
        selectedRunnerId,
    ) || null;

  const selectedHorse =
    selectedRunner
      ? horseMap.get(
          Number(
            selectedRunner.horse_id,
          ),
        ) || null
      : null;

  function resetBelowDay() {
    setSelectedMeetingId("");
    setSelectedRaceId("");
    setSelectedRunnerId("");
  }

  function resetBelowMeeting() {
    setSelectedRaceId("");
    setSelectedRunnerId("");
  }

  function resetBelowRace() {
    setSelectedRunnerId("");
  }
function clearForm() {
    setEditingId(null);
    setSelectedMeetingId("");
    setSelectedRaceId("");
    setSelectedRunnerId("");
    setLabel("Horse to Watch");
    setCommentary("");
    setMessage("");
    setError("");
  }

  function loadWatchIntoForm(item: WatchItem) {
    setMessage("");
    setError("");

    const meeting = meetings.find(
      (entry) =>
        Number(entry.id) ===
        Number(item.meeting_id),
    );

    const race = races.find(
      (entry) =>
        Number(entry.id) ===
        Number(item.race_id),
    );

    const runner = runners.find(
      (entry) =>
        Number(entry.id) ===
        Number(item.race_runner_id),
    );

    if (!meeting || !race || !runner) {
      setError(
        "This Watch Suggestion is no longer part of the current race program. It can still be deleted, but cannot be edited from this mobile race selector.",
      );
      return;
    }

    const day =
      meeting.meeting_date === dayDates.tomorrow
        ? "tomorrow"
        : "today";

    setSelectedDay(day);
    setSelectedMeetingId(String(meeting.id));
    setSelectedRaceId(String(race.id));
    setSelectedRunnerId(String(runner.id));
    setLabel(item.label || "Horse to Watch");
    setCommentary(item.commentary || "");
    setEditingId(Number(item.id));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleDelete(itemId: number) {
    setMessage("");
    setError("");

    setDeletingIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });

    setVisibleWatchItems((current) =>
      current.filter(
        (item) =>
          Number(item.id) !== itemId,
      ),
    );

    startTransition(async () => {
      try {
        const formData = new FormData();

        formData.set(
          "id",
          String(itemId),
        );

        await deleteWatchItemAction(
          formData,
        );

        if (editingId === itemId) {
          clearForm();
        }
      } catch (deleteError) {
        setVisibleWatchItems(
          watchItems,
        );

        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete Watch Suggestion.",
        );
      } finally {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(itemId);
          return next;
        });
      }
    });
  }
  function handleSubmit() {
    setMessage("");
    setError("");

    if (
      !selectedMeeting ||
      !selectedRace ||
      !selectedRunner ||
      !selectedHorse
    ) {
      setError(
        "Choose a meeting, race and horse first.",
      );
      return;
    }

const formData =
      new FormData();

    if (editingId) {
      formData.set(
        "id",
        String(editingId),
      );
    }

    formData.set(
      "meeting_id",
      String(
        selectedMeeting.id,
      ),
    );

    formData.set(
      "race_id",
      String(
        selectedRace.id,
      ),
    );

    formData.set(
      "race_runner_id",
      String(
        selectedRunner.id,
      ),
    );

    formData.set(
      "horse_id",
      String(
        selectedHorse.id,
      ),
    );

    formData.set(
      "label",
      label,
    );

    formData.set(
      "commentary",
      commentary,
    );

    startTransition(
      async () => {
        try {
          await upsertWatchItem(
            formData,
          );

setMessage(
            editingId
              ? "Watch Suggestion updated."
              : "Watch Suggestion published.",
          );

          setEditingId(null);
          setSelectedRunnerId("");
          setCommentary("");
          setLabel(
            "Horse to Watch",
          );

          router.refresh();
        } catch (submitError) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : "Failed to publish Watch Suggestion.",
          );
        }
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(0,0,0,0.98),rgba(24,24,27,0.98),rgba(120,53,15,0.25))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
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
              Watch Suggestions
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Flag a horse from the current race program for subscribers to watch.
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
              resetBelowRace();
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
                  key={race.id}
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

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Horse
          </span>

          <select
            value={
              selectedRunnerId
            }
            disabled={
              !selectedRaceId
            }
            onChange={(event) =>
              setSelectedRunnerId(
                event.target.value,
              )
            }
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300 disabled:opacity-40"
          >
            <option value="">
              {selectedRaceId
                ? "Select horse"
                : "Select race first"}
            </option>

            {availableRunners.map(
              (runner) => {
                const horse =
                  horseMap.get(
                    Number(
                      runner.horse_id,
                    ),
                  );

                return (
                  <option
                    key={
                      runner.id
                    }
                    value={String(
                      runner.id,
                    )}
                  >
                    {runner.runner_number
                      ? `${runner.runner_number}. `
                      : ""}
                    {horse?.horse_name ||
                      "Unknown horse"}
                    {runner.barrier
                      ? ` — B${runner.barrier}`
                      : ""}
                  </option>
                );
              },
            )}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Watch label
          </span>

          <select
            value={label}
            onChange={(event) =>
              setLabel(
                event.target.value,
              )
            }
            className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
          >
            <option>
              Horse to Watch
            </option>
            <option>
              Race to Watch
            </option>
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
            Commentary
          </span>

          <textarea
            value={commentary}
            onChange={(event) =>
              setCommentary(
                event.target.value,
              )
            }
            placeholder="Add The Maverick's watch note."
            className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-amber-300"
          />
        </label>
      </section>

      {selectedHorse &&
      selectedRace &&
      selectedMeeting ? (
        <section className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
            Ready to Publish
          </p>

          <p className="mt-2 text-lg font-black text-white">
            {selectedHorse.horse_name}
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-400">
            {selectedMeeting.meeting_name} R
            {selectedRace.race_number}
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
          !selectedMeeting ||
          !selectedRace ||
          !selectedRunner ||
          !selectedHorse
        }
        className="w-full rounded-[1.4rem] bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-4 py-4 text-sm font-black uppercase tracking-[0.13em] text-black shadow-[0_18px_45px_rgba(245,158,11,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
{isPending
          ? editingId
            ? "Updating..."
            : "Publishing..."
          : editingId
            ? "Update Watch Suggestion"
            : "Publish Watch Suggestion"}
      </button>
      {editingId ? (
        <button
          type="button"
          onClick={clearForm}
          disabled={isPending}
          className="w-full rounded-[1.4rem] border border-white/15 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
        >
          Cancel Edit
        </button>
      ) : null}
      <section className="rounded-[2rem] border border-white/10 bg-black/75 p-4 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
              Current Watch Suggestions
            </p>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Manage The Maverick&apos;s published Watch items.
            </p>
          </div>

          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black text-amber-200">
            {visibleWatchItems.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {visibleWatchItems.length ? (
            visibleWatchItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-white">
                      {item.horse ||
                        "Watch Selection"}
                    </p>

                    <p className="mt-1 text-[11px] font-semibold leading-5 text-zinc-400">
                      {item.race ||
                        "Race details unavailable"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-200">
                    {item.label ||
                      "Watch"}
                  </span>
                </div>

                {item.commentary ? (
                  <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
                    {item.commentary}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      loadWatchIntoForm(
                        item,
                      )
                    }
                    disabled={
                      deletingIds.has(
                        Number(
                          item.id,
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
                          item.id,
                        ),
                      )
                    }
                    disabled={
                      deletingIds.has(
                        Number(
                          item.id,
                        ),
                      )
                    }
                    className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-40"
                  >
                    {deletingIds.has(
                      Number(
                        item.id,
                      ),
                    )
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm font-semibold text-zinc-500">
              No Watch Suggestions published.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
