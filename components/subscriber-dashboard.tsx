"use client";

import { signOutAction } from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";
import { useRealtimeTable } from "@/components/useRealtimeTable";

function getTipCardStyle(type: string) {
  if (type === "Win") {
    return "border-emerald-300/50 bg-emerald-100";
  }

  if (type === "Place") {
    return "border-sky-300/50 bg-sky-100";
  }

  if (type === "All Up") {
    return "border-pink-300/50 bg-pink-100";
  }

  return "border-amber-200/30 bg-white";
}

function FeaturedTipCard({ tip }: { tip: any }) {
  return (
    <div
      className={`overflow-hidden rounded-[28px] border p-6 shadow-xl ${getTipCardStyle(
        tip.type,
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{tip.race}</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{tip.horse}</h2>
        </div>
        <TipPill type={tip.type} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
        {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-6 text-zinc-700">{tip.commentary || ""}</p>
    </div>
  );
}

function StandardTipCard({ tip }: { tip: any }) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getTipCardStyle(
        tip.type,
      )}`}
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

      <p className="mt-4 text-sm leading-6 text-zinc-700">{tip.commentary || ""}</p>
    </div>
  );
}

function WatchCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
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
  );
}

function LongTermCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm">
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
  );
}

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

  const featuredTip = suggestedTips[0];
  const otherTips = suggestedTips.slice(1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#171717,#3f3f46,#ca8a04)] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">SmartPunt</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight">Premium Racing Club</h1>
              <p className="mt-2 text-sm text-amber-100/85">
                Sharp daily tips, expert insight, and longer-range plays.
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
                <Badge tone="green">Today</Badge>
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
                <Badge tone="rose">Futures</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-10">
          <div>
            <h2 className="text-2xl font-semibold text-white">Today’s Suggested Tips</h2>
            <p className="mt-1 text-sm text-amber-100/70">
              SmartPunt’s premium daily plays, written in a clean race-day format.
            </p>
          </div>

          {featuredTip ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge tone="amber">Featured Tip</Badge>
                <Badge tone="green">Top Play</Badge>
              </div>
              <FeaturedTipCard tip={featuredTip} />
            </div>
          ) : null}

          {otherTips.length ? (
            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">More tips on the day</h3>
                    <p className="text-sm text-zinc-500">
                      Additional SmartPunt selections for punters tracking the full card.
                    </p>
                  </div>
                  <Badge tone="green">{otherTips.length} more</Badge>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {otherTips.map((tip: any) => (
                    <StandardTipCard key={tip.id} tip={tip} />
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-8 xl:grid-cols-2">
            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Horses / races to watch</h3>
                    <p className="text-sm text-zinc-500">
                      Smart observations, forgive runs, and runners to keep on side.
                    </p>
                  </div>
                  <Badge tone="amber">{watchlistItems.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {watchlistItems.length ? (
                    watchlistItems.map((item: any) => <WatchCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                      No watchlist items posted yet.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="text-zinc-950">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Long-term bets</h3>
                    <p className="text-sm text-zinc-500">
                      Longer-range betting angles and futures worth tracking.
                    </p>
                  </div>
                  <Badge tone="rose">{longTermBets.length} live</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {longTermBets.length ? (
                    longTermBets.map((item: any) => <LongTermCard key={item.id} item={item} />)
                  ) : (
                    <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                      No long-term bets posted yet.
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
