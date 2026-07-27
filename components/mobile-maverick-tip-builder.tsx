"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSuggestedTip } from "@/lib/actions";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  runner_number: number | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  jockey_name: string | null;
  scratched: boolean | null;
};

type Horse = {
  id: number;
  horse_name: string;
};

type ExistingTip = {
  id: number;
  meeting_id: number | null;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  horse: string;
  race: string;
  type: string;
  confidence: string;
  tip_angle: string | null;
  settled_at: string | null;
};

type DayDates = {
  today: string;
  tomorrow: string;
};

type SelectedDay = keyof DayDates;
type TipType = "Win" | "Place" | "Each Way";
type Confidence = "High" | "Medium" | "Low";

const TIP_ANGLES = [
  "The Vibe",
  "Favourite Vulnerable",
  "Track Specialist",
  "Wet Tracker",
  "Maps Perfectly",
  "Value At Odds",
  "Tempo Edge",
  "First-Up Play",
  "Forgive Run",
  "Stable Mail",
];

function buildRaceLabel(
  race: Race,
  meeting: Meeting | null,
) {
  return `${meeting?.meeting_name || "Meeting"} R${race.race_number} ${race.race_name} — ${race.distance_m || "—"}m`;
}

function selectionClasses(selected: boolean) {
  return selected
    ? "border-amber-300 bg-amber-300 text-black shadow-lg shadow-amber-500/20"
    : "border-white/10 bg-white/5 text-zinc-200";
}

