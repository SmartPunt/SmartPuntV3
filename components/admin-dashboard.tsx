"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
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

function formatLongTermRaceMeta(item: any) {
  const parts: string[] = [];

  if (item.meeting) parts.push(item.meeting);
  if (item.race_number) parts.push(`R${item.race_number}`);

  const dateValue = formatDateForInput(item.race_start_at);
  const timeValue = formatTimeForInput(item.race_start_at);

  if (dateValue && timeValue) {
    parts.push(`${dateValue} ${timeValue}`);
  } else if (dateValue) {
    parts.push(dateValue);
  }

  return parts.join(" · ");
}

export default function AdminDashboard({
  currentUser,
  initialSuggestedTips,
  initialWatchlistItems,
  initialLongTermBets,
}: {
  currentUser: any;
  initialSuggestedTips: any[];
  initialWatchlistItems: any[];
  initialLongTermBets: any[];
}) {
  const suggestedTips = useRealtimeTable("suggested_tips", initialSuggestedTips);
  const watchlistItems = useRealtimeTable("watchlist_items", initialWatchlistItems);
  const longTermBets = useRealtimeTable("long_term_bets", initialLongTermBets);

  const [tipEdit, setTipEdit] = useState<any | null>(null);
  const [resultEdit, setResultEdit] = useState<any | null>(null);
  const [watchEdit, setWatchEdit] = useState<any | null>(null);
  const [longEdit, setLongEdit] = useState<any | null>(null);

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
  const [suggestedTag, setSuggestedTag] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [resultFinishingPosition, setResultFinishingPosition] = useState("");
  const [resultSuccessful, setResultSuccessful] = useState("");
  const [resultComment, setResultComment] = useState("");

  const [longMeeting, setLongMeeting] = useState("");
  const [longRaceNumber, setLongRaceNumber] = useState("");
  const [longRaceDate, setLongRaceDate] = useState("");
  const [longRaceTime, setLongRaceTime] = useState("");
  const [longRaceTimezone, setLongRaceTimezone] = useState("Australia/Perth");

  const [userState, createUserFormAction] = useActionState(createSubscriberUserAction, {
    error: null,
    success: null,
  });

  function loadTipIntoForm(tip: any) {
    setTipEdit(tip);
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
    setGenerateError("");
  }

  function clearTipForm() {
    setTipEdit(null);
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
    setSuggestedTag("");
    setGenerateError("");
  }

  function loadTipIntoResultForm(tip: any) {
    setResultEdit(tip);
    setResultFinishingPosition(
      tip.finishing_position === null || tip.finishing_position === undefined
        ? ""
        : String(tip.finishing_position),
    );
    setResultSuccessful(typeof tip.successful === "boolean" ? String(tip.successful) : "");
    setResultComment(tip.result_comment || "");
  }

  function clearResultForm() {
    setResultEdit(null);
    setResultFinishingPosition("");
    setResultSuccessful("");
    setResultComment("");
  }

  function loadLongTermIntoForm(item: any) {
    setLongEdit(item);
    setLongMeeting(item.meeting || "");
    setLongRaceNumber(
      item.race_number === null || item.race_number === undefined ? "" : String(item.race_number),
    );
    setLongRaceDate(formatDateForInput(item.race_start_at));
    setLongRaceTime(formatTimeForInput(item.race_start_at));
    setLongRaceTimezone(item.race_timezone || "Australia/Perth");
  }

  function clearLongTermForm() {
    setLongEdit(null);
    setLongMeeting("");
    setLongRaceNumber("");
    setLongRaceDate("");
    setLongRaceTime("");
    setLongRaceTimezone("Australia/Perth");
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
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-amber-300/10 bg-black/20 p-5 backdrop-blur">
          <div className="rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,#0f0f0f,#27272a,#ca8a04)] p-5 text-white shadow-2xl">
            <img src="/logo.png" alt="Fortune on 5" className="mb-3 h-12 w-auto" />
            <h1 className="text-xl font-semibold">Head Tipper Console</h1>
            <p className="mt-2 text-sm text-amber-100/75">
              Live tips only. Settled tips move to the Resulted Tips page.
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            <Panel className="bg-white/95">
              <div className="p-4 text-zinc-950">
                <p className="text-sm text-zinc-500">Live tips</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-2xl font-semibold">{suggestedTips.length}</p>
                  <Badge tone="green">Unsettled</Badge>
                </div>
              </div>
            </Panel>

            <Panel className="bg-white/95">
              <div className="p-4 text-zinc-950">
                <Link
                  href="/resulted-tips"
                  className="block rounded-2xl bg-black px-4 py-3 text-center text-sm font-semibold text-amber-300 hover:bg-zinc-900"
                >
                  View Resulted Tips
                </Link>
              </div>
            </Panel>
          </div>

          <Panel className="mt-6 bg-white/95">
            <div className="space-y-3 p-4 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Logged in as</span>
                <Badge tone="blue">admin</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>User</span>
                <Badge tone="slate">{currentUser.full_name || currentUser.email}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Brand</span>
                <Badge tone="amber">Fortune on 5</Badge>
              </div>
            </div>
          </Panel>

          <div className="mt-5">
            <form action={signOutAction}>
              <button className="w-full rounded-2xl border border-amber-300/30 bg-zinc-950 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-zinc-900">
                Log out
              </button>
            </form>
          </div>
        </aside>

        <main className="p-4 lg:p-8">
          <div className="relative min-h-[200px] overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl lg:min-h-[280px]">
            <img
              src="/header-logo.png"
              alt="Fortune on 5"
              className="pointer-events-none absolute left-1/2 top-[45%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:top-[42%] lg:w-[900px]"
            />

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

            <div className="relative z-10 flex h-full min-h-[200px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
              <div className="flex items-start justify-between gap-3">
                <Badge tone="amber">Head Tipper Console</Badge>

                <div className="ml-auto flex flex-col items-end gap-2 lg:gap-3">
                  <Link
                    href="/admin/race-builder"
                    className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                  >
                    Race Builder
                  </Link>

                  <Link
                    href="/admin/horses"
                    className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                  >
                    Saved Horses
                  </Link>

                  <Link
                    href="/admin/calculator"
                    className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                  >
                    Calculator Lab
                  </Link>

                  <Link
                    href="/resulted-tips"
                    className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                  >
                    View Resulted Tips
                  </Link>
                  <form action={signOutAction}>
                    <button className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm">
                      Log out
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-auto">
                <div className="rounded-2xl bg-black/20 px-4 py-3 backdrop-blur-[1px] lg:px-5 lg:py-4">
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-white lg:gap-x-5">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-4xl">
                      Fortune on 5 tipper backend
                    </h2>
                    <p className="text-sm text-zinc-200 lg:text-base">
                      Build tips, settle races, manage the premium racing club feed, and test the calculator engine.
                    </p>
                    <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                      Logged in as {currentUser.full_name || currentUser.email}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="green">Live tips only</Badge>
                    <Badge tone="amber">Private admin trial</Badge>
                  </div>
                </div>
              </div>
            </div>
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
                    <p>Tips are now managed in two clean steps:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="amber">Build tip</Badge>
                      <Badge tone="blue">Publish live</Badge>
                      <Badge tone="green">Finalise separately</Badge>
                    </div>
                    <p className="pt-2">
                      When a race is over, use the separate finaliser window to record finishing
                      place, success, and post-race comments.
                    </p>
                  </div>
                </div>
              </Panel>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white">Build Your Tip</h2>
              <p className="text-sm text-amber-100/70">
                Enter the tip, add rough thoughts, let Fortune on 5 draft the write-up, then
                publish.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel className="bg-white/95">
                <form action={upsertSuggestedTip} className="space-y-6 p-6 text-zinc-950">
                  <input type="hidden" name="id" value={tipEdit?.id || ""} readOnly />
                  <input type="hidden" name="finishing_position" value="" readOnly />
                  <input type="hidden" name="successful" value="" readOnly />
                  <input type="hidden" name="result_comment" value="" readOnly />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Fortune on 5 tip builder</h3>
                      <p className="text-sm text-zinc-500">
                        Build and update live tips here. Resulting happens in its own separate
                        window below.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tipEdit ? <Badge tone="blue">Editing live tip</Badge> : null}
                      <Badge tone="green">{suggestedTips.length} live</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Race">
                      <Input name="race" placeholder="Ascot R3" value={tipRace} onChange={setTipRace} />
                    </Field>
                    <Field label="Horse / Selection">
                      <Input
                        name="horse"
                        placeholder="Ocean Ember"
                        value={tipHorse}
                        onChange={setTipHorse}
                      />
                    </Field>
                  </div>

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
                      disabled={isGenerating}
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
                      className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                    >
                      {tipEdit ? "Update Tip" : "Publish Tip"}
                    </button>

                    {(tipEdit || tipRace || tipHorse || tipCommentary || tipperNotes) ? (
                      <button
                        type="button"
                        onClick={clearTipForm}
                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Clear Builder
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
                    <p className="text-sm text-zinc-500">{tipRace || "Race"}</p>
                    <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                      {tipHorse || "Horse"}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tipConfidence ? <Badge tone="blue">{tipConfidence} confidence</Badge> : null}
                      <Badge tone="amber">{suggestedTag || tipNote || "Best Bet"}</Badge>
                      {tipRaceDate && tipRaceTime ? (
                        <Badge tone="slate">
                          {tipRaceDate} {tipRaceTime} ({tipRaceTimezone})
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-700">
                      {tipCommentary || "Your Fortune on 5 commentary will appear here."}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-amber-200/40 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                      Resulting workflow
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      Once a live tip is ready to settle, hit <span className="font-semibold">Finalise Race</span> from the live tip list. That opens a separate result window so you can record the finish cleanly without touching the original tip builder.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                      AI generation locked down
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      Generate Commentary now only updates the write-up. Your tag stays exactly as you set it unless you manually change it or hit Suggest Tag.
                    </p>
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
                          </div>

                          <p className="mt-3 text-sm leading-6 text-zinc-700">
                            {tip.commentary || ""}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadTipIntoForm(tip)}
                              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                            >
                              Edit Tip
                            </button>

                            <button
                              type="button"
                              onClick={() => loadTipIntoResultForm(tip)}
                              className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                            >
                              Finalise Race
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

            <div>
              <h2 className="text-2xl font-semibold text-white">Finalise a Resulted Tip</h2>
              <p className="text-sm text-amber-100/70">
                Record the finish, mark whether it landed, and add post-race analysis in a separate
                clean window.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel className="bg-white/95">
                <form action={upsertSuggestedTip} className="space-y-6 p-6 text-zinc-950">
                  <input type="hidden" name="id" value={resultEdit?.id || ""} readOnly />
                  <input type="hidden" name="race" value={resultEdit?.race || ""} readOnly />
                  <input type="hidden" name="horse" value={resultEdit?.horse || ""} readOnly />
                  <input type="hidden" name="type" value={resultEdit?.type || "Win"} readOnly />
                  <input
                    type="hidden"
                    name="confidence"
                    value={resultEdit?.confidence || "High"}
                    readOnly
                  />
                  <input type="hidden" name="note" value={resultEdit?.note || ""} readOnly />
                  <input
                    type="hidden"
                    name="commentary"
                    value={resultEdit?.commentary || ""}
                    readOnly
                  />
                  <input
                    type="hidden"
                    name="race_date"
                    value={formatDateForInput(resultEdit?.race_start_at)}
                    readOnly
                  />
                  <input
                    type="hidden"
                    name="race_time"
                    value={formatTimeForInput(resultEdit?.race_start_at)}
                    readOnly
                  />
                  <input
                    type="hidden"
                    name="race_timezone"
                    value={resultEdit?.race_timezone || "Australia/Perth"}
                    readOnly
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Race finaliser</h3>
                      <p className="text-sm text-zinc-500">
                        Use this window only for race result data and post-race comments.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {resultEdit ? <Badge tone="green">Finalising</Badge> : null}
                      <Badge tone="amber">Separate workflow</Badge>
                    </div>
                  </div>

                  {resultEdit ? (
                    <div className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(resultEdit.type)}`}>
                      <p className="text-sm text-zinc-500">{resultEdit.race}</p>
                      <h3 className="mt-1 text-2xl font-bold text-zinc-950">{resultEdit.horse}</h3>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {resultEdit.confidence ? (
                          <Badge tone="blue">{resultEdit.confidence} confidence</Badge>
                        ) : null}
                        {resultEdit.note ? <Badge tone="amber">{resultEdit.note}</Badge> : null}
                        <TipPill type={resultEdit.type} />
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-700">
                        {resultEdit.commentary || "No original commentary added."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-5 text-sm text-zinc-700">
                      Choose <span className="font-semibold">Finalise Race</span> from a live tip to
                      load it into this result window.
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Finishing position">
                      <Input
                        name="finishing_position"
                        type="number"
                        placeholder="e.g. 1"
                        value={resultFinishingPosition}
                        onChange={setResultFinishingPosition}
                      />
                    </Field>

                    <Field label="Successful tip?">
                      <select
                        name="successful"
                        value={resultSuccessful}
                        onChange={(e) => setResultSuccessful(e.target.value)}
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
                      value={resultComment}
                      onChange={setResultComment}
                      minHeight="140px"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={!resultEdit}
                      className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Finalise Tip
                    </button>

                    {(resultEdit || resultFinishingPosition || resultSuccessful || resultComment) ? (
                      <button
                        type="button"
                        onClick={clearResultForm}
                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Clear Finaliser
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Result Preview</h3>
                      <p className="text-sm text-zinc-500">
                        This shows how the settled tip data will read once recorded.
                      </p>
                    </div>
                    {resultEdit ? <TipPill type={resultEdit.type} /> : <Badge tone="slate">Waiting</Badge>}
                  </div>

                  <div
                    className={`rounded-[24px] border p-5 shadow-sm ${
                      resultEdit ? getTipCardStyle(resultEdit.type) : "border-amber-200/30 bg-white"
                    }`}
                  >
                    <p className="text-sm text-zinc-500">{resultEdit?.race || "Race"}</p>
                    <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                      {resultEdit?.horse || "Horse"}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {resultEdit?.confidence ? (
                        <Badge tone="blue">{resultEdit.confidence} confidence</Badge>
                      ) : null}
                      {resultEdit?.note ? <Badge tone="amber">{resultEdit.note}</Badge> : null}
                      {resultFinishingPosition ? (
                        <Badge tone="slate">Placed {resultFinishingPosition}</Badge>
                      ) : null}
                      {resultSuccessful === "true" ? <Badge tone="green">Successful</Badge> : null}
                      {resultSuccessful === "false" ? <Badge tone="rose">Unsuccessful</Badge> : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-700">
                      {resultEdit?.commentary || "Original tip commentary will stay exactly as published."}
                    </p>

                    {resultComment ? (
                      <div className="mt-4 rounded-2xl bg-zinc-950/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Post-race analysis
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-700">{resultComment}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      Cleaner admin flow
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      Editing the tip and resulting the race are now split. That means less clutter,
                      less chance of accidental changes, and a cleaner workflow for race-day admin.
                    </p>
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
                      <h3 className="text-xl font-semibold">Get On Early 🔥</h3>
                      <p className="text-sm text-zinc-500">
                        Early edge plays. Prices won’t last — get on before the market moves.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {longEdit ? <Badge tone="blue">Editing</Badge> : null}
                      <Badge tone="rose">{longTermBets.length} published</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tip title">
                      <input
                        name="title"
                        defaultValue={longEdit?.title || ""}
                        placeholder="Get On Early at the odds"
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
                    <Field label="Meeting">
                      <Input
                        name="meeting"
                        placeholder="Ascot"
                        value={longMeeting}
                        onChange={setLongMeeting}
                      />
                    </Field>

                    <Field label="Race number">
                      <Input
                        name="race_number"
                        type="number"
                        placeholder="3"
                        value={longRaceNumber}
                        onChange={setLongRaceNumber}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Race date">
                      <Input
                        name="race_date"
                        type="date"
                        placeholder=""
                        value={longRaceDate}
                        onChange={setLongRaceDate}
                      />
                    </Field>

                    <Field label="Race time">
                      <Input
                        name="race_time"
                        type="time"
                        placeholder=""
                        value={longRaceTime}
                        onChange={setLongRaceTime}
                      />
                    </Field>

                    <Field label="Track timezone">
                      <select
                        name="race_timezone"
                        value={longRaceTimezone}
                        onChange={(e) => setLongRaceTimezone(e.target.value)}
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

                  <Field label="Why get on now">
                    <textarea
                      name="commentary"
                      defaultValue={longEdit?.commentary || ""}
                      placeholder="Why is this worth taking early? What’s the edge? Why might the market shorten?"
                      className="min-h-[120px] w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                    >
                      {longEdit ? "Update Early Tip" : "Publish Get On Early Tip"}
                    </button>

                    {(longEdit ||
                      longMeeting ||
                      longRaceNumber ||
                      longRaceDate ||
                      longRaceTime) ? (
                      <button
                        type="button"
                        onClick={clearLongTermForm}
                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Clear Early Tip Form
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <h3 className="text-xl font-semibold">Manage Get On Early Tips</h3>
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
                            {formatLongTermRaceMeta(item) ? (
                              <p className="mt-2 text-sm text-zinc-500">
                                {formatLongTermRaceMeta(item)}
                              </p>
                            ) : null}
                          </div>
                          <Badge tone="rose">Get On Early 🔥</Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.bet_type ? <Badge tone="amber">{item.bet_type}</Badge> : null}
                          {item.odds ? <Badge tone="green">{item.odds}</Badge> : null}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-600">
                          {item.commentary || ""}
                        </p>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => loadLongTermIntoForm(item)}
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
        </main>
      </div>
    </div>
  );
}
