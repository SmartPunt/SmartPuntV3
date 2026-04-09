"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

type Horse = {
  id: string;
  name: string;
};

type Meeting = {
  id: string;
  name: string;
  date: string;
  trackCondition: string;
};

type Race = {
  id: string;
  meetingId: string;
  raceNumber: string;
  raceName: string;
  distance: string;
};

type Runner = {
  id: string;
  raceId: string;
  horseId: string;
  horseName: string;
  jockeyName: string;
  trainerName: string;
  barrier: string;
  marketPrice: string;
  formLast3: string;
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

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseHorseName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function RaceBuilderPage() {
  const [horses, setHorses] = useState<Horse[]>([
    { id: "horse_1", name: "Private Harry" },
    { id: "horse_2", name: "Bold Tempo" },
    { id: "horse_3", name: "Track Legend" },
  ]);

  const [meetings, setMeetings] = useState<Meeting[]>([
    {
      id: "meeting_1",
      name: "Randwick",
      date: "2026-04-09",
      trackCondition: "Soft 6",
    },
  ]);

  const [races, setRaces] = useState<Race[]>([
    {
      id: "race_1",
      meetingId: "meeting_1",
      raceNumber: "6",
      raceName: "Sprint Handicap",
      distance: "1200",
    },
  ]);

  const [runners, setRunners] = useState<Runner[]>([]);

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

  const [statusMessage, setStatusMessage] = useState("");

  const filteredHorseSuggestions = useMemo(() => {
    const query = horseQuery.trim().toLowerCase();
    if (!query) return horses.slice(0, 8);

    return horses
      .filter((horse) => horse.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [horseQuery, horses]);

  const racesForSelectedMeeting = useMemo(() => {
    if (!selectedMeetingIdForRunner) return [];
    return races.filter((race) => race.meetingId === selectedMeetingIdForRunner);
  }, [selectedMeetingIdForRunner, races]);

  const selectedRace = races.find((race) => race.id === selectedRaceIdForRunner);

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

  function handleAddMeeting() {
    if (!meetingName.trim() || !meetingDate) {
      setStatusMessage("Add a meeting name and date first.");
      return;
    }

    const newMeeting: Meeting = {
      id: createId("meeting"),
      name: meetingName.trim(),
      date: meetingDate,
      trackCondition: meetingTrackCondition,
    };

    setMeetings((prev) => [newMeeting, ...prev]);
    clearMeetingForm();
    setStatusMessage("Meeting added to Race Builder.");
  }

  function handleAddRace() {
    if (!selectedMeetingIdForRace || !raceNumber.trim() || !raceDistance.trim()) {
      setStatusMessage("Choose a meeting, then add race number and distance.");
      return;
    }

    const newRace: Race = {
      id: createId("race"),
      meetingId: selectedMeetingIdForRace,
      raceNumber: raceNumber.trim(),
      raceName: raceName.trim() || `Race ${raceNumber.trim()}`,
      distance: raceDistance.trim(),
    };

    setRaces((prev) => [newRace, ...prev]);
    clearRaceForm();
    setStatusMessage("Race added to the selected meeting.");
  }

  function handleSelectHorse(horse: Horse) {
    setSelectedHorseId(horse.id);
    setHorseQuery(horse.name);
  }

  function ensureHorse(): Horse | null {
    const trimmed = normaliseHorseName(horseQuery);
    if (!trimmed) return null;

    if (selectedHorseId) {
      const existing = horses.find((horse) => horse.id === selectedHorseId);
      if (existing) return existing;
    }

    const exact = horses.find(
      (horse) => horse.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exact) {
      setSelectedHorseId(exact.id);
      setHorseQuery(exact.name);
      return exact;
    }

    const newHorse: Horse = {
      id: createId("horse"),
      name: trimmed,
    };

    setHorses((prev) => [newHorse, ...prev]);
    setSelectedHorseId(newHorse.id);
    setHorseQuery(newHorse.name);
    return newHorse;
  }

  function handleAddRunner() {
    if (!selectedMeetingIdForRunner || !selectedRaceIdForRunner) {
      setStatusMessage("Choose a meeting and race first.");
      return;
    }

    const horse = ensureHorse();

    if (!horse) {
      setStatusMessage("Add or select a horse first.");
      return;
    }

    const duplicateRunner = runners.find(
      (runner) =>
        runner.raceId === selectedRaceIdForRunner &&
        runner.horseId === horse.id,
    );

    if (duplicateRunner) {
      setStatusMessage("That horse is already loaded into this race.");
      return;
    }

    const newRunner: Runner = {
      id: createId("runner"),
      raceId: selectedRaceIdForRunner,
      horseId: horse.id,
      horseName: horse.name,
      jockeyName: jockeyName.trim(),
      trainerName: trainerName.trim(),
      barrier: barrier.trim(),
      marketPrice: marketPrice.trim(),
      formLast3: formLast3.trim(),
    };

    setRunners((prev) => [newRunner, ...prev]);
    clearRunnerForm();
    setStatusMessage("Runner added to race.");
  }

  function runnersForRace(raceId: string) {
    return runners.filter((runner) => runner.raceId === raceId);
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
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">Phase 1</Badge>
                <Badge tone="blue">No live DB yet</Badge>
                <Badge tone="amber">Safe standalone build</Badge>
              </div>
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950">
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
                <Badge tone="amber">{meetings.length} meetings</Badge>
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
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                >
                  Add Meeting
                </button>
                <button
                  type="button"
                  onClick={clearMeetingForm}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
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
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-zinc-950">
                          {meeting.name}
                        </p>
                        <p className="text-sm text-zinc-500">{meeting.date}</p>
                      </div>
                      <Badge tone="amber">{meeting.trackCondition}</Badge>
                    </div>
                  </div>
                ))}
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
                <Badge tone="green">{races.length} races</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting">
                  <Select
                    value={selectedMeetingIdForRace}
                    onChange={setSelectedMeetingIdForRace}
                  >
                    <option value="">Select meeting</option>
                    {meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.name} — {meeting.date}
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
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                >
                  Add Race
                </button>
                <button
                  type="button"
                  onClick={clearRaceForm}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
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
                {races.map((race) => {
                  const meeting = meetings.find((item) => item.id === race.meetingId);

                  return (
                    <div
                      key={race.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-zinc-950">
                            R{race.raceNumber} {race.raceName}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {meeting?.name || "Unknown meeting"} · {race.distance}m
                          </p>
                        </div>
                        <Badge tone="blue">
                          {runnersForRace(race.id).length} runners
                        </Badge>
                      </div>
                    </div>
                  );
                })}
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
                    Search for an existing horse first. If it’s new, the master list grows automatically.
                  </p>
                </div>
                <Badge tone="rose">{horses.length} horses</Badge>
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
                    {meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.name} — {meeting.date}
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
                      <option key={race.id} value={race.id}>
                        R{race.raceNumber} {race.raceName} — {race.distance}m
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Horse search"
                hint="Start typing to match an existing horse. If no match is right, keep typing and add it as a new one."
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
                            selectedHorseId === horse.id
                              ? "bg-black text-amber-300"
                              : "border border-amber-300/40 bg-white text-zinc-800 hover:bg-amber-100"
                          }`}
                        >
                          {horse.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-600">
                        No match found yet. Add runner to create this horse in the master list.
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
                    ? `R${selectedRace.raceNumber} ${selectedRace.raceName} — ${selectedRace.distance}m`
                    : "Choose a meeting and race to load runners cleanly."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddRunner}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                >
                  Add Runner
                </button>
                <button
                  type="button"
                  onClick={clearRunnerForm}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
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
                <Badge tone="green">{runners.length} loaded</Badge>
              </div>

              <div className="space-y-4">
                {races.map((race) => {
                  const meeting = meetings.find((item) => item.id === race.meetingId);
                  const raceRunners = runnersForRace(race.id);

                  return (
                    <div
                      key={race.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-zinc-950">
                            {meeting?.name || "Meeting"} · R{race.raceNumber}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {race.raceName} · {race.distance}m
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
                                    {runner.horseName}
                                  </p>
                                  <p className="text-sm text-zinc-500">
                                    Jockey: {runner.jockeyName || "—"} · Trainer:{" "}
                                    {runner.trainerName || "—"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {runner.barrier ? (
                                    <Badge tone="blue">Barrier {runner.barrier}</Badge>
                                  ) : null}
                                  {runner.marketPrice ? (
                                    <Badge tone="green">${runner.marketPrice}</Badge>
                                  ) : null}
                                  {runner.formLast3 ? (
                                    <Badge tone="slate">{runner.formLast3}</Badge>
                                  ) : null}
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
                })}
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
                <p>• Master horse list growth over time</p>
                <p>• Meeting → Race → Runner structure</p>
                <p>• Reduced spelling issues with horse suggestions</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Next backend step</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Add Supabase tables for horses, meetings, races, and runners</p>
                <p>• Replace local state with real inserts and reads</p>
                <p>• Add duplicate checks server-side</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Then calculator layer</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Add SmartPunt scoring inputs to each runner</p>
                <p>• Save final score and recommendation</p>
                <p>• Power the subscriber calculator from stored runners</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
