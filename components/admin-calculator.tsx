"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Panel } from "@/components/ui";

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
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

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

type ScoredRunner = Runner & {
  horse_name: string;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  race_name: string;
  race_number: number;
  distance_m: number | null;
  score: number;
  winPercent: number;
  placePercent: number;
  verdict: string;
  rank: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreRunner(runner: Runner) {
  let score = 50;

  if (runner.barrier !== null && runner.barrier !== undefined) {
    if (runner.barrier <= 4) score += 8;
    else if (runner.barrier <= 8) score += 4;
    else if (runner.barrier >= 12) score -= 5;
    else score -= 2;
  }

  if (runner.market_price !== null && runner.market_price !== undefined) {
    if (runner.market_price < 3) score += 15;
    else if (runner.market_price < 5) score += 10;
    else if (runner.market_price < 8) score += 5;
    else if (runner.market_price > 15) score -= 8;
    else if (runner.market_price > 10) score -= 4;
  }

  if (runner.form_last_3) {
    const form = runner.form_last_3.replace(/\s+/g, "");
    const wins = (form.match(/1/g) || []).length;
    const seconds = (form.match(/2/g) || []).length;
    const thirds = (form.match(/3/g) || []).length;

    score += wins * 6;
    score += seconds * 3;
    score += thirds * 2;
  }

  return clamp(score);
}

function getVerdict(score: number) {
  if (score >= 80) return "Elite Play";
  if (score >= 70) return "Strong Bet";
  if (score >= 60) return "Speculative";
  return "Pass";
}

function normalisePercentages(scores: number[]) {
  const total = scores.reduce((sum, score) => sum + score, 0);
  if (total <= 0) {
    return scores.map(() => ({ winPercent: 0, placePercent: 0 }));
  }

  return scores.map((score) => {
    const winPercent = Math.round((score / total) * 100);

    const placeBase = Math.min(95, Math.round(winPercent * 1.9 + 12));

    return {
      winPercent: clamp(winPercent),
      placePercent: clamp(placeBase),
    };
  });
}

export default function AdminCalculator({
  currentUser,
  races,
  runners,
  horses,
  meetings,
}: {
  currentUser: any;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
}) {
  const [search, setSearch] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState("");

  const matchingHorses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    return horses
      .filter((horse) => horse.horse_name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [horses, search]);

  const selectedHorse = useMemo(() => {
    const exact = horses.find(
      (horse) => horse.horse_name.toLowerCase() === search.trim().toLowerCase(),
    );

    if (exact) return exact;

    return matchingHorses[0] || null;
  }, [horses, matchingHorses, search]);

  const horseRace = useMemo(() => {
    if (!selectedHorse) return null;

    const publishedRaceIds = new Set(races.map((race) => race.id));
    const runner = runners.find(
      (item) => item.horse_id === selectedHorse.id && publishedRaceIds.has(item.race_id),
    );

    if (!runner) return null;

    return races.find((race) => race.id === runner.race_id) || null;
  }, [races, runners, selectedHorse]);

  const activeRace = useMemo(() => {
    if (selectedRaceId) {
      return races.find((race) => String(race.id) === selectedRaceId) || null;
    }

    return horseRace;
  }, [horseRace, races, selectedRaceId]);

  const scoredRunners = useMemo<ScoredRunner[]>(() => {
    if (!activeRace) return [];

    const raceMeeting =
      meetings.find((meeting) => meeting.id === activeRace.meeting_id) || null;

    const field = runners.filter((runner) => runner.race_id === activeRace.id);

    const baseScores = field.map((runner) => scoreRunner(runner));
    const percentages = normalisePercentages(baseScores);

    return field
      .map((runner, index) => {
        const horse = horses.find((item) => item.id === runner.horse_id);

        return {
          ...runner,
          horse_name: horse?.horse_name || "Unknown horse",
          meeting_name: raceMeeting?.meeting_name || "Unknown meeting",
          meeting_date: raceMeeting?.meeting_date || "",
          track_condition: raceMeeting?.track_condition || null,
          race_name: activeRace.race_name,
          race_number: activeRace.race_number,
          distance_m: activeRace.distance_m,
          score: baseScores[index],
          winPercent: percentages[index].winPercent,
          placePercent: percentages[index].placePercent,
          verdict: getVerdict(baseScores[index]),
          rank: 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((runner, index) => ({
        ...runner,
        rank: index + 1,
      }));
  }, [activeRace, horses, meetings, runners]);

  const selectedHorseScore = useMemo(() => {
    if (!selectedHorse) return null;
    return scoredRunners.find((runner) => runner.horse_id === selectedHorse.id) || null;
  }, [scoredRunners, selectedHorse]);

  const topWinChance = scoredRunners[0] || null;
  const topPlaceChances = [...scoredRunners]
    .sort((a, b) => b.placePercent - a.placePercent)
    .slice(0, 3);

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
              <Badge tone="amber">Calculator Lab</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  SmartPunt calculator lab
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Admin-only modelling tool for published races, horse-triggered scoring, and race-wide ranking.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{races.length} published races</Badge>
                <Badge tone="blue">{horses.length} saved horses</Badge>
                <Badge tone="amber">Admin only</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div>
                <h2 className="text-xl font-semibold">Horse-triggered lookup</h2>
                <p className="text-sm text-zinc-500">
                  Enter or select a horse. The calculator checks if it is part of a published race,
                  then scores the whole field around it.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Search horse</label>
                <div className="mt-2">
                  <input
                    placeholder="Search horse name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>
              </div>

              {matchingHorses.length > 0 ? (
                <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Matching horses
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {matchingHorses.map((horse) => (
                      <button
                        key={horse.id}
                        type="button"
                        onClick={() => setSearch(horse.horse_name)}
                        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                          selectedHorse?.id === horse.id
                            ? "bg-black text-amber-300"
                            : "border border-amber-300/40 bg-white text-zinc-800 hover:bg-amber-100"
                        }`}
                      >
                        {horse.horse_name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-zinc-700">Or choose a published race</label>
                <div className="mt-2">
                  <select
                    value={selectedRaceId}
                    onChange={(e) => setSelectedRaceId(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  >
                    <option value="">Auto-detect from horse</option>
                    {races.map((race) => {
                      const meeting = meetings.find((item) => item.id === race.meeting_id);
                      return (
                        <option key={race.id} value={String(race.id)}>
                          {(meeting?.meeting_name || "Meeting")} · R{race.race_number} {race.race_name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                  Current calculator mode
                </p>
                <p className="mt-2 text-sm text-zinc-700">
                  This first version scores the field using a simple v1 model:
                  barrier, market expectation, and recent form snapshot.
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Race summary</h2>
                  <p className="text-sm text-zinc-500">
                    Race-wide scoring always runs across the full published field.
                  </p>
                </div>
                <Badge tone="amber">{scoredRunners.length} runners</Badge>
              </div>

              {activeRace ? (
                <>
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-500">
                          {topWinChance?.meeting_name || "Meeting"} {topWinChance?.meeting_date ? `· ${topWinChance.meeting_date}` : ""}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                          R{activeRace.race_number} {activeRace.race_name}
                        </h3>
                        <p className="mt-2 text-sm text-zinc-600">
                          {activeRace.distance_m || "—"}m
                          {topWinChance?.track_condition ? ` · ${topWinChance.track_condition}` : ""}
                        </p>
                      </div>
                      <Badge tone="green">Published</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Most likely winner
                      </p>
                      <p className="mt-2 text-lg font-bold text-zinc-950">
                        {topWinChance?.horse_name || "—"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Win chance: {topWinChance?.winPercent ?? 0}%
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                        Strongest place profiles
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        {topPlaceChances.map((runner) => (
                          <p key={runner.id}>
                            {runner.horse_name} — {runner.placePercent}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedHorseScore ? (
                    <div className="rounded-[24px] border border-amber-300/40 bg-amber-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                        Selected horse result
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-zinc-950">
                        {selectedHorseScore.horse_name}
                      </h3>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="green">Win {selectedHorseScore.winPercent}%</Badge>
                        <Badge tone="blue">Place {selectedHorseScore.placePercent}%</Badge>
                        <Badge tone="amber">{selectedHorseScore.verdict}</Badge>
                        <Badge tone="slate">Rank #{selectedHorseScore.rank}</Badge>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  No published race found yet for that horse. Use a horse that is loaded into a published race, or pick a published race manually.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Field scoring</h2>
                <p className="text-sm text-zinc-500">
                  This is the first skeleton view of how SmartPunt can rank a whole race field.
                </p>
              </div>
              <Badge tone="green">{scoredRunners.length} ranked</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {scoredRunners.length > 0 ? (
                scoredRunners.map((runner) => {
                  const isSelected = selectedHorse?.id === runner.horse_id;

                  return (
                    <div
                      key={runner.id}
                      className={`rounded-[24px] border p-5 shadow-sm ${
                        isSelected
                          ? "border-amber-300/50 bg-amber-50"
                          : "border-amber-200/30 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">
                            Rank #{runner.rank}
                          </p>
                          <h3 className="mt-1 text-xl font-bold text-zinc-950">
                            {runner.horse_name}
                          </h3>
                          <p className="mt-2 text-sm text-zinc-600">
                            Jockey: {runner.jockey_name || "—"} · Barrier: {runner.barrier ?? "—"} · Market: {runner.market_price ?? "—"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="green">Win {runner.winPercent}%</Badge>
                          <Badge tone="blue">Place {runner.placePercent}%</Badge>
                          <Badge tone="amber">{runner.verdict}</Badge>
                          <Badge tone="slate">Score {runner.score}</Badge>
                        </div>
                      </div>

                      {runner.form_last_3 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Recent form snapshot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_3}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  Once a published race is selected or auto-detected from a searched horse, the field rankings will appear here.
                </div>
              )}
            </div>
          </div>
        </Panel>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What this version does</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Horse-triggered race lookup</p>
                <p>• Published race selection</p>
                <p>• Full field ranking</p>
                <p>• Win and place percentages</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What comes next</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Distance suitability scoring</p>
                <p>• Track and condition scoring</p>
                <p>• Horse-history-backed form scoring</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Alert path later</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Threshold alerts for head tipper</p>
                <p>• Review before publishing official tips</p>
                <p>• Subscriber alerts later on</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
