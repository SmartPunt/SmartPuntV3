import Link from "next/link";

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-300" />
      <p className="text-sm leading-6 text-zinc-300">{children}</p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_24%),linear-gradient(180deg,#0f1113_0%,#18181b_55%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8 lg:py-14">
        <section className="overflow-hidden rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,#111111,#27272a,#ca8a04)] p-8 shadow-2xl lg:p-12">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-amber-200/80">
              SmartPunt
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Bet smarter. Not harder.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-amber-100/85 sm:text-lg">
              Premium horse racing tips, backed by sharp analysis and delivered
              daily. No noise. No fluff. Just actionable bets.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
              >
                Start Winning Today
              </Link>

              <a
                href="#pricing"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                View Pricing
              </a>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-[28px] border border-amber-200/15 bg-white/5 p-6 backdrop-blur">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                Why SmartPunt
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Premium racing intelligence for serious punters
              </h2>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FeatureItem>Clear, confident tips with no guesswork.</FeatureItem>
              <FeatureItem>
                AI-assisted commentary that explains the edge.
              </FeatureItem>
              <FeatureItem>
                Filter by Win, Place, and All Up plays.
              </FeatureItem>
              <FeatureItem>
                Track the bets you’ve acted on with Active Tips.
              </FeatureItem>
              <FeatureItem>
                Horses to watch and long-term betting angles.
              </FeatureItem>
              <FeatureItem>
                Live updates as new tips drop through the day.
              </FeatureItem>
            </div>

            <div className="mt-6 rounded-[24px] border border-amber-300/15 bg-black/20 p-5">
              <p className="text-sm leading-6 text-zinc-300">
                Built for punters who want an edge — not opinions.
              </p>
            </div>
          </div>

          <div
            id="pricing"
            className="rounded-[28px] border border-amber-300/20 bg-white/95 p-6 text-zinc-950 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  SmartPunt Core
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  $12
                  <span className="ml-1 text-lg font-medium text-zinc-500">
                    / month
                  </span>
                </h2>
              </div>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Foundation Pricing
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Everything you need to follow SmartPunt’s daily racing edge in one
              premium monthly membership.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✔ Daily suggested bets
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
                ✔ Win, Place & All Up plays
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                ✔ Smart AI commentary
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                ✔ Horses to watch
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✔ Long-term bets
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                ✔ Live updates
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                ✔ Active tip tracking
              </div>
            </div>

            <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                Most users cover their subscription with one winning tip.
              </p>
            </div>

            <div className="mt-6">
              <Link
                href="/"
                className="block w-full rounded-2xl bg-black px-5 py-3 text-center text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
              >
                Subscribe Now
              </Link>
            </div>

            <p className="mt-4 text-center text-sm text-zinc-500">
              Cancel anytime. No lock-in contracts. No hidden fees.
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-amber-200/15 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                What you get
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                Simple, premium, race-day ready
              </h3>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
              <p className="text-sm font-semibold text-amber-200">Daily edge</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                SmartPunt gives you sharp daily bets instead of forcing you to
                sort through noise and second-guess every race.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
              <p className="text-sm font-semibold text-amber-200">Clear analysis</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Every tip comes with commentary that explains the setup in a
                clean, punter-friendly way.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-10 pb-4 text-center">
          <p className="text-sm text-amber-100/65">
            SmartPunt — Premium Racing Intelligence
          </p>
        </footer>
      </div>
    </main>
  );
}
