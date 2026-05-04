"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_3: string | null;
  finishing_position?: number | null;
};

type Horse = {
  id: number;
  horse_name: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normaliseName(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreBarrier(barrier: number | null, distance: number | null, track?: string | null) {
  if (!barrier) return 50;

  const isFlemingtonStraight =
    normaliseName(track).includes("flemington") && distance !== null && distance <= 1200;

  if (isFlemingtonStraight) {
    return barrier <= 8 ? 65 : 58;
  }

  if (distance && distance <= 1200) {
    if (barrier <= 4) return 74;
    if (barrier <= 8) return 58;
    return 30;
  }

  if (barrier <= 4) return 68;
  if (barrier <= 8) return 60;
  return 48;
}

function scoreWeight(weight: number | null, claim: number | null) {
  if (!weight) return 50;

  const effective = weight - (claim || 0);

  if (effective <= 53) return 72;
  if (effective <= 55) return 66;
  if (effective <= 57) return 58;
  if (effective <= 59) return 50;
  return 40;
}

function scoreJockey(jockey: string | null, horseHistory: Runner[], allRunners: Runner[]) {
  if (!jockey) return 50;

  const sameCombo = horseHistory.filter(
    (run) => normaliseName(run.jockey_name) === normaliseName(jockey),
  );

  if (sameCombo.length > 0) {
    const wins = sameCombo.filter((r) => r.finishing_position === 1).length;
    const places = sameCombo.filter((r) => (r.finishing_position || 99) <= 3).length;
    return clamp(45 + wins * 12 + places * 6);
  }

  const overall = allRunners.filter(
    (run) => normaliseName(run.jockey_name) === normaliseName(jockey),
  );

  const wins = overall.filter((r) => r.finishing_position === 1).length;
  const places = overall.filter((r) => (r.finishing_position || 99) <= 3).length;

  return clamp(40 + wins * 4 + places * 2);
}

function scoreTrainer(trainer: string | null, allRunners: Runner[]) {
  if (!trainer) return 50;

  const trainerRuns = allRunners.filter(
    (run) => normaliseName(run.trainer_name) === normaliseName(trainer),
  );

  const wins = trainerRuns.filter((r) => r.finishing_position === 1).length;
  const places = trainerRuns.filter((r) => (r.finishing_position || 99) <= 3).length;

  return clamp(40 + wins * 3 + places * 2);
}

export default function AdminCalculator({
  races,
  runners,
  horses,
  meetings,
}: {
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
}) {
  const [search, setSearch] = useState("");

  const publishedRaces = useMemo(
    () => races.filter((race) => race.status === "published"),
    [races],
  );

  const matchingHorse = useMemo(() => {
    if (!search.trim()) return null;
    return horses.find((horse) =>
      horse.horse_name.toLowerCase().includes(search.trim().toLowerCase()),
    );
  }, [horses, search]);

  const activeRace = useMemo(() => {
    if (!matchingHorse) return null;
    const runner = runners.find(
      (runner) =>
        runner.horse_id === matchingHorse.id &&
        publishedRaces.some((race) => race.id === runner.race_id),
    );

    return runner ? publishedRaces.find((race) => race.id === runner.race_id) : null;
  }, [matchingHorse, runners, publishedRaces]);

  const scoredRunners = useMemo(() => {
    if (!activeRace) return [];

    const meeting = meetings.find((m) => m.id === activeRace.meeting_id);

    return runners
      .filter((runner) => runner.race_id === activeRace.id)
      .map((runner) => {
        const horseHistory = runners.filter((r) => r.horse_id === runner.horse_id);

        const barrier = scoreBarrier(
          runner.barrier,
          activeRace.distance_m,
          meeting?.meeting_name,
        );

        const weight = scoreWeight(
          runner.weight_kg,
          runner.is_apprentice ? runner.apprentice_claim_kg : 0,
        );

        const jockey = scoreJockey(runner.jockey_name, horseHistory, runners);
        const trainer = scoreTrainer(runner.trainer_name, runners);

        const score = Math.round(
          barrier * 0.25 +
            weight * 0.25 +
            jockey * 0.35 +
            trainer * 0.15,
        );

        return {
          ...runner,
          horse_name:
            horses.find((horse) => horse.id === runner.horse_id)?.horse_name || "Unknown",
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [activeRace, meetings, runners, horses]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">SmartPunt Calculator Lab</h1>
          <Link href="/">
            <Badge tone="amber">Back to Admin</Badge>
          </Link>
        </div>

        <Panel className="bg-white text-black p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search horse..."
            className="w-full rounded-xl border px-4 py-3"
          />
        </Panel>

        {activeRace ? (
          <Panel className="bg-white text-black p-6">
            <h2 className="text-xl font-bold mb-4">
              R{activeRace.race_number} {activeRace.race_name}
            </h2>

            <div className="space-y-3">
              {scoredRunners.map((runner, index) => (
                <div
                  key={runner.id}
                  className="rounded-xl border p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold">
                      #{index + 1} {runner.horse_name}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {runner.jockey_name || "—"} · {runner.trainer_name || "—"}
                    </p>
                  </div>
                  <Badge tone="green">{runner.score}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
