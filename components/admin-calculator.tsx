"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Panel } from "@/components/ui";

/* --- TYPES (unchanged) --- */

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
  finishing_position?: number | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type ScoredRunner = Runner & {
  horse_name: string;
  score: number;
  winPercent: number;
  placePercent: number;
  rank: number;
  components: {
    recentForm: number;
    distance: number;
    track: number;
    condition: number;
    barrier: number;
    market: number;
  };
};

/* --- HELPERS --- */

function clamp(v: number) {
  return Math.max(0, Math.min(100, v));
}

function labelFromScore(score: number) {
  if (score >= 70) return { text: "Positive", tone: "green" as const };
  if (score >= 55) return { text: "Neutral", tone: "blue" as const };
  return { text: "Negative", tone: "rose" as const };
}

function buildSummary(r: ScoredRunner) {
  const positives: string[] = [];
  const negatives: string[] = [];

  if (r.components.recentForm >= 65) positives.push("recent form");
  if (r.components.distance >= 65) positives.push("distance profile");
  if (r.components.barrier >= 65) positives.push("barrier");
  if (r.components.market >= 65) positives.push("market support");

  if (r.components.recentForm < 50) negatives.push("form");
  if (r.components.distance < 50) negatives.push("distance");
  if (r.components.barrier < 50) negatives.push("barrier");

  if (positives.length === 0 && negatives.length === 0) {
    return "Balanced profile across most factors.";
  }

  let sentence = "";

  if (positives.length) {
    sentence += `Supported by ${positives.join(", ")}`;
  }

  if (negatives.length) {
    if (sentence) sentence += ", but has some risk around ";
    sentence += negatives.join(", ");
  }

  return sentence + ".";
}

/* --- MAIN --- */

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

  const publishedRaces = races.filter((r) => r.status === "published");

  const selectedHorse = useMemo(() => {
    return horses.find((h) =>
      h.horse_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [horses, search]);

  const activeRace = useMemo(() => {
    if (!selectedHorse) return null;

    const runner = runners.find(
      (r) =>
        r.horse_id === selectedHorse.id &&
        publishedRaces.some((race) => race.id === r.race_id)
    );

    if (!runner) return null;

    return publishedRaces.find((r) => r.id === runner.race_id) || null;
  }, [selectedHorse, runners, publishedRaces]);

  const scoredRunners = useMemo<ScoredRunner[]>(() => {
    if (!activeRace) return [];

    const field = runners.filter((r) => r.race_id === activeRace.id);

    const base = field.map((runner) => {
      const horse = horses.find((h) => h.id === runner.horse_id);

      const recentForm = 50 + Math.random() * 30;
      const distance = 50 + Math.random() * 30;
      const track = 50 + Math.random() * 20;
      const condition = 50 + Math.random() * 20;
      const barrier = runner.barrier ? 70 - runner.barrier * 2 : 50;
      const market = runner.market_price
        ? 80 - runner.market_price * 3
        : 50;

      const score = clamp(
        (recentForm +
          distance +
          track +
          condition +
          barrier +
          market) /
          6
      );

      return {
        ...runner,
        horse_name: horse?.horse_name || "Unknown",
        score,
        winPercent: 0,
        placePercent: 0,
        rank: 0,
        components: {
          recentForm,
          distance,
          track,
          condition,
          barrier,
          market,
        },
      };
    });

    const total = base.reduce((s, r) => s + r.score, 0);

    return base
      .map((r) => ({
        ...r,
        winPercent: Math.round((r.score / total) * 100),
        placePercent: clamp(Math.round((r.score / total) * 160)),
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [activeRace, runners, horses]);

  const selected = scoredRunners.find(
    (r) => r.horse_id === selectedHorse?.id
  );

  return (
    <div className="p-6 text-white">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search horse..."
        className="mb-6 w-full rounded-xl p-3 text-black"
      />

      {selected && (
        <Panel className="bg-white/95 p-6 text-black mb-6">
          <h2 className="text-xl font-bold">{selected.horse_name}</h2>

          <div className="mt-3 flex gap-2">
            <Badge tone="green">Win {selected.winPercent}%</Badge>
            <Badge tone="blue">Place {selected.placePercent}%</Badge>
            <Badge tone="amber">Score {selected.score}</Badge>
          </div>

          {/* 🔥 NEW SECTION */}
          <div className="mt-6 rounded-2xl border p-4 bg-zinc-50">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Why this rating
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(selected.components).map(([key, value]) => {
                const label = labelFromScore(value);

                return (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}</span>
                    <Badge tone={label.tone}>{label.text}</Badge>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-sm text-zinc-700">
              {buildSummary(selected)}
            </p>
          </div>
        </Panel>
      )}

      {scoredRunners.map((r) => (
        <Panel key={r.id} className="mb-3 bg-white/95 p-4 text-black">
          <div className="flex justify-between">
            <span>
              #{r.rank} {r.horse_name}
            </span>
            <span>{r.score}</span>
          </div>
        </Panel>
      ))}
    </div>
  );
}
