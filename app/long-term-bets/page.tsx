import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

function EarlyCard({ item }: { item: any }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(20,20,20,0.98),rgba(48,34,8,0.96))] shadow-[0_18px_50px_rgba(0,0,0,0.30)]">
      <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(251,191,36,0.16),rgba(251,191,36,0.04))] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">VIP Alert</Badge>
            <Badge tone="rose">Get On Early 🔥</Badge>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">
            Price may not last
          </p>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-amber-200/75">
              {item.title || "Early edge play"}
            </p>
            <h4 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {item.horse}
            </h4>
          </div>

          <div className="rounded-2xl border border-amber-300/25 bg-black/25 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Price taken
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-300">
              {item.odds || "TBC"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.bet_type ? <Badge tone="rose">{item.bet_type}</Badge> : null}
          <Badge tone="amber">Early Market Edge</Badge>
          <Badge tone="blue">Worth Locking In</Badge>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
            Why SmartPunt likes it early
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-200">
            {item.commentary ||
              "SmartPunt has marked this as an early-value play worth taking before the market adjusts."}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Alert Type
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Early price special
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Best Use
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Beat the market
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              SmartPunt View
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Get set early
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LongTermBetsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "user") {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: longTermBets } = await supabase
    .from("long_term_bets")
    .select("*")
    .order("created_at", { ascending: false });

  const items = longTermBets || [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="relative overflow-hidden rounded-[32px] bg-black shadow-xl border border-white/10 min-h-[180px] lg:min-h-[300px]">
          <img
            src="/header-logo.png"
            alt="SmartPunt"
            className="absolute left-1/2 top-[45%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-95 pointer-events-none select-none sm:w-[400px] lg:top-[42%] lg:w-[943px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.46)_100%)]" />

          <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between p-4 lg:min-h-[300px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Early Edge Alerts</Badge>

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
                    Get On Early 🔥
                  </h1>
                  <p className="text-sm text-zinc-200 lg:text-base">
                    Early market plays identified before the price firms. These are the ones to lock in.
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
                  <Link
                    href="/watchlist"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Horses / Races to Watch
                  </Link>
                  <span className="rounded-2xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-zinc-950">
                    Get On Early 🔥
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">VIP Alerts Live</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{items.length}</p>
                <Badge tone="amber">Active</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Edge Type</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">Market Value</p>
                <Badge tone="rose">Early Position</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="mt-8 text-zinc-950">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Live Early Plays</h2>
                <p className="text-sm text-zinc-500">
                  These are positions SmartPunt wants taken before the market catches up.
                </p>
              </div>
              <Badge tone="amber">{items.length} live</Badge>
            </div>

            <div className="mt-5 space-y-4">
              {items.length ? (
                items.map((item: any) => (
                  <EarlyCard key={item.id} item={item} />
                ))
              ) : (
                <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                  No early plays posted yet. When SmartPunt spots value early, it will land here.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
