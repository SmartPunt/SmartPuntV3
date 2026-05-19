import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type UserBet = {
  id: number;
  source: "head_tipper" | "calculator" | "subscriber" | string;
  race: string | null;
  horse: string | null;
  bet_type: string | null;
  odds_taken: number | string | null;
  stake_points: number | string | null;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  return_points: number | string | null;
  profit_loss_points: number | string | null;
  settled_at: string | null;
  created_at: string | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    day: "numeric",
    month: "short",
  }).format(date);
}

function getPerthDayKey(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayPerthKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDaysAgoPerthKey(daysAgo: number) {
  const now = new Date();
  const perthNow = new Date(
    now.toLocaleString("en-US", { timeZone: PERTH_TIMEZONE }),
  );

  perthNow.setHours(0, 0, 0, 0);
  perthNow.setDate(perthNow.getDate() - daysAgo);

  const year = perthNow.getFullYear();
  const month = String(perthNow.getMonth() + 1).padStart(2, "0");
  const day = String(perthNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sourceLabel(source: string | null | undefined) {
  if (source === "calculator") return "SmartPunt Calculator";
  if (source === "subscriber") return "My Pick";
  return "Head Tipper";
}

function sourceTone(source: string | null | undefined): "amber" | "blue" | "green" | "slate" {
  if (source === "calculator") return "blue";
  if (source === "subscriber") return "green";
  return "amber";
}

function isSuccessful(bet: UserBet) {
  const type = String(bet.bet_type || "").toLowerCase();

  if (type.includes("place")) {
    return bet.placed === true;
  }

  return bet.won === true || bet.finishing_position === 1;
}

function calculatedReturn(bet: UserBet) {
  const storedReturn = bet.return_points;

  if (storedReturn !== null && storedReturn !== undefined) {
    return toNumber(storedReturn);
  }

  const stake = toNumber(bet.stake_points) || 1;
  const odds = toNumber(bet.odds_taken);

  return isSuccessful(bet) ? stake * odds : 0;
}

function calculatedProfitLoss(bet: UserBet) {
  const storedProfit = bet.profit_loss_points;

  if (storedProfit !== null && storedProfit !== undefined) {
    return toNumber(storedProfit);
  }

  const stake = toNumber(bet.stake_points) || 1;
  return calculatedReturn(bet) - stake;
}

function buildStats(bets: UserBet[]) {
  const total = bets.length;
  const wins = bets.filter(isSuccessful).length;
  const stake = bets.reduce((sum, bet) => sum + (toNumber(bet.stake_points) || 1), 0);
  const returns = bets.reduce((sum, bet) => sum + calculatedReturn(bet), 0);
  const profitLoss = returns - stake;
  const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  const roi = stake > 0 ? ((profitLoss / stake) * 100).toFixed(1) : "0.0";

  return { total, wins, stake, returns, profitLoss, strikeRate, roi };
}

function groupBets(bets: UserBet[]) {
  const todayKey = getTodayPerthKey();
  const lastMonthCutoffKey = getDaysAgoPerthKey(30);

  const todaysBets: UserBet[] = [];
  const lastMonthsBets: UserBet[] = [];
  const olderBets: UserBet[] = [];

  for (const bet of bets) {
    const settledKey = getPerthDayKey(bet.settled_at);

    if (!settledKey) {
      olderBets.push(bet);
      continue;
    }

    if (settledKey === todayKey) {
      todaysBets.push(bet);
      continue;
    }

    if (settledKey >= lastMonthCutoffKey) {
      lastMonthsBets.push(bet);
      continue;
    }

    olderBets.push(bet);
  }

  return { todaysBets, lastMonthsBets, olderBets };
}

function Section({
  title,
  bets,
  defaultOpen = true,
}: {
  title: string;
  bets: UserBet[];
  defaultOpen?: boolean;
}) {
  return (
    <Panel className="bg-white/95">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-zinc-950 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {bets.length} {bets.length === 1 ? "bet" : "bets"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="blue">{bets.length}</Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 group-open:hidden">
              Expand
            </span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 group-open:inline">
              Collapse
            </span>
          </div>
        </summary>

        <div className="border-t border-zinc-200 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {bets.length > 0 ? (
            <div className="space-y-3">
              {bets.map((bet) => {
                const successful = isSuccessful(bet);
                const stake = toNumber(bet.stake_points) || 1;
                const odds = toNumber(bet.odds_taken);
                const profitLoss = calculatedProfitLoss(bet);

                return (
                  <details
                    key={bet.id}
                    className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-zinc-950">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                          {bet.race || "Race"}
                        </p>
                        <h3 className="truncate text-base font-semibold">
                          {bet.horse || "Unnamed horse"}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={successful ? "green" : "rose"}>
                            {successful ? "Successful" : "Unsuccessful"}
                          </Badge>
                          <Badge tone={sourceTone(bet.source)}>{sourceLabel(bet.source)}</Badge>
                          {bet.bet_type ? <Badge tone="blue">{bet.bet_type}</Badge> : null}
                          {bet.finishing_position ? (
                            <Badge tone="slate">Fin: {bet.finishing_position}</Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs text-zinc-500">{formatShortDate(bet.settled_at)}</p>
                        <p className={`mt-1 text-sm font-bold ${profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {profitLoss >= 0 ? "+" : ""}{profitLoss.toFixed(2)} pts
                        </p>
                      </div>
                    </summary>

                    <div className="border-t border-zinc-200 bg-white px-4 py-4 text-zinc-950">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={successful ? "green" : "rose"}>
                          {successful ? "Successful" : "Unsuccessful"}
                        </Badge>
                        <Badge tone={sourceTone(bet.source)}>{sourceLabel(bet.source)}</Badge>
                        {bet.bet_type ? <Badge tone="blue">{bet.bet_type}</Badge> : null}
                        <Badge tone="green">Odds {odds.toFixed(2)}</Badge>
                        <Badge tone="amber">Stake {stake.toFixed(1)} pt</Badge>
                        {bet.finishing_position ? (
                          <Badge tone="slate">Finishing position: {bet.finishing_position}</Badge>
                        ) : null}
                        <Badge tone="slate">{formatDate(bet.settled_at)}</Badge>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Return
                          </p>
                          <p className="mt-2 text-lg font-bold text-zinc-950">
                            {calculatedReturn(bet).toFixed(2)} pts
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Profit / Loss
                          </p>
                          <p className={`mt-2 text-lg font-bold ${profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {profitLoss >= 0 ? "+" : ""}{profitLoss.toFixed(2)} pts
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Source
                          </p>
                          <p className="mt-2 text-lg font-bold text-zinc-950">
                            {sourceLabel(bet.source)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-sm text-zinc-500">
              No bets in this section yet.
            </div>
          )}
        </div>
      </details>
    </Panel>
  );
}

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_bets")
    .select("*")
    .eq("user_id", profile.id)
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const bets = (data || []) as UserBet[];
  const overallStats = buildStats(bets);
  const headTipperStats = buildStats(bets.filter((bet) => bet.source === "head_tipper"));
  const calculatorStats = buildStats(bets.filter((bet) => bet.source === "calculator"));
  const subscriberStats = buildStats(bets.filter((bet) => bet.source === "subscriber"));
  const { todaysBets, lastMonthsBets, olderBets } = groupBets(bets);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="relative overflow-hidden border-b border-white/10 bg-black">
        <img
          src="/header-logo.png"
          alt="SmartPunt"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 opacity-20 sm:w-[500px] lg:w-[900px]"
        />

        <div className="relative z-10 flex items-center justify-between px-4 py-4 lg:px-8">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            My Resulted Bets
          </h1>

          <Link
            href="/"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">My Strike Rate</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {overallStats.strikeRate}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                {overallStats.wins}/{overallStats.total} successful
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">ROI</p>
              <p className={`mt-2 text-2xl font-semibold ${Number(overallStats.roi) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {overallStats.roi}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                {overallStats.profitLoss >= 0 ? "+" : ""}{overallStats.profitLoss.toFixed(2)} pts P/L
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Head Tipper Bets</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {headTipperStats.strikeRate}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                {headTipperStats.wins}/{headTipperStats.total} successful
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Calculator Bets</p>
              <p className="mt-2 text-2xl font-semibold text-blue-700">
                {calculatorStats.strikeRate}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                {calculatorStats.wins}/{calculatorStats.total} successful
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">My Own Picks</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">
                {subscriberStats.strikeRate}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                {subscriberStats.wins}/{subscriberStats.total} successful
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Total Staked</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {overallStats.stake.toFixed(2)} pts
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                Returns: {overallStats.returns.toFixed(2)} pts
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-6 space-y-4">
          <Section title="Today’s Bets" bets={todaysBets} defaultOpen />
          <Section title="Last Month’s Bets" bets={lastMonthsBets} defaultOpen />
          <Section title="Older Bets" bets={olderBets} />
        </div>
      </div>
    </div>
  );
}
