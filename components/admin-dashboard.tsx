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
import { Badge, Panel } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

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

  const [tipId, setTipId] = useState("");
  const [watchId, setWatchId] = useState("");
  const [longId, setLongId] = useState("");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-5">
          <div className="rounded-3xl bg-slate-900 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Cob's Rules</p>
            <h1 className="mt-1 text-lg font-semibold">Head Tipper CMS</h1>
            <p className="mt-2 text-sm text-slate-300">Supabase live admin area</p>
          </div>

          <Panel className="mt-6">
            <div className="space-y-3 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Logged in as</span><Badge tone="blue">admin</Badge></div>
              <div className="flex items-center justify-between"><span>Suggested tips</span><Badge tone="green">{suggestedTips.length}</Badge></div>
              <div className="flex items-center justify-between"><span>Watch items</span><Badge tone="amber">{watchlistItems.length}</Badge></div>
              <div className="flex items-center justify-between"><span>Long-term bets</span><Badge tone="rose">{longTermBets.length}</Badge></div>
            </div>
          </Panel>

          <div className="mt-4">
            <form action={signOutAction}>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Log out</button>
            </form>
          </div>
        </aside>

        <main className="p-4 lg:p-8">
          <div className="mb-6 rounded-[2rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Private admin trial</p>
            <h2 className="text-3xl font-semibold tracking-tight">Head tipper backend</h2>
            <p className="mt-1 text-sm text-slate-500">Logged in as {currentUser.full_name || currentUser.email}</p>
          </div>

          <div className="space-y-8">
            <Panel>
              <form action={upsertSuggestedTip} className="space-y-4 p-5">
                <input type="hidden" name="id" value={tipId} readOnly />
                <h3 className="text-lg font-semibold">Suggested tips</h3>
                <input name="race" placeholder="Race" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <input name="horse" placeholder="Horse" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <select name="type" className="w-full rounded-2xl border border-slate-200 px-3 py-2">
                  <option>Win</option><option>Place</option><option>All Up</option>
                </select>
                <select name="confidence" className="w-full rounded-2xl border border-slate-200 px-3 py-2">
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
                <input name="note" placeholder="Short note" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <textarea name="commentary" placeholder="Commentary" className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save suggested tip</button>
              </form>
            </Panel>

            <Panel>
              <div className="p-5">
                <h3 className="text-lg font-semibold">Manage suggested tips</h3>
                <div className="mt-4 space-y-3">
                  {suggestedTips.map((tip: any) => (
                    <div key={tip.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">{tip.race}</p>
                      <p className="font-semibold">{tip.horse}</p>
                      <p className="mt-2 text-sm text-slate-600">{tip.commentary}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" onClick={() => setTipId(String(tip.id))}>Edit next save</button>
                        <form action={deleteSuggestedTipAction}>
                          <input type="hidden" name="id" value={tip.id} />
                          <button className="rounded-2xl bg-red-600 px-4 py-2 text-sm text-white">Delete</button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel>
              <form action={upsertWatchItem} className="space-y-4 p-5">
                <input type="hidden" name="id" value={watchId} readOnly />
                <h3 className="text-lg font-semibold">Watch items</h3>
                <input name="race" placeholder="Race" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <input name="horse" placeholder="Horse" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <select name="label" className="w-full rounded-2xl border border-slate-200 px-3 py-2">
                  <option>Horse to Watch</option><option>Race to Watch</option>
                </select>
                <textarea name="commentary" placeholder="Commentary" className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save watch item</button>
              </form>
            </Panel>

            <Panel>
              <div className="p-5">
                <h3 className="text-lg font-semibold">Manage watch items</h3>
                <div className="mt-4 space-y-3">
                  {watchlistItems.map((item: any) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">{item.race || "Watchlist"}</p>
                      <p className="font-semibold">{item.horse || "Race note"}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.commentary || ""}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" onClick={() => setWatchId(String(item.id))}>Edit next save</button>
                        <form action={deleteWatchItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-2xl bg-red-600 px-4 py-2 text-sm text-white">Delete</button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel>
              <form action={upsertLongTermBet} className="space-y-4 p-5">
                <input type="hidden" name="id" value={longId} readOnly />
                <h3 className="text-lg font-semibold">Long-term bets</h3>
                <input name="title" placeholder="Title" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <input name="horse" placeholder="Horse" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <select name="bet_type" className="w-full rounded-2xl border border-slate-200 px-3 py-2">
                  <option>Win</option><option>Place</option><option>All Up</option>
                </select>
                <input name="odds" placeholder="Odds" className="w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <textarea name="commentary" placeholder="Commentary" className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2" />
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save long-term bet</button>
              </form>
            </Panel>

            <Panel>
              <div className="p-5">
                <h3 className="text-lg font-semibold">Manage long-term bets</h3>
                <div className="mt-4 space-y-3">
                  {longTermBets.map((item: any) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">{item.title}</p>
                      <p className="font-semibold">{item.horse}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.commentary || ""}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" onClick={() => setLongId(String(item.id))}>Edit next save</button>
                        <form action={deleteLongTermBetAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-2xl bg-red-600 px-4 py-2 text-sm text-white">Delete</button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}
