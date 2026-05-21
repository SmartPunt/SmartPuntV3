"use client";

import { useMemo, useState } from "react";

type RunnerOption = {
  id: number;
  raceId: number;
  raceLabel: string;
  horseLabel: string;
};

export default function AdminFortuneFiveLegSelector({
  legNumber,
  runnerOptions,
}: {
  legNumber: number;
  runnerOptions: RunnerOption[];
}) {
  const raceOptions = useMemo(() => {
    const raceMap = new Map<number, string>();

    for (const option of runnerOptions) {
      if (!raceMap.has(option.raceId)) {
        raceMap.set(option.raceId, option.raceLabel);
      }
    }

    return Array.from(raceMap.entries()).map(([id, label]) => ({
      id,
      label,
    }));
  }, [runnerOptions]);

  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");

  const filteredRunners = useMemo(() => {
    if (!selectedRaceId) return [];
    return runnerOptions.filter((option) => option.raceId === selectedRaceId);
  }, [runnerOptions, selectedRaceId]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        Leg {legNumber}
      </p>

      <select
        value={selectedRaceId ?? ""}
        onChange={(event) => {
          setSelectedRaceId(Number(event.target.value) || null);
          setSelectedRunnerId("");
        }}
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300"
      >
        <option value="">Select race</option>
        {raceOptions.map((race) => (
          <option key={race.id} value={race.id}>
            {race.label}
          </option>
        ))}
      </select>

      <select
        name={`leg_${legNumber}_race_runner_id`}
        value={selectedRunnerId}
        onChange={(event) => setSelectedRunnerId(event.target.value)}
        required
        disabled={!selectedRaceId}
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
      >
        <option value="">Select horse</option>
        {filteredRunners.map((runner) => (
          <option key={runner.id} value={runner.id}>
            {runner.horseLabel}
          </option>
        ))}
      </select>

      <select
        name={`leg_${legNumber}_bet_type`}
        defaultValue="Win"
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300"
      >
        <option value="Win">Win</option>
        <option value="Place">Place</option>
      </select>
    </div>
  );
}