export default function MobileMaverickTipBuilder({
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
  existingTips: ExistingTip[];
  dayDates: DayDates;
}) {
  const router = useRouter();
  const [isPublishing, startPublishing] =
    useTransition();

  const [selectedDay, setSelectedDay] =
    useState<SelectedDay>("today");

  const [selectedMeetingId, setSelectedMeetingId] =
    useState("");

  const [selectedRaceId, setSelectedRaceId] =
    useState("");

  const [selectedRunnerId, setSelectedRunnerId] =
    useState("");

  const [tipType, setTipType] =
    useState<TipType>("Win");

  const [confidence, setConfidence] =
    useState<Confidence>("High");

  const [tipAngle, setTipAngle] =
    useState("");

  const [tag, setTag] =
    useState("Best Bet");

  const [winOdds, setWinOdds] =
    useState("");

  const [placeOdds, setPlaceOdds] =
    useState("");

  const [raceTime, setRaceTime] =
    useState("");

  const [raceTimezone, setRaceTimezone] =
    useState("Australia/Perth");

  const [commentary, setCommentary] =
    useState("");

  const [sendNotification, setSendNotification] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

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

  const meetingMap = useMemo(
    () =>
      new Map(
        meetings.map((meeting) => [
          Number(meeting.id),
          meeting,
        ]),
      ),
    [meetings],
  );

  const activeDate = dayDates[selectedDay];

  const dayMeetings = useMemo(
    () =>
      meetings
        .filter(
          (meeting) =>
            meeting.meeting_date === activeDate,
        )
        .filter((meeting) =>
          races.some(
            (race) =>
              Number(race.meeting_id) ===
              Number(meeting.id),
          ),
        )
        .sort((a, b) =>
          a.meeting_name.localeCompare(
            b.meeting_name,
          ),
        ),
    [activeDate, meetings, races],
  );

  const selectedMeeting = selectedMeetingId
    ? meetingMap.get(
        Number(selectedMeetingId),
      ) || null
    : null;

  const meetingRaces = useMemo(
    () =>
      races
        .filter(
          (race) =>
            Number(race.meeting_id) ===
            Number(selectedMeetingId),
        )
        .sort(
          (a, b) =>
            Number(a.race_number) -
            Number(b.race_number),
        ),
    [races, selectedMeetingId],
  );

  const selectedRace = selectedRaceId
    ? races.find(
        (race) =>
          String(race.id) ===
          selectedRaceId,
      ) || null
    : null;

  const raceRunners = useMemo(
    () =>
      runners
        .filter(
          (runner) =>
            Number(runner.race_id) ===
              Number(selectedRaceId) &&
            runner.scratched !== true,
        )
        .sort((a, b) => {
          const numberGap =
            Number(a.runner_number || 999) -
            Number(b.runner_number || 999);

          if (numberGap !== 0) {
            return numberGap;
          }

          return (
            Number(a.barrier || 999) -
            Number(b.barrier || 999)
          );
        }),
    [runners, selectedRaceId],
  );

  const selectedRunner = selectedRunnerId
    ? raceRunners.find(
        (runner) =>
          String(runner.id) ===
          selectedRunnerId,
      ) || null
    : null;

  const selectedHorse = selectedRunner
    ? horseMap.get(
        Number(selectedRunner.horse_id),
      ) || null
    : null;

  function getRaceTipCount(raceId: number) {
    return existingTips.filter(
      (tip) =>
        Number(tip.race_id) ===
          Number(raceId) &&
        !tip.settled_at,
    ).length;
  }

  function getMeetingProgress(
    meetingId: number,
  ) {
    const racesForMeeting = races.filter(
      (race) =>
        Number(race.meeting_id) ===
        Number(meetingId),
    );

    const tippedRaceCount =
      racesForMeeting.filter(
        (race) =>
          getRaceTipCount(race.id) > 0,
      ).length;

    return {
      total: racesForMeeting.length,
      tipped: tippedRaceCount,
    };
  }

  function clearSelectionAfterPublish() {
    setSelectedRunnerId("");
    setTipType("Win");
    setConfidence("High");
    setTipAngle("");
    setTag("Best Bet");
    setWinOdds("");
    setPlaceOdds("");
    setCommentary("");
    setSendNotification(false);
  }

  function publishTip() {
    setSuccessMessage("");
    setErrorMessage("");

    if (
      !selectedMeeting ||
      !selectedRace ||
      !selectedRunner ||
      !selectedHorse
    ) {
      setErrorMessage(
        "Select a meeting, race and runner first.",
      );
      return;
    }

    if (!raceTime) {
      setErrorMessage(
        "Enter the scheduled race time.",
      );
      return;
    }

    const formData = new FormData();

    formData.set(
      "meeting_id",
      String(selectedMeeting.id),
    );

    formData.set(
      "race_id",
      String(selectedRace.id),
    );

    formData.set(
      "horse_id",
      String(selectedHorse.id),
    );

    formData.set(
      "race_runner_id",
      String(selectedRunner.id),
    );

    formData.set(
      "race",
      buildRaceLabel(
        selectedRace,
        selectedMeeting,
      ),
    );

    formData.set(
      "horse",
      selectedHorse.horse_name,
    );

    formData.set("type", tipType);
    formData.set("confidence", confidence);
    formData.set("note", tag);
    formData.set("tip_angle", tipAngle);
    formData.set("commentary", commentary);

    formData.set(
      "race_date",
      selectedMeeting.meeting_date,
    );

    formData.set("race_time", raceTime);

    formData.set(
      "race_timezone",
      raceTimezone,
    );

    if (
      tipType === "Win" ||
      tipType === "Each Way"
    ) {
      formData.set("win_odds", winOdds);
    }

    if (
      tipType === "Place" ||
      tipType === "Each Way"
    ) {
      formData.set(
        "place_odds",
        placeOdds,
      );
    }

    if (sendNotification) {
      formData.set(
        "send_notification",
        "true",
      );
    }

    startPublishing(async () => {
      try {
        await upsertSuggestedTip(formData);

        setSuccessMessage(
          `${selectedHorse.horse_name} published as a ${tipType} tip.`,
        );

        clearSelectionAfterPublish();
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The tip could not be published.",
        );
      }
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.2),transparent_28%),linear-gradient(180deg,#030303_0%,#09090b_52%,#020617_100%)] px-3 py-4 text-white">
      <div className="mx-auto max-w-[460px]">
        <header className="sticky top-2 z-30 rounded-[1.75rem] border border-amber-300/30 bg-black/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300">
                The Maverick
              </p>

              <h1 className="mt-1 text-xl font-black">
                Publish a Tip
              </h1>
            </div>

            <Link
              href="/mobile-admin"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white"
            >
              Admin Home
            </Link>
          </div>
        </header>

        <main className="mt-4 space-y-4 pb-12">
          <section className="rounded-[1.75rem] border border-amber-300/20 bg-black/75 p-2">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["today", "Today"],
                  ["tomorrow", "Tomorrow"],
                ] as Array<
                  [SelectedDay, string]
                >
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSelectedDay(value);
                    setSelectedMeetingId("");
                    setSelectedRaceId("");
                    setSelectedRunnerId("");
                  }}
                  className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.14em] ${selectionClasses(
                    selectedDay === value,
                  )}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              1. Choose Meeting
            </p>

            <div className="mt-3 space-y-2">
              {dayMeetings.length ? (
                dayMeetings.map((meeting) => {
                  const progress =
                    getMeetingProgress(
                      meeting.id,
                    );

                  const percentage =
                    progress.total > 0
                      ? Math.round(
                          (progress.tipped /
                            progress.total) *
                            100,
                        )
                      : 0;

                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => {
                        setSelectedMeetingId(
                          String(meeting.id),
                        );
                        setSelectedRaceId("");
                        setSelectedRunnerId("");
                      }}
                      className={`w-full rounded-2xl border p-4 text-left ${selectionClasses(
                        selectedMeetingId ===
                          String(meeting.id),
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black uppercase">
                            {meeting.meeting_name}
                          </p>

                          <p className="mt-1 text-xs opacity-70">
                            {meeting.track_condition ||
                              "Condition TBA"}
                          </p>
                        </div>

                        <p className="text-xs font-black">
                          {progress.tipped}/
                          {progress.total} tipped
                        </p>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-zinc-400">
                  No published meetings for this day.
                </p>
              )}
            </div>
          </section>

          {selectedMeeting ? (
            <section className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                2. Choose Race
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {meetingRaces.map((race) => {
                  const tipCount =
                    getRaceTipCount(race.id);

                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => {
                        setSelectedRaceId(
                          String(race.id),
                        );
                        setSelectedRunnerId("");
                      }}
                      className={`rounded-2xl border p-4 text-left ${selectionClasses(
                        selectedRaceId ===
                          String(race.id),
                      )}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-black">
                          R{race.race_number}
                        </span>

                        <span className="text-sm">
                          {tipCount > 0
                            ? "✅"
                            : "⬜"}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs font-semibold opacity-75">
                        {race.race_name}
                      </p>

                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.1em] opacity-60">
                        {tipCount > 0
                          ? `${tipCount} tip${tipCount === 1 ? "" : "s"}`
                          : "No tip"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {selectedRace ? (
            <section className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                3. Choose Runner
              </p>

              <div className="mt-3 space-y-2">
                {raceRunners.map((runner) => {
                  const horse =
                    horseMap.get(
                      Number(runner.horse_id),
                    );

                  return (
                    <button
                      key={runner.id}
                      type="button"
                      onClick={() =>
                        setSelectedRunnerId(
                          String(runner.id),
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${selectionClasses(
                        selectedRunnerId ===
                          String(runner.id),
                      )}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 text-sm font-black">
                        {runner.runner_number ||
                          "—"}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-black">
                          {horse?.horse_name ||
                            "Unknown horse"}
                        </span>

                        <span className="mt-1 block text-xs opacity-65">
                          Barrier{" "}
                          {runner.barrier || "—"}
                          {runner.jockey_name
                            ? ` · ${runner.jockey_name}`
                            : ""}
                        </span>
                      </span>

                      <span className="text-lg">
                        {selectedRunnerId ===
                        String(runner.id)
                          ? "●"
                          : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {selectedRunner &&
          selectedHorse &&
          selectedRace &&
          selectedMeeting ? (
            <section className="rounded-[1.75rem] border border-amber-300/30 bg-[linear-gradient(145deg,rgba(24,24,27,0.96),rgba(0,0,0,0.98))] p-4 shadow-2xl shadow-black/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                4. Build Tip
              </p>

              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                  {selectedMeeting.meeting_name} R
                  {selectedRace.race_number}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {selectedHorse.horse_name}
                </h2>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Bet Type
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      "Win",
                      "Place",
                      "Each Way",
                    ] as TipType[]
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setTipType(value);

                        if (value === "Win") {
                          setPlaceOdds("");
                        }

                        if (value === "Place") {
                          setWinOdds("");
                        }
                      }}
                      className={`rounded-xl border px-2 py-3 text-[10px] font-black uppercase tracking-[0.08em] ${selectionClasses(
                        tipType === value,
                      )}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Confidence
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      "High",
                      "Medium",
                      "Low",
                    ] as Confidence[]
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setConfidence(value)
                      }
                      className={`rounded-xl border px-2 py-3 text-[10px] font-black uppercase tracking-[0.08em] ${selectionClasses(
                        confidence === value,
                      )}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Tag
                <input
                  value={tag}
                  onChange={(event) =>
                    setTag(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300"
                />
              </label>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                SmartPunt Angle
                <select
                  value={tipAngle}
                  onChange={(event) =>
                    setTipAngle(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-950 outline-none"
                >
                  <option value="">
                    No angle
                  </option>

                  {TIP_ANGLES.map((angle) => (
                    <option
                      key={angle}
                      value={angle}
                    >
                      {angle}
                    </option>
                  ))}
                </select>
              </label>

              <div
                className={`mt-4 grid gap-3 ${
                  tipType === "Each Way"
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {tipType === "Win" ||
                tipType === "Each Way" ? (
                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    Win Odds
                    <input
                      type="number"
                      min="1.01"
                      step="0.01"
                      value={winOdds}
                      onChange={(event) =>
                        setWinOdds(
                          event.target.value,
                        )
                      }
                      placeholder="5.50"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-base font-black text-white outline-none focus:border-amber-300"
                    />
                  </label>
                ) : null}

                {tipType === "Place" ||
                tipType === "Each Way" ? (
                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    Place Odds
                    <input
                      type="number"
                      min="1.01"
                      step="0.01"
                      value={placeOdds}
                      onChange={(event) =>
                        setPlaceOdds(
                          event.target.value,
                        )
                      }
                      placeholder="2.10"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-base font-black text-white outline-none focus:border-amber-300"
                    />
                  </label>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Race Time
                  <input
                    type="time"
                    value={raceTime}
                    onChange={(event) =>
                      setRaceTime(
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm font-black text-white outline-none focus:border-amber-300"
                  />
                </label>

                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Timezone
                  <select
                    value={raceTimezone}
                    onChange={(event) =>
                      setRaceTimezone(
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-2 py-3 text-xs font-semibold text-zinc-950 outline-none"
                  >
                    <option value="Australia/Perth">
                      Perth
                    </option>
                    <option value="Australia/Adelaide">
                      Adelaide
                    </option>
                    <option value="Australia/Darwin">
                      Darwin
                    </option>
                    <option value="Australia/Brisbane">
                      Brisbane
                    </option>
                    <option value="Australia/Sydney">
                      Sydney
                    </option>
                    <option value="Australia/Melbourne">
                      Melbourne
                    </option>
                    <option value="Australia/Hobart">
                      Hobart
                    </option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Commentary
                <textarea
                  value={commentary}
                  onChange={(event) =>
                    setCommentary(
                      event.target.value,
                    )
                  }
                  placeholder="Enter The Maverick's race-day thoughts..."
                  className="mt-2 min-h-[150px] w-full rounded-2xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-amber-300"
                />
              </label>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(event) =>
                    setSendNotification(
                      event.target.checked,
                    )
                  }
                  className="h-5 w-5"
                />

                Send subscriber email notification
              </label>

              {successMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
                  ✓ {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="button"
                onClick={publishTip}
                disabled={isPublishing}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-black shadow-xl shadow-amber-500/25 transition active:scale-[0.99] disabled:opacity-60"
              >
                {isPublishing
                  ? "Publishing..."
                  : "Publish Tip"}
              </button>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
