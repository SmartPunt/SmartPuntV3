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
  getPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>;
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
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
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
  if (accepted?.settled_at && accepted.won === true) return <Badge tone="green">Multi Won</Badge>;
  if (accepted?.settled_at && accepted.won === false) return <Badge tone="rose">Multi Lost</Badge>;
  if (fortune.settled_at && fortune.won === true) return <Badge tone="green">Multi Won</Badge>;
  if (fortune.settled_at && fortune.won === false) return <Badge tone="rose">Multi Lost</Badge>;
  if (accepted) return <Badge tone="blue">Accepted</Badge>;
  return <Badge tone="amber">Available</Badge>;
}

function legStatusBadge(leg: FortuneFiveLeg) {
  const status = leg.leg_status || (leg.won === true ? "won" : leg.won === false ? "lost" : "pending");

  if (status === "won") return <Badge tone="green">✓ Won</Badge>;
  if (status === "lost") return <Badge tone="rose">✕ Lost</Badge>;
  if (status === "scratched") return <Badge tone="slate">Scratched</Badge>;
  return <Badge tone="amber">Pending</Badge>;
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

  const acceptedTotal = userFortuneFives.length;
  const acceptedWins = userFortuneFives.filter((item) => item.won === true).length;
  const profitLoss = userFortuneFives.reduce(
    (sum, item) => sum + toNumber(item.profit_loss_points),
    0,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),linear-gradient(180deg,#020617_0%,#111827_52%,#020617_100%)] text-white">
      <div className="relative overflow-hidden border-b border-white/10 bg-black">
        <img
          src="/header-logo.png"
          alt="Fortune on 5"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[360px] -translate-x-1/2 -translate-y-1/2 opacity-20 sm:w-[620px] lg:w-[1000px]"
        />

        <div className="relative z-10 flex items-center justify-between px-4 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-3xl">
              Fortune on 5
            </h1>
            <p className="mt-1 text-sm text-amber-100/75">
              The daily 5-leg SmartPunt multi. Week runs Monday to Sunday.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-sm text-zinc-500">This Week</p>
              <p className="mt-2 text-lg font-bold">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-sm text-zinc-500">Accepted</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{acceptedTotal}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-sm text-zinc-500">Winners</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{acceptedWins}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-sm text-zinc-500">P/L Points</p>
              <p className={`mt-2 text-2xl font-bold ${profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {profitLoss.toFixed(2)}
              </p>
            </div>
          </Panel>
        </div>

        {fortuneFives.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {fortuneFives.map((fortune) => {
              const legs = legsByFortuneId.get(fortune.id) || [];
              const accepted = acceptedByFortuneId.get(fortune.id) || null;
              const isSettled = Boolean(fortune.settled_at) || fortune.status === "void";

              return (
                <Panel key={fortune.id} className="bg-white/95">
                  <div className="space-y-5 p-6 text-zinc-950">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          {formatDate(fortune.published_date)}
                        </p>
                        <h2 className="mt-1 text-2xl font-black">{fortune.title}</h2>
                        {fortune.description ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                            {fortune.description}
                          </div>
                        ) : null}
                      </div>
                      {statusBadge(fortune, accepted)}
                    </div>

                    {isSettled ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                        Final multi result: {fortune.status === "void" ? "Void" : fortune.won === true ? "Won" : "Lost"}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      {legs.map((leg) => (
                        <div key={leg.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                Leg {leg.leg_number} · {leg.bet_type}
                              </p>
                              <p className="mt-1 text-base font-bold">{leg.horse}</p>
                              <p className="mt-1 text-sm font-medium text-zinc-600">
                                {leg.race}
                              </p>
                            </div>
                            {legStatusBadge(leg)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {accepted ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                          Your accepted odds
                        </p>
                        <p className="mt-2 text-2xl font-black text-zinc-950">
                          {toNumber(accepted.odds_taken).toFixed(2)}
                        </p>
                        {accepted.settled_at ? (
                          <p className="mt-2 text-sm font-semibold text-zinc-700">
                            Return {toNumber(accepted.return_points).toFixed(2)} pts · P/L {toNumber(accepted.profit_loss_points).toFixed(2)} pts
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-600">
                            Waiting for the multi to be resulted.
                          </p>
                        )}
                      </div>
                    ) : !isSettled ? (
                      <form action={acceptFortuneFiveAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <input type="hidden" name="fortune_five_id" value={fortune.id} />
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                          Odds you got for the full multi
                          <input
                            type="number"
                            name="odds_taken"
                            min="1.01"
                            step="0.01"
                            required
                            placeholder="e.g. 18.50"
                            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold outline-none transition focus:border-amber-300"
                          />
                        </label>
                        <button
                          type="submit"
                          className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
                        >
                          Accept Fortune on 5
                        </button>
                      </form>
                    ) : null}
                  </div>
                </Panel>
              );
            })}
          </div>
        ) : (
          <Panel className="bg-white/95">
            <div className="p-8 text-center text-zinc-950">
              <h2 className="text-2xl font-bold">No Fortune on 5 posted yet this week.</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Once the daily 5-leg multi is published, it’ll appear here.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
