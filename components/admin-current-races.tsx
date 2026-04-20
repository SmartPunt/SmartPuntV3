"use client";

import { useState } from "react";
import { Panel, Badge } from "@/components/ui";

type Runner = {
  id: string;
  horse_name: string;
};

type Race = {
  id: string;
  race_name: string;
  runners: Runner[];
};

type Props = {
  races: Race[];
};

function normalise(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove (NZ), (EM1), etc
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminCurrentRaces({ races }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [rawResults, setRawResults] = useState("");
  const [parsedResults, setParsedResults] = useState<
    { name: string; position: number }[]
  >([]);

  const [appliedResults, setAppliedResults] = useState<
    Record<string, number | "SCR">
  >({});

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  function parseResults() {
    const lines = rawResults
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = lines.map((line, index) => ({
      name: line,
      position: index + 1,
    }));

    setParsedResults(parsed);
  }

  function applyResults() {
    if (!selectedRace) return;

    const map: Record<string, number | "SCR"> = {};

    const normalisedParsed = parsedResults.map((p) => ({
      ...p,
      key: normalise(p.name),
    }));

    selectedRace.runners.forEach((runner) => {
      const key = normalise(runner.horse_name);

      const match = normalisedParsed.find((p) => p.key === key);

      if (match) {
        map[runner.id] = match.position;
      } else {
        map[runner.id] = "SCR";
      }
    });

    setAppliedResults(map);
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="p-4 space-y-4">
          <h2 className="text-xl font-bold">Quick Result Import</h2>

          <select
            className="w-full border p-2"
            onChange={(e) => setSelectedRaceId(e.target.value)}
          >
            <option value="">Select Race</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.race_name}
              </option>
            ))}
          </select>

          <textarea
            className="w-full border p-2 h-40"
            placeholder="Paste results here..."
            value={rawResults}
            onChange={(e) => setRawResults(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              className="bg-black text-white px-4 py-2"
              onClick={parseResults}
            >
              Parse Results
            </button>

            <button
              className="bg-yellow-500 text-black px-4 py-2"
              onClick={applyResults}
            >
              Apply Results
            </button>
          </div>
        </div>
      </Panel>

      {selectedRace && (
        <Panel>
          <div className="p-4">
            <h3 className="font-bold mb-4">{selectedRace.race_name}</h3>

            <div className="space-y-2">
              {selectedRace.runners.map((runner) => {
                const result = appliedResults[runner.id];

                return (
                  <div
                    key={runner.id}
                    className="flex justify-between border-b py-2"
                  >
                    <span>{runner.horse_name}</span>

                    <span>
                      {result === "SCR" ? (
                        <Badge tone="red">SCR</Badge>
                      ) : result ? (
                        <Badge tone="green">{result}</Badge>
                      ) : (
                        "-"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
