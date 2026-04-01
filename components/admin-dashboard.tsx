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
  const [tipFinishingPosition, setTipFinishingPosition] = useState("");
  const [tipSuccessful, setTipSuccessful] = useState("");
  const [suggestedTag, setSuggestedTag] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

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
    setTipFinishingPosition(
      tip.finishing_position === null || tip.finishing_position === undefined
        ? ""
        : String(tip.finishing_position),
    );
    setTipSuccessful(
      typeof tip.successful === "boolean" ? String(tip.successful) : "",
    );
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
    setTipFinishingPosition("");
    setTipSuccessful("");
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
          <div className="rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,#0f0f0f,#27272a,#ca8a04)] p-6 shadow-2xl lg:flex lg:items-center lg:justify-between">
            <div>
              <img src="/logo.png" alt="Fortune on 5" className="mb-3 h-14 w-auto" />
              <p className="text-sm text-amber-100/70">Private admin trial</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">Fortune on 5 tipper backend</h2>
              <p className="mt-2 text-sm text-amber-100/75">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 lg:mt-0">
              <Badge tone="amber">Premium racing club</Badge>
              <Badge tone="green">Live tips only</Badge>
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
                    <p>Once a tip is settled, set:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="blue">Finishing position</Badge>
                      <Badge tone="green">Successful</Badge>
                      <Badge tone="rose">Unsuccessful</Badge>
                    </div>
                    <p className="pt-2">
                      Settled tips disappear from this page and move into the separate Resulted Tips page.
                    </p>
                  </div>
                </div>
              </Panel>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white">Build Your Tip</h2>
              <p className="text-sm text-amber-100/70">
                Enter the tip, add rough thoughts, let Fortune on 5 draft the write-up, then publish.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel className="bg-white/95">
                <form action={upsertSuggestedTip} className="space-y-6 p-6 text-zinc-950">
                  <input type="hidden" name="id" value={tipEdit?.id || ""} readOnly />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Fortune on 5 tip builder</h3>
                      <p className="text-sm text-zinc-500">
                        Live tips only appear here. Settled tips move off this page.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tipEdit ? <Badge tone="blue">Editing</Badge> : null}
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
                        Clear Form
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 space-y-5 text-zinc-950">
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
                      {tipFinishingPosition ? (
                        <Badge tone="slate">Placed {tipFinishingPosition}</Badge>
                      ) : null}
                      {tipSuccessful === "true" ? <Badge tone="green">Successful</Badge> : null}
                      {tipSuccessful === "false" ? <Badge tone="rose">Unsuccessful</Badge> : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-700">
                      {tipCommentary || "Your Fortune on 5 commentary will appear here."}
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
        </main>
      </div>
    </div>
  );
}
