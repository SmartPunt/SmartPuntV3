import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { acceptFortuneFiveAction } from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";

type FortuneFive = {
  id: number;
  title: string;
  description: string | null;
  week_start_date: string;
  week_end_date: string;
  published_date: string;
  status: string;
  won: boolean | null;
  settled_at: string | null;
};

type FortuneFiveLeg = {
  id: number;
  fortune_five_id: number;
  leg_number: number;
  race: string;
  horse: string;
  bet_type: string;
  won: boolean | null;
  leg_status?: string | null;
};

type UserFortuneFive = {
  id: number;
  fortune_five_id: number;
  odds_taken: number | string;
  stake_points: number | string;
  won: boolean | null;
  return_points: number | string | null;
  profit_loss_points: number | string | null;
  settled_at: string | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

async function fetchAllRows<T>({
  pageSize = 1000,
  getPage,
}: {
  pageSize?: number;
  getPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: any }>;
}) {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await getPage(from, to);

    if (error) throw new Error(error.message || "Failed to fetch rows.");

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

function getTodayPerthDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getWeekStart(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  date.setDate(date.getDate() + mondayOffset);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getWeekEnd(dateValue: string) {
  const [year, month, day] = getWeekStart(dateValue)
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 6);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T12:00:00+08:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function statusBadge(fortune: FortuneFive, accepted?: UserFortuneFive | null) {
  if (fortune.status === "void") return <Badge tone="slate">Void</Badge>;
  if (accepted?.settled_at && accepted.won === true) return <Badge tone="green">Won</Badge>;
  if (accepted?.settled_at && accepted.won === false) return <Badge tone="rose">Lost</Badge>;
  if (fortune.settled_at && fortune.won === true) return <Badge tone="green">Won</Badge>;
  if (fortune.settled_at && fortune.won === false) return <Badge tone="rose">Lost</Badge>;
  if (accepted) return <Badge tone="blue">You&apos;re On</Badge>;
  return <Badge tone="amber">Available</Badge>;
}

function finalResultText(fortune: FortuneFive) {
  if (fortune.status === "void") return "Void";
  if (fortune.won === true) return "Winner";
  if (fortune.won === false) return "Unlucky Today";
  return "Pending";
}

function normaliseLegStatus(leg: FortuneFiveLeg) {
  return (
    leg.leg_status ||
    (leg.won === true ? "won" : leg.won === false ? "lost" : "pending")
  );
}

function legStatusBadge(leg: FortuneFiveLeg) {
  const status = normaliseLegStatus(leg);

  if (status === "won") return <Badge tone="green">✓ Won</Badge>;
  if (status === "lost") return <Badge tone="rose">✕ Lost</Badge>;
  if (status === "scratched") return <Badge tone="slate">Scratched</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}

function getLegProgress(legs: FortuneFiveLeg[]) {
  const won = legs.filter((leg) => normaliseLegStatus(leg) === "won").length;
  const lost = legs.filter((leg) => normaliseLegStatus(leg) === "lost").length;
  const scratched = legs.filter(
    (leg) => normaliseLegStatus(leg) === "scratched",
  ).length;
  const completed = won + lost + scratched;
  const total = Math.max(legs.length, 5);
  const progressPercent = Math.min(100, Math.round((completed / total) * 100));

  return {
    won,
    lost,
    scratched,
    completed,
    total,
    progressPercent,
  };
}

function FortuneFiveCard({
  fortune,
  legs,
  accepted,
}: {
  fortune: FortuneFive;
  legs: FortuneFiveLeg[];
  accepted: UserFortuneFive | null;
}) {
  const isSettled = Boolean(fortune.settled_at) || fortune.status === "void";
  const progress = getLegProgress(legs);
  const stake = accepted ? toNumber(accepted.stake_points) : 1;
  const potentialReturn = accepted
    ? toNumber(accepted.odds_taken) * Math.max(stake, 1)
    : 0;

  return (
    <article className="overflow-hidden rounded-[28px] border border-amber-300/25 bg-white shadow-2xl shadow-black/20">
      <div className="border-b border-amber-200/40 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_36%),linear-gradient(135deg,#09090b,#18181b_60%,#27272a)] p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
              Fortune on 5 · {formatDate(fortune.published_date)}
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {fortune.title}
            </h2>

            {fortune.description ? (
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
                {fortune.description}
              </p>
            ) : null}
          </div>

          <div className="shrink-0">{statusBadge(fortune, accepted)}</div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Multi progress
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {progress.won} of {progress.total} legs successful
              </p>
            </div>

            <p className="text-xs font-black text-amber-300">
              {progress.completed}/{progress.total}
            </p>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 transition-all"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {isSettled ? (
        <div
          className={`border-b px-5 py-5 sm:px-6 ${
            fortune.status === "void"
              ? "border-zinc-200 bg-zinc-100"
              : fortune.won === true
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
          }`}
        >
          <p className="text-center text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
            Final multi result
          </p>
          <p className="mt-2 text-center text-3xl font-black uppercase tracking-tight text-zinc-950">
            {finalResultText(fortune)}
          </p>
        </div>
      ) : null}

      <div className="space-y-3 p-5 sm:p-6">
        {legs.map((leg) => (
          <div
            key={leg.id}
            className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 to-yellow-500" />

            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-black text-sm font-black text-amber-300">
                {leg.leg_number}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Leg {leg.leg_number}
                    </p>

                    <h3 className="mt-1 text-lg font-black text-zinc-950 sm:text-xl">
                      {leg.horse}
                    </h3>

                    <p className="mt-1 text-sm leading-5 text-zinc-500">
                      {leg.race}
                    </p>
                  </div>

                  <div className="shrink-0">{legStatusBadge(leg)}</div>
                </div>

                <div className="mt-3">
                  <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-900">
                    {leg.bet_type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {accepted ? (
          <div className="rounded-2xl border border-amber-300/40 bg-[linear-gradient(135deg,#fffbeb,#fef3c7)] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-900">
              Your bet
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Odds taken
                </p>
                <p className="mt-1 text-2xl font-black text-zinc-950">
                  {toNumber(accepted.odds_taken).toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Potential return
                </p>
                <p className="mt-1 text-2xl font-black text-zinc-950">
                  {potentialReturn.toFixed(2)} pts
                </p>
              </div>
            </div>

            {accepted.settled_at ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3">
                <p className="text-sm font-bold text-zinc-800">
                  Return {toNumber(accepted.return_points).toFixed(2)} pts · P/L{" "}
                  {toNumber(accepted.profit_loss_points).toFixed(2)} pts
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-zinc-600">
                You&apos;re on. We&apos;ll track every leg and result the multi automatically.
              </p>
            )}
          </div>
        ) : !isSettled ? (
          <form
            action={acceptFortuneFiveAction}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
          >
            <input type="hidden" name="fortune_five_id" value={fortune.id} />

            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Odds you got for the full multi
              <input
                type="number"
                name="odds_taken"
                min="1.01"
                step="0.01"
                required
                placeholder="e.g. 18.50"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-black text-zinc-950 outline-none transition focus:border-amber-300"
              />
            </label>

            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:brightness-105"
            >
              I&apos;m On
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  const supabase = await createClient();
  const today = getTodayPerthDate();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);

  const [fortuneFives, fortuneFiveLegs, userFortuneFives] = await Promise.all([
    fetchAllRows<FortuneFive>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("fortune_fives")
          .select("*")
          .gte("published_date", weekStart)
          .lte("published_date", weekEnd)
          .order("published_date", { ascending: true })
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    }),
    fetchAllRows<FortuneFiveLeg>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("fortune_five_legs")
          .select("*")
          .order("leg_number", { ascending: true })
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    }),
    fetchAllRows<UserFortuneFive>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("user_fortune_fives")
          .select("*")
          .eq("user_id", profile.id)
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    }),
  ]);

  const legsByFortuneId = new Map<number, FortuneFiveLeg[]>();

  for (const leg of fortuneFiveLegs) {
    const existing = legsByFortuneId.get(leg.fortune_five_id) || [];
    existing.push(leg);
    legsByFortuneId.set(leg.fortune_five_id, existing);
  }

  const acceptedByFortuneId = new Map<number, UserFortuneFive>();

  for (const accepted of userFortuneFives) {
    acceptedByFortuneId.set(accepted.fortune_five_id, accepted);
  }

  const liveFortuneFives = fortuneFives.filter(
    (fortune) => !fortune.settled_at && fortune.status !== "void",
  );

  const resultedFortuneFives = fortuneFives.filter(
    (fortune) => fortune.settled_at || fortune.status === "void",
  );

  const acceptedThisWeek = userFortuneFives.filter((item) =>
    fortuneFives.some((fortune) => fortune.id === item.fortune_five_id),
  );

  const acceptedTotal = acceptedThisWeek.length;
  const acceptedWins = acceptedThisWeek.filter((item) => item.won === true).length;
  const settledAccepted = acceptedThisWeek.filter((item) => item.settled_at);
  const strikeRate =
    settledAccepted.length > 0
      ? (acceptedWins / settledAccepted.length) * 100
      : 0;

  const profitLoss = acceptedThisWeek.reduce(
    (sum, item) => sum + toNumber(item.profit_loss_points),
    0,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#111827_52%,#020617_100%)] text-white">
      <header className="relative overflow-hidden border-b border-amber-300/20 bg-black">
        <img
          src="/header-logo.png"
          alt="Fortune on 5"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-15 sm:w-[720px] lg:w-[1100px]"
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.88))]" />

        <div className="relative z-10 mx-auto flex min-h-[250px] max-w-7xl flex-col justify-between gap-8 px-4 py-6 sm:min-h-[300px] sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
                SmartPunt Premium
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Fortune on 5
              </h1>
            </div>

            <Link
              href="/"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white backdrop-blur transition hover:bg-white/10 sm:px-4 sm:py-2.5"
            >
              Dashboard
            </Link>
          </div>

          <div>
            <p className="max-w-2xl text-base font-semibold leading-7 text-zinc-200 sm:text-lg">
              Five selections. One payout. Fortune favours the bold.
            </p>

            <p className="mt-2 text-sm text-amber-100/70">
              A fresh SmartPunt multi each race day. Weekly performance runs Monday to Sunday.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                This week
              </p>
              <p className="mt-2 text-sm font-black sm:text-base">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Accepted
              </p>
              <p className="mt-2 text-3xl font-black text-amber-700">
                {acceptedTotal}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Strike rate
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-700">
                {strikeRate.toFixed(0)}%
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                P/L points
              </p>
              <p
                className={`mt-2 text-3xl font-black ${
                  profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {profitLoss >= 0 ? "+" : ""}
                {profitLoss.toFixed(2)}
              </p>
            </div>
          </Panel>
        </section>

        {fortuneFives.length > 0 ? (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                    Today&apos;s feature
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Live Fortune on 5
                  </h2>
                </div>

                <Badge tone="amber">{liveFortuneFives.length} live</Badge>
              </div>

              {liveFortuneFives.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {liveFortuneFives.map((fortune) => (
                    <FortuneFiveCard
                      key={fortune.id}
                      fortune={fortune}
                      legs={legsByFortuneId.get(fortune.id) || []}
                      accepted={acceptedByFortuneId.get(fortune.id) || null}
                    />
                  ))}
                </div>
              ) : (
                <Panel className="bg-white/95">
                  <div className="p-8 text-center text-zinc-950">
                    <p className="text-lg font-black">
                      No live Fortune on 5 multis remain this week.
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Finished multis are available in the results section below.
                    </p>
                  </div>
                </Panel>
              )}
            </section>

            {resultedFortuneFives.length > 0 ? (
              <details className="group rounded-[28px] border border-white/10 bg-white/95 p-5 text-zinc-950 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Weekly history
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Resulted Multis ({resultedFortuneFives.length})
                    </h2>
                  </div>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-xl font-black transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="mt-6 grid gap-6 border-t border-zinc-200 pt-6 lg:grid-cols-2">
                  {resultedFortuneFives.map((fortune) => (
                    <FortuneFiveCard
                      key={fortune.id}
                      fortune={fortune}
                      legs={legsByFortuneId.get(fortune.id) || []}
                      accepted={acceptedByFortuneId.get(fortune.id) || null}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <Panel className="bg-white/95">
            <div className="p-10 text-center text-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                Fortune on 5
              </p>
              <h2 className="mt-2 text-2xl font-black">
                No multi has been posted yet this week.
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Once the daily five-leg multi is published, it will appear here ready to follow.
              </p>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}
