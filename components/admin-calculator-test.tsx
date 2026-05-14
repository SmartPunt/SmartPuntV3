"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import {
  calculateRaceScores,
  roundScore,
  type Horse,
  type JockeyProfile,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";

function normalise(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function AdminCalculatorTest({
  races,
  runners,
  horses,
  meetings,
  jockeyProfiles,
}: {
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
  jockeyProfiles: JockeyProfile[];
}) {
  const [horseName, setHorseName] = useState("");
  const [jockeyName, setJockeyName] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [meetingName, setMeetingName] = useState("Randwick");
  const [condition, setCondition] = useState("Good 4");
  const [distance, setDistance] = useState("1200");
  const [barrier, setBarrier] = useState("4");
  const [weight, setWeight] = useState("56");
  const [apprenticeClaim, setApprenticeClaim] = useState("");
  const [formLast6, setFormLast6] = useState("");
  const [trackForm, setTrackForm] = useState("");
  const [distanceForm, setDistanceForm] = useState("");
  const [conditionOverride, setConditionOverride] = useState("");

  const selectedHorse = useMemo(() => {
    const key = normalise(horseName);

    if (!key) return null;

    return (
      horses.find((horse) => normalise(horse.horse_name) === key) || null
    );
  }, [horseName, horses]);

  const selectedMeeting = useMemo(() => {
    const key = normalise(meetingName);

    if (!key) return null;

    return (
      meetings.find((meeting) =>
        normalise(meeting.meeting_name) === key,
      ) || null
    );
  }, [meetingName, meetings]);

  const trainerOptions = useMemo(() => {
    return Array.from(
      new Set(
        runners
          .map((runner) => runner.trainer_name)
          .filter(Boolean)
          .map((trainer) => String(trainer)),
      ),
    ).sort();
  }, [runners]);

  useEffect(() => {
    if (!selectedHorse) return;

    const horseRunners = runners.filter(
      (runner) => runner.horse_id === selectedHorse.id,
    );

    const latestRunner = horseRunners[0];

    if (!latestRunner) return;

    setFormLast6(latestRunner.form_last_6 || "");
    setTrackForm(latestRunner.track_form_last_6 || "");
    setDistanceForm(latestRunner.distance_form_last_6 || "");

    if (latestRunner.jockey_name) {
      setJockeyName(latestRunner.jockey_name);
    }

    if (latestRunner.trainer_name) {
      setTrainerName(latestRunner.trainer_name);
    }

    if (latestRunner.weight_kg) {
      setWeight(String(latestRunner.weight_kg));
    }
  }, [selectedHorse, runners]);

  const syntheticMeeting: Meeting = {
    id: -900001,
    meeting_name: meetingName || "Test Meeting",
    meeting_date: new Date().toISOString().slice(0, 10),
    track_condition: condition,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const syntheticRace: Race = {
    id: -900001,
    meeting_id: syntheticMeeting.id,
    race_number: 1,
    race_name: "Calculator Test Race",
    distance_m: Number(distance) || null,
    status: "published",
    published_at: new Date().toISOString(),
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const syntheticHorse: Horse =
    selectedHorse ||
    ({
      id: -900001,
      horse_name: horseName || "Test Horse",
      normalised_name: normalise(horseName || "test horse"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Horse);

  const syntheticRunner: Runner = {
    id: -900001,
    race_id: syntheticRace.id,
    horse_id: syntheticHorse.id,
    jockey_name: jockeyName || null,
    trainer_name: trainerName || null,
    barrier: barrier ? Number(barrier) : null,
    market_price: null,
    weight_kg: weight ? Number(weight) : null,
    is_apprentice: Boolean(apprenticeClaim),
    apprentice_claim_kg: apprenticeClaim
      ? Number(apprenticeClaim)
      : null,
    form_last_6: formLast6 || null,
    track_form_last_6: trackForm || null,
    distance_form_last_6: distanceForm || null,
    form_last_3: null,
    scratched: false,
    finishing_position: null,
    starting_price: null,
    won: null,
    placed: null,
    settled_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const scoredRunner = useMemo(() => {
    const scored = calculateRaceScores({
      activeRace: syntheticRace,
      races: [...races, syntheticRace],
      runners: [...runners, syntheticRunner],
      horses: selectedHorse
        ? horses
        : [...horses, syntheticHorse],
      meetings: [...meetings, syntheticMeeting],
      jockeyProfiles,
    });

    return scored[0] || null;
  }, [
    races,
    runners,
    horses,
    meetings,
    jockeyProfiles,
    syntheticRace,
    syntheticRunner,
    syntheticHorse,
    syntheticMeeting,
    selectedHorse,
  ]);

  const componentRows = scoredRunner
    ? [
        ["Recent form", scoredRunner.components.recentForm],
        ["Distance", scoredRunner.components.distance],
        ["Track", scoredRunner.components.track],
        ["Condition", scoredRunner.components.condition],
        ["Barrier", scoredRunner.components.barrier],
        ["Weight", scoredRunner.components.weight],
        ["Jockey", scoredRunner.components.jockey],
        ["Trainer", scoredRunner.components.trainer],
        ["Consistency", scoredRunner.components.consistency],
      ]
    : [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Calculator Test</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/calculator"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white"
                >
                  Calculator Lab
                </Link>

                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white"
                >
                  Back to Admin
                </Link>

                <form action={signOutAction}>
                  <button className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200">
                    Log Out
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4">
              <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                SmartPunt scoring laboratory
              </h1>

              <p className="mt-2 text-sm text-zinc-200">
                Build synthetic race scenarios and tune the live SmartPunt calculator engine.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel className="bg-white/95">
            <div className="space-y-4 p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Test inputs</h2>

              <div>
                <label className="text-sm font-medium">Horse</label>
                <input
                  list="horse-options"
                  value={horseName}
                  onChange={(e) => setHorseName(e.target.value)}
                  placeholder="Start typing saved horse..."
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <datalist id="horse-options">
                  {horses.map((horse) => (
                    <option
                      key={horse.id}
                      value={horse.horse_name}
                    />
                  ))}
                </datalist>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Jockey</label>

                  <input
                    list="jockey-options"
                    value={jockeyName}
                    onChange={(e) => setJockeyName(e.target.value)}
                    placeholder="Jockey"
                    className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                  />

                  <datalist id="jockey-options">
                    {jockeyProfiles.map((jockey) => (
                      <option
                        key={jockey.id}
                        value={jockey.jockey_name}
                      />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-sm font-medium">Trainer</label>

                  <input
                    list="trainer-options"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="Trainer"
                    className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                  />

                  <datalist id="trainer-options">
                    {trainerOptions.map((trainer) => (
                      <option
                        key={trainer}
                        value={trainer}
                      />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Meeting</label>

                <input
                  list="meeting-options"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                  placeholder="Meeting"
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <datalist id="meeting-options">
                  {meetings.map((meeting) => (
                    <option
                      key={meeting.id}
                      value={meeting.meeting_name}
                    />
                  ))}
                </datalist>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                >
                  <option>Good 3</option>
                  <option>Good 4</option>
                  <option>Soft 5</option>
                  <option>Soft 6</option>
                  <option>Soft 7</option>
                  <option>Heavy 8</option>
                  <option>Heavy 9</option>
                  <option>Heavy 10</option>
                  <option>Synthetic</option>
                </select>

                <input
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Distance"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <input
                  value={barrier}
                  onChange={(e) => setBarrier(e.target.value)}
                  placeholder="Barrier"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Weight kg"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <input
                  value={apprenticeClaim}
                  onChange={(e) => setApprenticeClaim(e.target.value)}
                  placeholder="Apprentice claim"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  value={formLast6}
                  onChange={(e) => setFormLast6(e.target.value)}
                  placeholder="Last 6"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <input
                  value={trackForm}
                  onChange={(e) => setTrackForm(e.target.value)}
                  placeholder="Track form"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />

                <input
                  value={distanceForm}
                  onChange={(e) => setDistanceForm(e.target.value)}
                  placeholder="Distance form"
                  className="rounded-2xl border border-amber-200/30 px-4 py-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Condition score override test
                </label>

                <input
                  value={conditionOverride}
                  onChange={(e) => setConditionOverride(e.target.value)}
                  placeholder="e.g. 75"
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-4 py-3"
                />
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Score output</h2>

              {scoredRunner ? (
                <>
                  <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-5">
                    <p className="text-sm text-zinc-500">Overall score</p>

                    <p className="mt-2 text-5xl font-bold text-zinc-950">
                      {roundScore(scoredRunner.score)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="green">
                        Win {scoredRunner.winPercent}%
                      </Badge>

                      <Badge tone="blue">
                        Place {scoredRunner.placePercent}%
                      </Badge>

                      <Badge tone="amber">
                        {scoredRunner.verdict}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {componentRows.map(([label, score]) => (
                      <div
                        key={String(label)}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          {label}
                        </p>

                        <p className="mt-2 text-2xl font-bold text-zinc-950">
                          {roundScore(Number(score))}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Enter test inputs to calculate a score.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
