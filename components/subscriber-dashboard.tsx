"use client";

import { signOutAction } from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

export default function SubscriberDashboard({
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="mb-6 rounded-[2rem] bg-white p-5 shadow-sm lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">Subscriber access</p>
            <h1 className="text-3xl font-semibold tracking-tight">Suggested Tips</h1>
            <p className="mt-1 text-sm text-slate-500">Logged in as {currentUser.full_name || currentUser.email}</p>
          </div>
          <div className="mt-4 flex gap-3 lg:mt-0">
            <Badge tone="green">Live updates on</Badge>
            <form action={signOutAction}>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Log out</button>
            </form>
          </div>
        </div>

        <div className="space-y-8">
          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Suggested tips of the day</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {suggestedTips.map((tip: any) => (
                  <div key={tip.id} className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">{tip.race}</p>
                    <h3 className="text-xl font-semibold">{tip.horse}</h3>
                    <p className="mt-2 text-sm text-slate-600">{tip.commentary}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Horses / races to watch</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {watchlistItems.map((item: any) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">{item.race || "Watchlist"}</p>
                    <h3 className="text-xl font-semibold">{item.horse || "Race note"}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.commentary || ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Long-term bets</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {longTermBets.map((item: any) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">{item.title}</p>
                    <h3 className="text-xl font-semibold">{item.horse}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.commentary || ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
