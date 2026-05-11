"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOutAction } from "@/lib/actions";
import {
  buildHorseHistory,
  calculateRaceScores,
  formatFormLine,
  getFactorStatus,
  getRaceVerdict,
  getSelectedHorseSummary,
  roundScore,
  type Horse,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";

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
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("80");

  const publishedRaces = useMemo(
    () => races.filter((race) => race.status === "published"),
    [races],
  );

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

    const publishedRaceIds = new Set(publishedRaces.map((race) => race.id));
    const runner = runners.find(
      (item) => item.horse_id === selectedHorse.id && publishedRaceIds.has(item.race_id),
    );

    if (!runner) return null;

    return publishedRaces.find((race) => race.id === runner.race_id) || null;
  }, [publishedRaces, runners, selectedHorse]);

  const activeRace = useMemo(() => {
    if (selectedRaceId) {
      return publishedRaces.find((race) => String(race.id) === selectedRaceId) || null;
    }

    return horseRace;
  }, [horseRace, publishedRaces, selectedRaceId]);

  const scoredRunners = useMemo(
    () =>
      calculateRaceScores({
        activeRace,
        races,
        runners,
        horses,
        meetings,
      }),
    [activeRace, horses, meetings, races, runners],
  );

  const selectedHorseScore = useMemo(() => {
    if (!selectedHorse) return null;
    return scoredRunners.find((runner) => runner.horse_id === selectedHorse.id) || null;
  }, [scoredRunners, selectedHorse]);

  const topWinChance = scoredRunners[0] || null;
  const topPlaceChances = [...scoredRunners]
    .sort((a, b) => b.placePercent - a.placePercent)
    .slice(0, 3);

  const raceVerdict = useMemo(() => getRaceVerdict(scoredRunners), [scoredRunners]);
  const strongestBets = useMemo(() => {
  return publishedRaces
    .map((race) => {
      const scored = calculateRaceScores({
        activeRace: race,
        races,
        runners,
        horses,
        meetings,
      });

      if (!scored.length) return null;

      const top = scored[0];
      const second = scored[1];

      const gap = second
        ? roundScore(top.score - second.score)
        : roundScore(top.score);

      const verdict = getRaceVerdict(scored);

      return {
        race,
        top,
        gap,
        verdict,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aStrength =
        Number(a?.top?.score || 0) + Number(a?.gap || 0);

      const bStrength =
        Number(b?.top?.score || 0) + Number(b?.gap || 0);

      return bStrength - aStrength;
    })
    .slice(0, 5);
}, [horses, meetings, publishedRaces, races, runners]);

  const alertCandidates = useMemo(() => {
    const threshold = Number(alertThreshold);
    if (Number.isNaN(threshold)) return [];

    return scoredRunners.filter((runner) => runner.score >= threshold);
  }, [alertThreshold, scoredRunners]);

  const selectedHorseHistory = useMemo(() => {
    if (!selectedHorse) return [];
    return buildHorseHistory(selectedHorse.id, runners, races, meetings);
  }, [meetings, races, runners, selectedHorse]);

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
                <Link href="/admin/race-builder" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Race Builder
                </Link>
                <Link href="/current-races" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Current Races
                </Link>
                <Link href="/race-archive" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Race Archive
                </Link>
                <Link href="/admin/calculator-report" className="rounded-2xl border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 backdrop-blur-sm transition hover:bg-amber-500/30">
  Calculator Report
</Link>
                <Link href="/admin/horses" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Saved Horses
                </Link>
                <Link href="/" className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                  Back to Admin
                </Link>
                <form action={signOutAction}>
                  <button type="submit" className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 backdrop-blur-sm transition hover:bg-red-500/30">
                    Log Out
                  </button>
                </form>
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
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{publishedRaces.length} published races</Badge>
                <Badge tone="blue">{horses.length} saved horses</Badge>
                <Badge tone="amber">No market influence</Badge>
                <Badge tone="green">Auto-saved on publish</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
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
                    {publishedRaces.map((race) => {
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

              <div>
                <label className="text-sm font-medium text-zinc-700">Alert threshold</label>
                <div className="mt-2">
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200/30 px-4 py-3 outline-none transition focus:border-amber-300"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Later this can trigger alerts to the head tipper for strong-rated runners.
                </p>
              </div>

              {selectedHorse ? (
                <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                    Selected horse snapshot
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-zinc-950">
                    {selectedHorse.horse_name}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-700">
                    Recent form: {formatFormLine(selectedHorseHistory)}
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Race summary</h2>
                  <p className="text-sm text-zinc-500">
                    The selected race is always scored as a full field.
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
                          {topWinChance?.meeting_name || "Meeting"}{" "}
                          {topWinChance?.meeting_date ? `· ${topWinChance.meeting_date}` : ""}
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

                  {raceVerdict ? (
                    <div className="rounded-[24px] border border-amber-300/40 bg-amber-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                        SmartPunt race verdict
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-zinc-950">
                        Best Bet: {raceVerdict.type}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="green">{raceVerdict.confidence}</Badge>
                        {topWinChance ? (
                          <Badge tone="blue">Top Rated: {topWinChance.horse_name}</Badge>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm text-zinc-700">{raceVerdict.reason}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Most likely winner
                      </p>
                      <p className="mt-2 text-lg font-bold text-zinc-950">
                        {topWinChance?.horse_name || "—"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Win chance: {topWinChance?.winPercent ?? 0}% · Score:{" "}
                        {topWinChance ? roundScore(topWinChance.score) : 0}
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
                        <Badge tone="amber">Score {roundScore(selectedHorseScore.score)}</Badge>
                      </div>

                      <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Why this rating
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {[
                            ["Recent form", selectedHorseScore.components.recentForm],
                            ["Distance", selectedHorseScore.components.distance],
                            ["Track", selectedHorseScore.components.track],
                            ["Conditions", selectedHorseScore.components.condition],
                            ["Barrier", selectedHorseScore.components.barrier],
                            ["Effective weight", selectedHorseScore.components.weight],
                            ["Jockey", selectedHorseScore.components.jockey],
                            ["Trainer", selectedHorseScore.components.trainer],
                          ].map(([label, score]) => {
                            const status = getFactorStatus(Number(score));
                            return (
                              <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                                <span className="text-sm font-medium text-zinc-800">{label}</span>
                                <Badge tone={status.tone}>{status.text}</Badge>
                              </div>
                            );
                          })}
                        </div>

                        <p className="mt-4 text-sm leading-6 text-zinc-700">
                          {getSelectedHorseSummary(selectedHorseScore)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[24px] border border-rose-200/40 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">
                      Alert candidates
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                      {alertCandidates.length > 0 ? (
                        alertCandidates.map((runner) => (
                          <p key={runner.id}>
                            {runner.horse_name} — Score {roundScore(runner.score)}
                          </p>
                        ))
                      ) : (
                        <p>No runners currently exceed the threshold.</p>
                      )}
                    </div>
                  </div>
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
                  This version scores recent form, distance, track, conditions, barrier, effective weight, jockey, and trainer. Market has been removed completely.
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
                          <p className="text-sm text-zinc-500">Rank #{runner.rank}</p>
                          <h3 className="mt-1 text-xl font-bold text-zinc-950">
                            {runner.horse_name}
                          </h3>
                          <p className="mt-2 text-sm text-zinc-600">
                            Jockey: {runner.jockey_name || "—"} · Barrier: {runner.barrier ?? "—"} · Weight:{" "}
                            {runner.weight_kg ?? "—"}
                            {runner.effectiveWeight !== null
                              ? ` · Effective: ${runner.effectiveWeight}kg`
                              : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="green">Win {runner.winPercent}%</Badge>
                          <Badge tone="blue">Place {runner.placePercent}%</Badge>
                          <Badge tone="amber">{runner.verdict}</Badge>
                          <Badge tone="slate">Score {roundScore(runner.score)}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-8">
                        {[
                          ["Form", runner.components.recentForm],
                          ["Distance", runner.components.distance],
                          ["Track", runner.components.track],
                          ["Conditions", runner.components.condition],
                          ["Barrier", runner.components.barrier],
                          ["Weight", runner.components.weight],
                          ["Jockey", runner.components.jockey],
                          ["Trainer", runner.components.trainer],
                        ].map(([label, score]) => (
                          <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              {label}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {roundScore(Number(score))}
                            </p>
                          </div>
                        ))}
                      </div>

                      {runner.form_last_6 || runner.form_last_3 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Recent form snapshot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_6 || runner.form_last_3}
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
              <h3 className="text-lg font-semibold">What this version adds</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Market removed completely</p>
<p>• New v2 weighted SmartPunt score</p>
                <p>• Distance-aware barrier logic</p>
                <p>• Flemington wide-barrier exception</p>
                <p>• Effective weight using apprentice claim</p>
                <p>• Jockey and trainer history</p>
                <p>• Automatic prediction snapshots on publish</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
<h3 className="text-lg font-semibold">Scoring weights v2</h3>
<div className="mt-4 space-y-2 text-sm text-zinc-600">
  <p>• Recent form: 26%</p>
  <p>• Barrier: 16%</p>
  <p>• Distance: 12%</p>
  <p>• Track: 9%</p>
  <p>• Condition: 8%</p>
  <p>• Weight / claim: 8%</p>
  <p>• Jockey: 8%</p>
  <p>• Trainer: 5%</p>
  <p>• Consistency: 8%</p>
</div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Still to come</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Attach actual results to predictions</p>
                <p>• Daily calculator report</p>
                <p>• Running style</p>
                <p>• Speed map</p>
                <p>• Better place modelling</p>
                <p>• Subscriber calculator flow</p>
                <p>• My Active Tips integration</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
