"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import {
  createMeetingAction,
  createRaceAction,
  createRaceRunnerAction,
  deleteMeetingAction,
  deleteRaceAction,
  deleteRaceRunnerAction,
  toggleRacePublishAction,
} from "@/lib/actions";

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
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
  form_last_3: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
    >
      {children}
    </select>
  );
}

function formatMeetingLabel(meeting: Meeting) {
  return `${meeting.meeting_name} — ${meeting.meeting_date}`;
}

function getRaceStatusTone(status: Race["status"]) {
  if (status === "published") return "green";
  if (status === "closed") return "rose";
  return "amber";
}

export default function RaceBuilderPage({
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");

  const [meetingName, setMeetingName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTrackCondition, setMeetingTrackCondition] = useState("Good 4");

  const [selectedMeetingIdForRace, setSelectedMeetingIdForRace] = useState("");
  const [raceNumber, setRaceNumber] = useState("");
  const [raceName, setRaceName] = useState("");
  const [raceDistance, setRaceDistance] = useState("");

  const [selectedMeetingIdForRunner, setSelectedMeetingIdForRunner] = useState("");
  const [selectedRaceIdForRunner, setSelectedRaceIdForRunner] = useState("");
  const [horseQuery, setHorseQuery] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [jockeyName, setJockeyName] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [barrier, setBarrier] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [formLast3, setFormLast3] = useState("");

  const filteredHorseSuggestions = useMemo(() => {
    const query = horseQuery.trim().toLowerCase();

    if (!query) {
      return initialHorses.slice(0, 8);
    }

    return initialHorses
      .filter((horse) => horse.horse_name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [horseQuery, initialHorses]);

  const racesForSelectedMeeting = useMemo(() => {
    if (!selectedMeetingIdForRunner) return [];

    return initialRaces.filter(
      (race) => String(race.meeting_id) === selectedMeetingIdForRunner,
    );
  }, [initialRaces, selectedMeetingIdForRunner]);

  const selectedRace = initialRaces.find(
    (race) => String(race.id) === selectedRaceIdForRunner,
  );

  function clearMeetingForm() {
    setMeetingName("");
    setMeetingDate("");
    setMeetingTrackCondition("Good 4");
  }

  function clearRaceForm() {
    setSelectedMeetingIdForRace("");
    setRaceNumber("");
    setRaceName("");
    setRaceDistance("");
  }

  function clearRunnerForm() {
    setSelectedMeetingIdForRunner("");
    setSelectedRaceIdForRunner("");
    setHorseQuery("");
    setSelectedHorseId("");
    setJockeyName("");
    setTrainerName("");
    setBarrier("");
    setMarketPrice("");
    setFormLast3("");
  }

  function setSuccess(message: string) {
    setStatusTone("success");
    setStatusMessage(message);
  }

  function setError(message: string) {
    setStatusTone("error");
    setStatusMessage(message);
  }

  function handleAddMeeting() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_name", meetingName);
      formData.set("meeting_date", meetingDate);
      formData.set("track_condition", meetingTrackCondition);

      const result = await createMeetingAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create meeting.");
        return;
      }

      clearMeetingForm();
      setSuccess("Meeting added to Race Builder.");
      router.refresh();
    });
  }

  function handleDeleteMeeting(meetingId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_id", String(meetingId));

      const result = await deleteMeetingAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete meeting.");
        return;
      }

      setSuccess("Meeting deleted.");
      router.refresh();
    });
  }

  function handleAddRace() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_id", selectedMeetingIdForRace);
      formData.set("race_number", raceNumber);
      formData.set("race_name", raceName);
      formData.set("distance_m", raceDistance);

      const result = await createRaceAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create race.");
        return;
      }

      clearRaceForm();
      setSuccess("Race added to the selected meeting.");
      router.refresh();
    });
  }

  function handleTogglePublish(raceId: number, currentStatus: Race["status"]) {
    startTransition(async () => {
      const nextStatus = currentStatus === "published" ? "draft" : "published";
      const formData = new FormData();
      formData.set("race_id", String(raceId));
      formData.set("next_status", nextStatus);

      const result = await toggleRacePublishAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to update race status.");
        return;
      }

      setSuccess(nextStatus === "published" ? "Race published." : "Race moved back to draft.");
      router.refresh();
    });
  }

  function handleDeleteRace(raceId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", String(raceId));

      const result = await deleteRaceAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete race.");
        return;
      }

      setSuccess("Race deleted.");
      router.refresh();
    });
  }

  function handleSelectHorse(horse: Horse) {
    setSelectedHorseId(String(horse.id));
    setHorseQuery(horse.horse_name);
  }

  function handleAddRunner() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", selectedRaceIdForRunner);
      formData.set("selected_horse_id", selectedHorseId);
      formData.set("horse_name", horseQuery);
      formData.set("jockey_name", jockeyName);
      formData.set("trainer_name", trainerName);
      formData.set("barrier", barrier);
      formData.set("market_price", marketPrice);
      formData.set("form_last_3", formLast3);

      const result = await createRaceRunnerAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create runner.");
        return;
      }

      clearRunnerForm();
      setSuccess("Runner added to race.");
      router.refresh();
    });
  }

  function handleDeleteRunner(runnerId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("runner_id", String(runnerId));

      const result = await deleteRaceRunnerAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete runner.");
        return;
      }

      setSuccess("Runner deleted.");
      router.refresh();
    });
  }

  function runnersForRace(raceId: number) {
    return initialRunners.filter((runner) => runner.race_id === raceId);
  }

  function findHorseName(horseId: number) {
    return initialHorses.find((horse) => horse.id === horseId)?.horse_name || "Unknown horse";
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
              <Badge tone="amber">Race Builder</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
                <Link
                  href="/resulted-tips"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Resulted Tips
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Fortune on 5 race builder
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Build meetings, races, horses, and runners cleanly before the calculator goes live.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">Live database</Badge>
                <Badge tone="blue">Admin only</Badge>
                <Badge tone="amber">Publish control active</Badge>
              </div>
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              statusTone === "success"
                ? "border-emerald-300/20 bg-emerald-100 text-emerald-950"
                : "border-red-300/20 bg-red-100 text-red-900"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">1. Add meeting</h2>
                  <p className="text-sm text-zinc-500">
                    Start with the meeting shell so races can sit under it.
                  </p>
                </div>
                <Badge tone="amber">{initialMeetings.length} meetings</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Meeting name">
                  <TextInput
                    value={meetingName}
                    onChange={setMeetingName}
                    placeholder="Randwick"
                  />
                </Field>

                <Field label="Meeting date">
                  <TextInput
                    type="date"
                    value={meetingDate}
                    onChange={setMeetingDate}
                    placeholder=""
                  />
                </Field>

                <Field label="Track condition">
                  <Select
                    value={meetingTrackCondition}
                    onChange={setMeetingTrackCondition}
                  >
                    <option>Good 3</option>
                    <option>Good 4</option>
                    <option>Soft 5</option>
                    <option>Soft 6</option>
                    <option>Soft 7</option>
                    <option>Heavy 8</option>
                    <option>Heavy 9</option>
                    <option>Heavy 10</option>
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddMeeting}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Meeting"}
                </button>
                <button
                  type="button"
                  onClick={clearMeetingForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-4 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Meetings loaded</h2>
                <Badge tone="blue">Master list</Badge>
              </div>

              <div className="space-y-3">
                {initialMeetings.length > 0 ? (
                  initialMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-zinc-950">
                            {meeting.meeting_name}
                          </p>
                          <p className="text-sm text-zinc-500">{meeting.meeting_date}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="amber">{meeting.track_condition || "—"}</Badge>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            disabled={isPending}
                            className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No meetings loaded yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">2. Add race</h2>
                  <p className="text-sm text-zinc-500">
                    Build races under a meeting before loading runners.
                  </p>
                </div>
                <Badge tone="green">{initialRaces.length} races</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting">
                  <Select
                    value={selectedMeetingIdForRace}
                    onChange={setSelectedMeetingIdForRace}
                  >
                    <option value="">Select meeting</option>
                    {initialMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {formatMeetingLabel(meeting)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Race number">
                  <TextInput
                    value={raceNumber}
                    onChange={setRaceNumber}
                    placeholder="6"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Race name">
                  <TextInput
                    value={raceName}
                    onChange={setRaceName}
                    placeholder="Sprint Handicap"
                  />
                </Field>

                <Field label="Distance (m)">
                  <TextInput
                    value={raceDistance}
                    onChange={setRaceDistance}
                    placeholder="1200"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddRace}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Race"}
                </button>
                <button
                  type="button"
                  onClick={clearRaceForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-4 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Races loaded</h2>
                <Badge tone="violet">Meeting-linked</Badge>
              </div>

              <div className="space-y-3">
                {initialRaces.length > 0 ? (
                  initialRaces.map((race) => {
                    const meeting = initialMeetings.find((item) => item.id === race.meeting_id);

                    return (
                      <div
                        key={race.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-zinc-950">
                                R{race.race_number} {race.race_name}
                              </p>
                              <Badge tone={getRaceStatusTone(race.status)}>
                                {race.status}
                              </Badge>
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {meeting?.meeting_name || "Unknown meeting"} · {race.distance_m || "—"}m
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge tone="blue">
                              {runnersForRace(race.id).length} runners
                            </Badge>

                            <button
                              type="button"
                              onClick={() => handleTogglePublish(race.id, race.status)}
                              disabled={isPending}
                              className={`rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                                race.status === "published"
                                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                                  : "bg-black text-amber-300 hover:bg-zinc-900"
                              }`}
                            >
                              {race.status === "published" ? "Unpublish" : "Publish"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRace(race.id)}
                              disabled={isPending}
                              className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">No races loaded yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">3. Add runner</h2>
                  <p className="text-sm text-zinc-500">
                    Search saved horses first. If it’s new, SmartPunt adds it to the master list automatically.
                  </p>
                </div>
                <Badge tone="rose">{initialHorses.length} horses</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting">
                  <Select
                    value={selectedMeetingIdForRunner}
                    onChange={(value) => {
                      setSelectedMeetingIdForRunner(value);
                      setSelectedRaceIdForRunner("");
                    }}
                  >
                    <option value="">Select meeting</option>
                    {initialMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {formatMeetingLabel(meeting)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Race">
                  <Select
                    value={selectedRaceIdForRunner}
                    onChange={setSelectedRaceIdForRunner}
                  >
                    <option value="">Select race</option>
                    {racesForSelectedMeeting.map((race) => (
                      <option key={race.id} value={String(race.id)}>
                        R{race.race_number} {race.race_name} — {race.distance_m || "—"}m
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Horse search"
                hint="Select a saved horse if it’s the right one. If not, leave the typed name and add runner."
              >
                <TextInput
                  value={horseQuery}
                  onChange={(value) => {
                    setHorseQuery(value);
                    setSelectedHorseId("");
                  }}
                  placeholder="Private Harry"
                />
              </Field>

              {horseQuery.trim() ? (
                <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Horse suggestions
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredHorseSuggestions.length > 0 ? (
                      filteredHorseSuggestions.map((horse) => (
                        <button
                          key={horse.id}
                          type="button"
                          onClick={() => handleSelectHorse(horse)}
                          className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                            selectedHorseId === String(horse.id)
                              ? "bg-black text-amber-300"
                              : "border border-amber-300/40 bg-white text-zinc-800 hover:bg-amber-100"
                          }`}
                        >
                          {horse.horse_name}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-600">
                        No saved horse matched. Add runner to create this horse in the master list.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Jockey">
                  <TextInput
                    value={jockeyName}
                    onChange={setJockeyName}
                    placeholder="J McDonald"
                  />
                </Field>

                <Field label="Trainer">
                  <TextInput
                    value={trainerName}
                    onChange={setTrainerName}
                    placeholder="Chris Waller"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Barrier">
                  <TextInput
                    value={barrier}
                    onChange={setBarrier}
                    placeholder="4"
                  />
                </Field>

                <Field label="Market price">
                  <TextInput
                    value={marketPrice}
                    onChange={setMarketPrice}
                    placeholder="3.80"
                  />
                </Field>

                <Field label="Last 3 starts">
                  <TextInput
                    value={formLast3}
                    onChange={setFormLast3}
                    placeholder="1-2-1"
                  />
                </Field>
              </div>

              <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                  Selected race
                </p>
                <p className="mt-2 text-sm text-zinc-700">
                  {selectedRace
                    ? `R${selectedRace.race_number} ${selectedRace.race_name} — ${selectedRace.distance_m || "—"}m`
                    : "Choose a meeting and race to load runners cleanly."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddRunner}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Runner"}
                </button>
                <button
                  type="button"
                  onClick={clearRunnerForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">4. Runner board</h2>
                <Badge tone="green">{initialRunners.length} loaded</Badge>
              </div>

              <div className="space-y-4">
                {initialRaces.length > 0 ? (
                  initialRaces.map((race) => {
                    const meeting = initialMeetings.find((item) => item.id === race.meeting_id);
                    const raceRunners = runnersForRace(race.id);

                    return (
                      <div
                        key={race.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-zinc-950">
                                {meeting?.meeting_name || "Meeting"} · R{race.race_number}
                              </p>
                              <Badge tone={getRaceStatusTone(race.status)}>
                                {race.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-zinc-500">
                              {race.race_name} · {race.distance_m || "—"}m
                            </p>
                          </div>
                          <Badge tone="amber">{raceRunners.length} runners</Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          {raceRunners.length > 0 ? (
                            raceRunners.map((runner) => (
                              <div
                                key={runner.id}
                                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-zinc-950">
                                      {findHorseName(runner.horse_id)}
                                    </p>
                                    <p className="text-sm text-zinc-500">
                                      Jockey: {runner.jockey_name || "—"} · Trainer:{" "}
                                      {runner.trainer_name || "—"}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {runner.barrier ? (
                                      <Badge tone="blue">Barrier {runner.barrier}</Badge>
                                    ) : null}
                                    {runner.market_price !== null ? (
                                      <Badge tone="green">${runner.market_price}</Badge>
                                    ) : null}
                                    {runner.form_last_3 ? (
                                      <Badge tone="slate">{runner.form_last_3}</Badge>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRunner(runner.id)}
                                      disabled={isPending}
                                      className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-zinc-500">
                              No runners loaded into this race yet.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">No races available yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What this gives us now</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Separate Race Builder route</p>
                <p>• Persistent horse master list</p>
                <p>• Meeting → Race → Runner structure</p>
                <p>• Publish / unpublish control</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Next backend step</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Add edit controls</p>
                <p>• Add CSV upload into meetings or runners</p>
                <p>• Add more race-day attributes</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Subscriber release path</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Show published races only</p>
                <p>• Let subscribers pick meeting → race → horse</p>
                <p>• Then run SmartPunt calculator from stored runners</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
