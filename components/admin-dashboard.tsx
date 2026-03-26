"use client";

import { useState } from "react";
import {
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
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Input({
  name,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
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
      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
      style={{ minHeight }}
    />
  );
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  function loadTipIntoForm(tip: any) {
    setTipEdit(tip);
    setTipRace(tip.race || "");
    setTipHorse(tip.horse || "");
    setTipType(tip.type || "Win");
    setTipConfidence(tip.confidence || "High");
    setTipNote(tip.note || "");
    setTipCommentary(tip.commentary || "");
    setTipperNotes("");
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
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate commentary.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-5">
          <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Cob&apos;s Rules</p>
            <h1 className="mt-2 text-xl font-semibold">Head Tipper CMS</h1>
            <p className="mt-2 text-sm text-slate-300">Premium admin control room</p>
          </div>

          <div className="mt-6 grid gap-4">
            <Panel>
              <div className="p-4">
                <p className="text-sm text-slate-500">Tips live</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-2xl font-semibold">{suggestedTips.length}</p>
                  <Badge tone="green">Tips</Badge>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="p-4">
                <p className="text-sm text-slate-500">Watchlist live</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-2xl font-semibold">{watchlistItems.length}</p>
                  <Badge tone="amber">Watch</Badge>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="p-4">
                <p className="text-sm text-slate-500">Long-term live</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-2xl font-semibold">{longTermBets.length}</p>
                  <Badge tone="rose">Long-term</Badge>
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="mt-6">
            <div className="space-y-3 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Logged in as</span>
                <Badge tone="blue">admin</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>User</span>
                <Badge tone="slate">{currentUser.full_name || currentUser.email}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Visibility</span>
                <Badge tone="green">Private trial</Badge>
              </div>
            </div>
          </Panel>

          <div className="mt-5">
            <form action={signOutAction}>
              <button className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Log out
              </button>
            </form>
          </div>
        </aside>

        <main className="p-4 lg:p-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:flex lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Private admin trial</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">Head tipper backend</h2>
              <p className="mt-2 text-sm text-slate-500">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 lg:mt-0">
              <Badge tone="blue">Backend hidden from subscribers</Badge>
              <Badge tone="green">Realtime ready</Badge>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Content management</h2>
              <p className="text-sm text-slate-500">
                Add, edit, delete, and now draft commentary with AI.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Panel>
                <form action={upsertSuggestedTip} className="space-y-5 p-6">
                  <input type="hidden" name="id" value={tipEdit?.id || ""} readOnly />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Suggested tips of the day</h3>
                      <p className="text-sm text-slate-500">
                        Enter the tip, draft commentary with AI, then publish.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tipEdit ? <Badge tone="blue">Editing</Badge> : null}
                      <Badge tone="green">{suggestedTips.length} published</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Race">
                      <Input name="race" placeholder="Ascot R3" value={tipRace} onChange={setTipRace} />
                    </Field>
                    <Field label="Horse / Selection">
                      <Input name="horse" placeholder="Ocean Ember" value={tipHorse} onChange={setTipHorse} />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Tip type">
                      <select
                        name="type"
                        value={tipType}
                        onChange={(e) => setTipType(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
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
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </Field>

                    <Field label="Short note">
                      <Input name="note" placeholder="Best Bet" value={tipNote} onChange={setTipNote} />
                    </Field>
                  </div>

                  <Field label="Head tipper notes for AI">
                    <Textarea
                      name="tipper_notes_preview_only"
                      placeholder="Why do you like this horse?"
                      value={tipperNotes}
                      onChange={setTipperNotes}
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={generateCommentary}
                      disabled={isGenerating}
                      className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-105 disabled:opacity-60"
                    >
                      {isGenerating ? "Generating..." : "Draft commentary with AI"}
                    </button>
                  </div>

                  {generateError ? (
                    <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      {generateError}
                    </div>
                  ) : null}

                  <Field label="Commentary">
                    <Textarea
                      name="commentary"
                      placeholder="AI draft or your own commentary appears here."
                      value={tipCommentary}
                      onChange={setTipCommentary}
                      minHeight="180px"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {tipEdit ? "Update suggested tip" : "Publish suggested tip"}
                    </button>
                    {(tipEdit || tipRace || tipHorse || tipCommentary || tipperNotes) ? (
                      <button
                        type="button"
                        onClick={clearTipForm}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Clear form
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Live preview</h3>
                      <p className="text-sm text-slate-500">See how the tip will appear to subscribers.</p>
                    </div>
                    <TipPill type={tipType} />
                  </div>

                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-sm text-slate-500">{tipRace || "Race"}</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-900">{tipHorse || "Horse"}</h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tipConfidence ? <Badge tone="blue">{tipConfidence} confidence</Badge> : null}
                      {tipNote ? <Badge tone="amber">{tipNote}</Badge> : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {tipCommentary || "AI commentary will appear here before you publish."}
                    </p>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-slate-900">Recent suggested tips</h4>
                    <div className="mt-4 space-y-4">
                      {suggestedTips.map((tip: any) => (
                        <div key={tip.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm text-slate-500">{tip.race}</p>
                              <p className="mt-1 text-lg font-semibold">{tip.horse}</p>
                            </div>
                            <TipPill type={tip.type} />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{tip.commentary || ""}</p>
                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => loadTipIntoForm(tip)}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit
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

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel>
                <form action={upsertWatchItem} className="space-y-5 p-6">
                  <input type="hidden" name="id" value={watchEdit?.id || ""} readOnly />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                      <p className="text-sm text-slate-500">Build the watchlist with better race-day context.</p>
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
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      />
                    </Field>
                    <Field label="Horse / Focus">
                      <input
                        name="horse"
                        defaultValue={watchEdit?.horse || ""}
                        placeholder="River Charge"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      />
                    </Field>
                  </div>

                  <Field label="Watch label">
                    <select
                      name="label"
                      defaultValue={watchEdit?.label || "Horse to Watch"}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
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
                      className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {watchEdit ? "Update watch item" : "Publish watch item"}
                    </button>
                    {watchEdit ? (
                      <button
                        type="button"
                        onClick={() => setWatchEdit(null)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">Manage watchlist items</h3>
                  <div className="mt-5 space-y-4">
                    {watchlistItems.map((item: any) => (
                      <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-slate-500">{item.race || "Watchlist"}</p>
                            <p className="mt-1 text-lg font-semibold">{item.horse || "Race note"}</p>
                          </div>
                          <TipPill type={item.label} />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.commentary || ""}</p>
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setWatchEdit(item)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel>
                <form action={upsertLongTermBet} className="space-y-5 p-6">
                  <input type="hidden" name="id" value={longEdit?.id || ""} readOnly />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Long-term bets</h3>
                      <p className="text-sm text-slate-500">Future plays and longer-range betting opportunities.</p>
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
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      />
                    </Field>
                    <Field label="Horse / Selection">
                      <input
                        name="horse"
                        defaultValue={longEdit?.horse || ""}
                        placeholder="Ocean Ember"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Bet type">
                      <select
                        name="bet_type"
                        defaultValue={longEdit?.bet_type || "Win"}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
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
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                      />
                    </Field>
                  </div>

                  <Field label="Commentary">
                    <textarea
                      name="commentary"
                      defaultValue={longEdit?.commentary || ""}
                      placeholder="Add your long-term angle here."
                      className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-300"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {longEdit ? "Update long-term bet" : "Publish long-term bet"}
                    </button>
                    {longEdit ? (
                      <button
                        type="button"
                        onClick={() => setLongEdit(null)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </Panel>

              <Panel>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">Manage long-term bets</h3>
                  <div className="mt-5 space-y-4">
                    {longTermBets.map((item: any) => (
                      <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-slate-500">{item.title}</p>
                            <p className="mt-1 text-lg font-semibold">{item.horse}</p>
                          </div>
                          <TipPill type="Long Term" />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.commentary || ""}</p>
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLongEdit(item)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
