import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel, TipPill } from "@/components/ui";

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

export default async function WatchlistPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "user") {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: watchlistItems } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("created_at", { ascending: false });

  const items = watchlistItems || [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="relative overflow-hidden rounded-[32px] bg-black shadow-xl border border-white/10 min-h-[180px] lg:min-h-[300px]">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="absolute left-1/2 top-[45%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-95 pointer-events-none select-none sm:w-[400px] lg:top-[42%] lg:w-[943px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.46)_100%)]" />

          <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between p-4 lg:min-h-[300px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Subscriber Watchlist</Badge>

              <div className="ml-auto flex flex-col items-end gap-2 lg:gap-3">
                <Link
                  href="/my-resulted-tips"
                  className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                >
                  My Resulted Tips
                </Link>
                <Link
                  href="/"
                  className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                >
                  Live Tips
                </Link>
              </div>
            </div>

            <div className="mt-auto">
              <div className="rounded-2xl bg-black/18 px-4 py-3 backdrop-blur-[1px] lg:px-5 lg:py-4">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-white lg:gap-x-5">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-4xl">
                    Horses / Races to Watch
                  </h1>
                  <p className="text-sm text-zinc-200 lg:text-base">
                    Smart observations, forgive runs, and runners to keep on side.
                  </p>
                  <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                    Logged in as {profile.full_name || profile.email}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Live Tips
                  </Link>
                  <span className="rounded-2xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-zinc-950">
                    Horses / Races to Watch
                  </span>
                  <Link
                    href="/long-term-bets"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Long-Term Bets
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Watchlist Items</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{items.length}</p>
                <Badge tone="amber">Live</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Feed Style</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">Focused</p>
                <Badge tone="blue">Separate Page</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="mt-8 text-zinc-950">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Live Watchlist Feed</h2>
                <p className="text-sm text-zinc-500">
                  Cleaner separated view for runners and races worth tracking.
                </p>
              </div>
              <Badge tone="amber">{items.length} live</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {items.length ? (
                items.map((item: any) => <WatchCard key={item.id} item={item} />)
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  No watchlist items posted yet.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
