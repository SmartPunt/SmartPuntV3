"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createSubscriberUserAction,
  deleteLongTermBetAction,
  deleteSuggestedTipAction,
  deleteWatchItemAction,
  signOutAction,
  upsertLongTermBet,
  upsertSuggestedTip,
  upsertWatchItem,
} from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

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
  status: "draft" | "published" | "closed";
  published_at: string | null;
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
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  scratched?: boolean | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Input({
  name,
  placeholder,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300 ${
        readOnly ? "bg-zinc-100 text-zinc-600" : ""
      }`}
    />
  );
}

function Textarea({
  name,
  placeholder,
  value,
  onChange,
  minHeight = "120px",
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
}) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
      style={{ minHeight }}
    />
  );
}

function detectBestTag({
  confidence,
  type,
  notes,
}: {
  confidence: string;
  type: string;
  notes: string;
}) {
  const n = notes.toLowerCase();

  if (confidence === "High" && type === "Win") return "Best Bet";
  if (n.includes("overs") || n.includes("value") || n.includes("price")) return "Value Bet";
  if (type === "Place") return "Safe Play";
  if (n.includes("watch") || n.includes("forgive")) return "Horse to Watch";

  return "Best Bet";
}

function getTipCardStyle(type: string) {
  if (type === "Win") return "border-emerald-300/50 bg-emerald-100";
  if (type === "Place") return "border-sky-300/50 bg-sky-100";
  if (type === "All Up") return "border-pink-300/50 bg-pink-100";
  return "border-amber-200/30 bg-white";
}

function formatDateForInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatTimeForInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
}

function buildRaceLabel(race: Race, meeting?: Meeting | null) {
  return `${meeting?.meeting_name || "Meeting"} R${race.race_number} ${race.race_name} — ${race.distance_m || "—"}m`;
}

export default function AdminDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
  initialPublishedRaces,
  initialPublishedRunners,
  initialHorses,
  initialMeetings,
}: {
  currentUser: any;
  initialSuggestedTips: any[];
  initialWatchlistItems: any[];
  initialLongTermBets: any[];
  initialPublishedRaces: Race[];
  initialPublishedRunners: Runner[];
  initialHorses: Horse[];
  initialMeetings: Meeting[];
}) {
  const suggestedTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const [tipEdit, setTipEdit] = useState<any | null>(null);
  const [watchEdit, setWatchEdit] = useState<any | null>(null);
  const [longEdit, setLongEdit] = useState<any | null>(null);

  const [selectedPublishedRaceId, setSelectedPublishedRaceId] = useState("");
  const [selectedRunnerId, setSelectedRunnerId] = useState("");

  const [tipRace, setTipRace] = useState("");
  const [tipHorse, setTipHorse] = useState("");
  const [tipType, setTipType] = useState("Win");
  const [tipConfidence, setTipConfidence] = useState("High");
  const [tipNote, setTipNote] = useState("Best Bet");
  const [tipperNotes, setTipperNotes] = useState("");
  const [tipCommentary, setTipCommentary] = useState("");
  const [tipRaceDate, setTipRaceDate] = useState("");
  const [tipRaceTime, setTipRaceTime] = useState("");
  const [tipRaceTimezone, setTipRaceTimezone] = useState("Australia/Perth");
  const [tipFinishingPosition, setTipFinishingPosition] = useState("");
  const [tipSuccessful, setTipSuccessful] = useState("");
  const [tipResultComment, setTipResultComment] = useState("");
  const [suggestedTag, setSuggestedTag] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [userState, createUserFormAction] = useActionState(createSubscriberUserAction, {
    error: null,
    success: null,
  });

  const meetingMap = useMemo(() => {
    return new Map(initialMeetings.map((meeting) => [meeting.id, meeting]));
  }, [initialMeetings]);

  const horseMap = useMemo(() => {
    return new Map(initialHorses.map((horse) => [horse.id, horse]));
  }, [initialHorses]);

  const selectedPublishedRace = useMemo(() => {
    return initialPublishedRaces.find((race) => String(race.id) === selectedPublishedRaceId) || null;
  }, [initialPublishedRaces, selectedPublishedRaceId]);

  const runnersForSelectedRace = useMemo(() => {
    if (!selectedPublishedRace) return [];
    return initialPublishedRunners
      .filter((runner) => runner.race_id === selectedPublishedRace.id && !runner.scratched)
      .sort((a, b) => {
        const aBarrier = a.barrier ?? 999;
        const bBarrier = b.barrier ?? 999;
        return aBarrier - bBarrier;
      });
  }, [initialPublishedRunners, selectedPublishedRace]);

  const selectedRunner = useMemo(() => {
    return runnersForSelectedRace.find((runner) => String(runner.id) === selectedRunnerId) || null;
  }, [runnersForSelectedRace, selectedRunnerId]);

  const selectedRunnerHorse = selectedRunner ? horseMap.get(selectedRunner.horse_id) || null : null;
  const selectedRaceMeeting = selectedPublishedRace
    ? meetingMap.get(selectedPublishedRace.meeting_id) || null
    : null;

  function syncTipFromSelection(race: Race | null, runner: Runner | null) {
    if (!race || !runner) return;

    const meeting = meetingMap.get(race.meeting_id) || null;
    const horse = horseMap.get(runner.horse_id) || null;

    setTipRace(buildRaceLabel(race, meeting));
    setTipHorse(horse?.horse_name || "Unknown horse");

    if (!tipRaceDate) {
      setTipRaceDate(meeting?.meeting_date || "");
    }
  }

  function loadTipIntoForm(tip: any) {
    setTipEdit(tip);

    setSelectedPublishedRaceId(tip.race_id ? String(tip.race_id) : "");
    setSelectedRunnerId(tip.race_runner_id ? String(tip.race_runner_id) : "");

    setTipRace(tip.race || "");
    setTipHorse(tip.horse || "");
    setTipType(tip.type || "Win");
    setTipConfidence(tip.confidence || "High");
    setTipNote(tip.note || "Best Bet");
    setTipCommentary(tip.commentary || "");
    setTipperNotes("");
    setSuggestedTag(tip.note || "");
    setTipRaceDate(formatDateForInput(tip.race_start_at));
    setTipRaceTime(formatTimeForInput(tip.race_start_at));
    setTipRaceTimezone(tip.race_timezone || "Australia/Perth");
    setTipFinishingPosition(
      tip.finishing_position === null || tip.finishing_position === undefined
        ? ""
        : String(tip.finishing_position),
    );
    setTipSuccessful(typeof tip.successful === "boolean" ? String(tip.successful) : "");
    setTipResultComment(tip.result_comment || "");
  }

  function clearTipForm() {
    setTipEdit(null);
    setSelectedPublishedRaceId("");
    setSelectedRunnerId("");
    setTipRace("");
    setTipHorse("");
    setTipType("Win");
    setTipConfidence("High");
    setTipNote("Best Bet");
    setTipperNotes("");
    setTipCommentary("");
    setTipRaceDate("");
    setTipRaceTime("");
    setTipRaceTimezone("Australia/Perth");
    setTipFinishingPosition("");
    setTipSuccessful("");
    setTipResultComment("");
    setSuggestedTag("");
    setGenerateError("");
  }

  async function generateCommentary() {
    setIsGenerating(true);
    setGenerateError("");

    try {
      const res = await fetch("/api/generate-commentary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          race: tipRace,
          horse: tipHorse,
          type: tipType,
          confidence: tipConfidence,
          note: tipNote,
          tipperNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate commentary.");
      }

      setTipCommentary(data.commentary || "");

      const detected = detectBestTag({
        confidence: tipConfidence,
        type: tipType,
        notes: tipperNotes,
      });

      setSuggestedTag(detected);
      setTipNote(detected);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate commentary.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/logo-animated.mp4" type="video/mp4" />
          </video>

          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.12)_30%,rgba(0,0,0,0.62)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Head Tipper Console</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
                <Link
                  href="/current-races"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Current Races
                </Link>
                <Link
                  href="/race-archive"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Archive
                </Link>
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Saved Horses
                </Link>
                <Link
                  href="/resulted-tips"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Resulted Tips
                </Link>
                <form action={signOutAction}>
                  <button className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                    Log out
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Fortune on 5 tipper backend
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Manage live tips, race links, watchlist runners and early betting angles.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{suggestedTips.length} live tips</Badge>
                <Badge tone="blue">{initialPublishedRaces.length} published races</Badge>
                <Badge tone="amber">{watchlistItems.length} watchlist items</Badge>
                <Badge tone="rose">{longTermBets.length} long-term bets</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Live tips
              </p>
              <p className="mt-2 text-3xl font-bold">{suggestedTips.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Active tips still live and unsettled.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Published races
              </p>
              <p className="mt-2 text-3xl font-bold">{initialPublishedRaces.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Linked races available for exact settlement.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Watchlist items
              </p>
              <p className="mt-2 text-3xl font-bold">{watchlistItems.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Horses and races worth keeping black-booked.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Long-term bets
              </p>
              <p className="mt-2 text-3xl font-bold">{longTermBets.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Early plays and futures already on the board.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-8">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel className="bg-white/95">
              <form action={createUserFormAction} className="space-y-5 p-6 text-zinc-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">Create Subscriber Login</h3>
                    <p className="text-sm text-zinc-500">
                      Create a new user login and matching Fortune on 5 profile in one step.
                    </p>
                  </div>
                  <Badge tone="amber">Admin</Badge>
                </div>

                <Field label="Full name">
                  <input
                    name="full_name"
                    placeholder="Subscriber name"
                    className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  />
                </Field>

                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    placeholder="subscriber@email.com"
                    className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  />
                </Field>

                <Field label="Temporary password">
                  <input
                    name="password"
                    type="text"
                    placeholder="At least 6 characters"
                    className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  />
                </Field>

                {userState?.error ? (
                  <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {userState.error}
                  </div>
                ) : null}

                {userState?.success ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {userState.success}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                >
                  Create User Login
                </button>
              </form>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <h3 className="text-xl font-semibold">Live Tip Notes</h3>
                <div className="mt-4 space-y-3 text-sm text-zinc-600">
                  <p>Live Tips now work off published race fields, not free text.</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">Published race</Badge>
                    <Badge tone="green">Exact runner link</Badge>
                    <Badge tone="amber">Perfect settlement</Badge>
                  </div>
                  <p className="pt-2">
                    Long-term bets and watchlist items stay flexible. Live Tips are now structured.
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white">Build Your Tip</h2>
            <p className="text-sm text-amber-100/70">
              Select a published race and runner first, then build the write-up and publish the tip.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel className="bg-white/95">
              <form action={upsertSuggestedTip} className="space-y-6 p-6 text-zinc-950">
                <input type="hidden" name="id" value={tipEdit?.id || ""} readOnly />
                <input
                  type="hidden"
                  name="meeting_id"
                  value={selectedRaceMeeting?.id || tipEdit?.meeting_id || ""}
                  readOnly
                />
                <input
                  type="hidden"
                  name="race_id"
                  value={selectedPublishedRace?.id || tipEdit?.race_id || ""}
                  readOnly
                />
                <input
                  type="hidden"
                  name="horse_id"
                  value={selectedRunnerHorse?.id || tipEdit?.horse_id || ""}
                  readOnly
                />
                <input
                  type="hidden"
                  name="race_runner_id"
                  value={selectedRunner?.id || tipEdit?.race_runner_id || ""}
                  readOnly
                />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">Fortune on 5 tip builder</h3>
                    <p className="text-sm text-zinc-500">
                      Live tips now require selection from a published race and runner.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tipEdit ? <Badge tone="blue">Editing</Badge> : null}
                    <Badge tone="green">{suggestedTips.length} live</Badge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Published race">
                    <select
                      value={selectedPublishedRaceId}
                      onChange={(e) => {
                        const nextRaceId = e.target.value;
                        setSelectedPublishedRaceId(nextRaceId);
                        setSelectedRunnerId("");
                        setTipRace("");
                        setTipHorse("");

                        const race =
                          initialPublishedRaces.find((item) => String(item.id) === nextRaceId) || null;

                        if (race) {
                          const meeting = meetingMap.get(race.meeting_id) || null;
                          setTipRace(buildRaceLabel(race, meeting));

                          if (!tipEdit) {
                            setTipRaceDate(meeting?.meeting_date || "");
                          }
                        }
                      }}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option value="">Select published race</option>
                      {initialPublishedRaces.map((race) => (
                        <option key={race.id} value={String(race.id)}>
                          {buildRaceLabel(race, meetingMap.get(race.meeting_id) || null)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Runner">
                    <select
                      value={selectedRunnerId}
                      onChange={(e) => {
                        const nextRunnerId = e.target.value;
                        setSelectedRunnerId(nextRunnerId);
                        const runner =
                          runnersForSelectedRace.find((item) => String(item.id) === nextRunnerId) || null;
                        syncTipFromSelection(selectedPublishedRace, runner);
                      }}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option value="">Select runner</option>
                      {runnersForSelectedRace.map((runner) => {
                        const horse = horseMap.get(runner.horse_id);
                        return (
                          <option key={runner.id} value={String(runner.id)}>
                            {horse?.horse_name || "Unknown horse"}
                            {runner.barrier ? ` — Barrier ${runner.barrier}` : ""}
                            {runner.market_price ? ` — $${runner.market_price}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Race">
                    <Input
                      name="race"
                      placeholder="Published race selection required"
                      value={tipRace}
                      onChange={setTipRace}
                      readOnly
                    />
                  </Field>

                  <Field label="Horse / Selection">
                    <Input
                      name="horse"
                      placeholder="Runner selection required"
                      value={tipHorse}
                      onChange={setTipHorse}
                      readOnly
                    />
                  </Field>
                </div>

                {selectedRunner ? (
                  <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      Linked runner
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRunner.barrier ? <Badge tone="blue">Barrier {selectedRunner.barrier}</Badge> : null}
                      {selectedRunner.market_price ? <Badge tone="green">${selectedRunner.market_price}</Badge> : null}
                      {selectedRunner.weight_kg ? <Badge tone="amber">{selectedRunner.weight_kg}kg</Badge> : null}
                      {selectedRunner.form_last_6 ? <Badge tone="slate">{selectedRunner.form_last_6}</Badge> : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Bet type">
                    <select
                      name="type"
                      value={tipType}
                      onChange={(e) => setTipType(e.target.value)}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option>Win</option>
                      <option>Place</option>
                      <option>All Up</option>
                    </select>
                  </Field>

                  <Field label="Confidence">
                    <select
                      name="confidence"
                      value={tipConfidence}
                      onChange={(e) => setTipConfidence(e.target.value)}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </Field>

                  <Field label="Tag">
                    <Input name="note" placeholder="Best Bet" value={tipNote} onChange={setTipNote} />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Race date">
                    <Input
                      name="race_date"
                      type="date"
                      placeholder=""
                      value={tipRaceDate}
                      onChange={setTipRaceDate}
                    />
                  </Field>

                  <Field label="Race time">
                    <Input
                      name="race_time"
                      type="time"
                      placeholder=""
                      value={tipRaceTime}
                      onChange={setTipRaceTime}
                    />
                  </Field>

                  <Field label="Track timezone">
                    <select
                      name="race_timezone"
                      value={tipRaceTimezone}
                      onChange={(e) => setTipRaceTimezone(e.target.value)}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option value="Australia/Perth">Australia/Perth</option>
                      <option value="Australia/Adelaide">Australia/Adelaide</option>
                      <option value="Australia/Darwin">Australia/Darwin</option>
                      <option value="Australia/Brisbane">Australia/Brisbane</option>
                      <option value="Australia/Sydney">Australia/Sydney</option>
                      <option value="Australia/Melbourne">Australia/Melbourne</option>
                      <option value="Australia/Hobart">Australia/Hobart</option>
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Finishing position">
                    <Input
                      name="finishing_position"
                      type="number"
                      placeholder="e.g. 1"
                      value={tipFinishingPosition}
                      onChange={setTipFinishingPosition}
                    />
                  </Field>

                  <Field label="Successful tip?">
                    <select
                      name="successful"
                      value={tipSuccessful}
                      onChange={(e) => setTipSuccessful(e.target.value)}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option value="">Not settled yet</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>

                <Field label="Post-race analysis">
                  <Textarea
                    name="result_comment"
                    placeholder="What actually happened? Example: got held up, right run but no finish, wrong tempo, huge run in defeat..."
                    value={tipResultComment}
                    onChange={setTipResultComment}
                    minHeight="120px"
                  />
                </Field>

                <Field label="Head tipper notes for AI">
                  <Textarea
                    name="tipper_notes_preview_only"
                    placeholder="Write raw thoughts here — map, tempo, value, forgive run, race shape..."
                    value={tipperNotes}
                    onChange={setTipperNotes}
                    minHeight="140px"
                  />
                </Field>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={generateCommentary}
                    disabled={isGenerating || !tipRace || !tipHorse}
                    className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-3 font-bold text-black transition hover:brightness-105 disabled:opacity-60"
                  >
                    {isGenerating ? "Generating..." : "⚡ Generate Fortune on 5 Commentary"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSuggestedTag(
                        detectBestTag({
                          confidence: tipConfidence,
                          type: tipType,
                          notes: tipperNotes,
                        }),
                      )
                    }
                    className="rounded-2xl border border-amber-300/30 bg-zinc-950 px-4 py-3 font-semibold text-amber-100 transition hover:bg-zinc-900"
                  >
                    Suggest Tag
                  </button>
                </div>

                {generateError ? (
                  <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {generateError}
                  </div>
                ) : null}

                {!tipEdit ? (
                  <label className="flex items-center gap-3 rounded-2xl border border-amber-200/30 bg-amber-50 px-4 py-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      name="send_notification"
                      value="true"
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    Send notification email to all active subscribers
                  </label>
                ) : null}

                <Field label="Final commentary">
                  <Textarea
                    name="commentary"
                    placeholder="Your Fortune on 5 commentary will appear here."
                    value={tipCommentary}
                    onChange={setTipCommentary}
                    minHeight="180px"
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={!tipEdit && (!selectedPublishedRace || !selectedRunner)}
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                  >
                    {tipEdit ? "Update Tip" : "Publish Tip"}
                  </button>

                  {(tipEdit || tipRace || tipHorse || tipCommentary || tipperNotes || tipResultComment) ? (
                    <button
                      type="button"
                      onClick={clearTipForm}
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Clear Form
                    </button>
                  ) : null}
                </div>
              </form>
            </Panel>

            <Panel className="bg-white/95">
              <div className="space-y-5 p-6 text-zinc-950">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Live Preview</h3>
                    <p className="text-sm text-zinc-500">
                      This is how the tip will feel on the subscriber side.
                    </p>
                  </div>
                  <TipPill type={tipType} />
                </div>

                <div className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(tipType)}`}>
                  <p className="text-sm text-zinc-500">{tipRace || "Published race required"}</p>
                  <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                    {tipHorse || "Select a runner"}
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tipConfidence ? <Badge tone="blue">{tipConfidence} confidence</Badge> : null}
                    <Badge tone="amber">{suggestedTag || tipNote || "Best Bet"}</Badge>
                    {tipRaceDate && tipRaceTime ? (
                      <Badge tone="slate">
                        {tipRaceDate} {tipRaceTime} ({tipRaceTimezone})
                      </Badge>
                    ) : null}
                    {tipFinishingPosition ? (
                      <Badge tone="slate">Placed {tipFinishingPosition}</Badge>
                    ) : null}
                    {tipSuccessful === "true" ? <Badge tone="green">Successful</Badge> : null}
                    {tipSuccessful === "false" ? <Badge tone="rose">Unsuccessful</Badge> : null}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-700">
                    {tipCommentary || "Your Fortune on 5 commentary will appear here."}
                  </p>

                  {tipResultComment ? (
                    <div className="mt-4 rounded-2xl bg-zinc-950/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Post-race analysis
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">{tipResultComment}</p>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">Live tips</h4>
                  <div className="mt-4 space-y-4">
                    {suggestedTips.map((tip: any) => (
                      <div
                        key={tip.id}
                        className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(
                          tip.type,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">{tip.race}</p>
                            <p className="mt-1 text-lg font-semibold text-zinc-950">{tip.horse}</p>
                          </div>
                          <TipPill type={tip.type} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {tip.confidence ? <Badge tone="blue">{tip.confidence}</Badge> : null}
                          {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
                          {tip.race_runner_id ? <Badge tone="green">Linked</Badge> : <Badge tone="rose">Legacy</Badge>}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-700">
                          {tip.commentary || ""}
                        </p>

                        {tip.result_comment ? (
                          <div className="mt-4 rounded-2xl bg-zinc-950/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Post-race analysis
                            </p>
                            <p className="mt-2 text-sm leading-6 text-zinc-700">
                              {tip.result_comment}
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => loadTipIntoForm(tip)}
                            className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Edit / Settle
                          </button>

                          <form action={deleteSuggestedTipAction}>
                            <input type="hidden" name="id" value={tip.id} />
                            <button className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="bg-white/95">
              <form action={upsertWatchItem} className="space-y-5 p-6 text-zinc-950">
                <input type="hidden" name="id" value={watchEdit?.id || ""} readOnly />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                    <p className="text-sm text-zinc-500">
                      Add smart race-day notes and runners to follow.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {watchEdit ? <Badge tone="blue">Editing</Badge> : null}
                    <Badge tone="amber">{watchlistItems.length} published</Badge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Race">
                    <input
                      name="race"
                      defaultValue={watchEdit?.race || ""}
                      placeholder="Belmont R2"
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>

                  <Field label="Horse / Focus">
                    <input
                      name="horse"
                      defaultValue={watchEdit?.horse || ""}
                      placeholder="River Charge"
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>
                </div>

                <Field label="Watch label">
                  <select
                    name="label"
                    defaultValue={watchEdit?.label || "Horse to Watch"}
                    className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  >
                    <option>Horse to Watch</option>
                    <option>Race to Watch</option>
                  </select>
                </Field>

                <Field label="Commentary">
                  <textarea
                    name="commentary"
                    defaultValue={watchEdit?.commentary || ""}
                    placeholder="Add your watchlist notes here."
                    className="min-h-[120px] w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                  >
                    {watchEdit ? "Update Watch Item" : "Publish Watch Item"}
                  </button>

                  {watchEdit ? (
                    <button
                      type="button"
                      onClick={() => setWatchEdit(null)}
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <h3 className="text-xl font-semibold">Manage watchlist items</h3>
                <div className="mt-5 space-y-4">
                  {watchlistItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">{item.race || "Watchlist"}</p>
                          <p className="mt-1 text-lg font-semibold text-zinc-950">
                            {item.horse || "Race note"}
                          </p>
                        </div>
                        <TipPill type={item.label} />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-600">
                        {item.commentary || ""}
                      </p>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWatchEdit(item)}
                          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Edit
                        </button>

                        <form action={deleteWatchItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="bg-white/95">
              <form action={upsertLongTermBet} className="space-y-5 p-6 text-zinc-950">
                <input type="hidden" name="id" value={longEdit?.id || ""} readOnly />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">Long-term bets</h3>
                    <p className="text-sm text-zinc-500">
                      Enter futures and longer-range betting opportunities.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {longEdit ? <Badge tone="blue">Editing</Badge> : null}
                    <Badge tone="rose">{longTermBets.length} published</Badge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Long-term bet title">
                    <input
                      name="title"
                      defaultValue={longEdit?.title || ""}
                      placeholder="Autumn futures"
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>

                  <Field label="Horse / Selection">
                    <input
                      name="horse"
                      defaultValue={longEdit?.horse || ""}
                      placeholder="Ocean Ember"
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Bet type">
                    <select
                      name="bet_type"
                      defaultValue={longEdit?.bet_type || "Win"}
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    >
                      <option>Win</option>
                      <option>Place</option>
                      <option>All Up</option>
                    </select>
                  </Field>

                  <Field label="Current odds">
                    <input
                      name="odds"
                      defaultValue={longEdit?.odds || ""}
                      placeholder="$12"
                      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>
                </div>

                <Field label="Commentary">
                  <textarea
                    name="commentary"
                    defaultValue={longEdit?.commentary || ""}
                    placeholder="Add your long-term angle here."
                    className="min-h-[120px] w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                  >
                    {longEdit ? "Update Long-Term Bet" : "Publish Long-Term Bet"}
                  </button>

                  {longEdit ? (
                    <button
                      type="button"
                      onClick={() => setLongEdit(null)}
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <h3 className="text-xl font-semibold">Manage long-term bets</h3>
                <div className="mt-5 space-y-4">
                  {longTermBets.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">{item.title}</p>
                          <p className="mt-1 text-lg font-semibold text-zinc-950">{item.horse}</p>
                        </div>
                        <TipPill type="Long Term" />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-600">
                        {item.commentary || ""}
                      </p>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLongEdit(item)}
                          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Edit
                        </button>

                        <form action={deleteLongTermBetAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
