"use client";

import { signOutAction } from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#171717,#3f3f46,#ca8a04)] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">Cob&apos;s Rules</p>
              <h1 className="mt-2 text-4xl font-bold">Premium Racing Club</h1>
              <p className="mt-2 text-sm text-amber-100/85">
                Live tips, expert insight, and long-term plays
              </p>
              <p className="mt-3 text-sm text-amber-100/70">
                Logged in as {currentUser.full_name || currentUser.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge tone="green">Live updates on</Badge>
              <form action={signOutAction}>
                <button className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Tips live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{suggestedTips.length}</p>
                <Badge tone="green">Tips</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Watchlist live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{watchlistItems.length}</p>
                <Badge tone="amber">Watch</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Long-term live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{longTermBets.length}</p>
                <Badge tone="rose">Long-term</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-white">Suggested Tips</h2>
            <p className="text-sm text-amber-100/70">
              Premium punter-facing view with full race, horse, bet type, confidence, and commentary.
            </p>
          </div>

          <Panel className="text-zinc-950">
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Suggested tips of the day</h3>
                  <p className="text-sm text-zinc-500">
                    Win, place, and all up plays from the head tipper.
                  </p>
                </div>
                <Badge tone="green">{suggestedTips.length} live</Badge>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {suggestedTips.map((tip: any) => (
                  <div
                    key={tip.id}
                    className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">{tip.race}</p>
                        <h3 className="mt-1 text-2xl font-semibold text-zinc-950">{tip.horse}</h3>
                      </div>
                      <TipPill type={tip.type} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
                      {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-600">{tip.commentary || ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div className="grid gap-8 xl:grid-cols-2">
            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                    <p className="text-sm text-zinc-500">Watchlist notes and market awareness.</p>
                  </div>
                  <Badge tone="amber">{watchlistItems.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {watchlistItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">{item.race || "Watchlist"}</p>
                          <h4 className="mt-1 text-xl font-semibold text-zinc-950">
                            {item.horse || "Race note"}
                          </h4>
                        </div>
                        <TipPill type={item.label} />
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.commentary || ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Long-term bets</h3>
                    <p className="text-sm text-zinc-500">
                      Future and longer-range angles worth tracking.
                    </p>
                  </div>
                  <Badge tone="rose">{longTermBets.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {longTermBets.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">{item.title}</p>
                          <h4 className="mt-1 text-xl font-semibold text-zinc-950">{item.horse}</h4>
                        </div>
                        <TipPill type="Long Term" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.bet_type ? <Badge tone="rose">{item.bet_type}</Badge> : null}
                        {item.odds ? <Badge tone="slate">{item.odds}</Badge> : null}
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.commentary || ""}</p>
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
