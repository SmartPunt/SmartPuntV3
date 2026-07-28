import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getCalculatorSuccessStatsAction } from "@/lib/actions";

type UserBet = {
  id: number;
  source: "head_tipper" | "calculator" | "subscriber" | string;
  race_id: number | null;
  race: string | null;
  horse: string | null;
  bet_type: string | null;

  odds_taken: number | string | null;
  stake_points: number | string | null;

  win_odds_taken: number | string | null;
  place_odds_taken: number | string | null;
  win_stake_points: number | string | null;
  place_stake_points: number | string | null;

  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;

  return_points: number | string | null;
  profit_loss_points: number | string | null;

  voided: boolean | null;
  void_reason: string | null;

  settled_at: string | null;
  created_at: string | null;
};

type SuggestedTipResult = {
  id: number;
  type: string | null;
  successful: boolean | null;
  finishing_position: number | null;

  stake_points: number | string | null;
  return_points: number | string | null;
  profit_loss_points: number | string | null;

  settled_at: string | null;
};

type PageSearchParams = {
  from?: string;
  to?: string;
};

type PersonalStats = {
  total: number;
  successful: number;
  stake: number;
  returns: number;
  profitLoss: number;
  strikeRate: number;
  roi: number;
};
type PublishedTipStats = {
  total: number;
  successful: number;
  percentage: number;
  stake: number;
  returns: number;
  profitLoss: number;
  roi: number;
};
const PERTH_TIMEZONE = "Australia/Perth";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatPercentage(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatOdds(value: number | string | null | undefined) {
  const parsed = toNumber(value);

  if (parsed <= 0) {
    return "—";
  }

  return parsed.toFixed(2).replace(/\.00$/, "");
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getPerthDateKey(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPerthTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDateKey(dateKey: string, offsetDays: number) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + offsetDays, 12),
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isValidDateKey(value: string | undefined) {
  if (!value) return false;

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normaliseBetType(value: string | null | undefined) {
  const cleaned = String(value || "Win")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");

  if (
    cleaned === "each way" ||
    cleaned === "eachway" ||
    cleaned.includes("each way")
  ) {
    return "Each Way";
  }

  if (cleaned.includes("place")) {
    return "Place";
  }

  return "Win";
}

function sourceLabel(source: string | null | undefined) {
  if (source === "calculator") return "Calculator";
  if (source === "subscriber") return "Build My Own";
  return "The Maverick";
}

function sourceDescription(source: string | null | undefined) {
  if (source === "calculator") {
    return "SmartPunt Calculator selection";
  }

  if (source === "subscriber") {
    return "Selection built by you";
  }

return "Official Maverick selection";
}

function sourceClasses(source: string | null | undefined) {
  if (source === "calculator") {
    return "border-sky-300/40 bg-sky-400/15 text-sky-100";
  }

  if (source === "subscriber") {
    return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
  }

  return "border-amber-300/40 bg-amber-400/15 text-amber-100";
}

function betTypeClasses(value: string | null | undefined) {
  const betType = normaliseBetType(value);

  if (betType === "Place") {
    return "border-sky-300/40 bg-sky-400/15 text-sky-100";
  }

  if (betType === "Each Way") {
    return "border-violet-300/40 bg-violet-400/15 text-violet-100";
  }

  return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
}

function getTotalStake(bet: UserBet) {
  if (normaliseBetType(bet.bet_type) === "Each Way") {
    const legTotal =
      toNumber(bet.win_stake_points) +
      toNumber(bet.place_stake_points);

    if (legTotal > 0) {
      return roundMoney(legTotal);
    }
  }

  return roundMoney(toNumber(bet.stake_points));
}

function getStoredReturn(bet: UserBet) {
  return roundMoney(toNumber(bet.return_points));
}

function getProfitLoss(bet: UserBet) {
  if (
    bet.profit_loss_points !== null &&
    bet.profit_loss_points !== undefined
  ) {
    return roundMoney(toNumber(bet.profit_loss_points));
  }

  return roundMoney(getStoredReturn(bet) - getTotalStake(bet));
}

function isPersonalBetSuccessful(bet: UserBet) {
  if (bet.voided === true) {
    return false;
  }

  if (getStoredReturn(bet) > 0) {
    return true;
  }

  const betType = normaliseBetType(bet.bet_type);

  if (betType === "Win") {
    return bet.won === true || bet.finishing_position === 1;
  }

  if (betType === "Place") {
    return bet.placed === true;
  }

  return bet.won === true || bet.placed === true;
}

function buildPersonalStats(bets: UserBet[]): PersonalStats {
  const validBets = bets.filter((bet) => bet.voided !== true);

  const total = validBets.length;

  const successful = validBets.filter(
    isPersonalBetSuccessful,
  ).length;

  const stake = roundMoney(
    validBets.reduce(
      (sum, bet) => sum + getTotalStake(bet),
      0,
    ),
  );

  const returns = roundMoney(
    validBets.reduce(
      (sum, bet) => sum + getStoredReturn(bet),
      0,
    ),
  );

  const profitLoss = roundMoney(returns - stake);

  const strikeRate =
    total > 0 ? (successful / total) * 100 : 0;

  const roi =
    stake > 0 ? (profitLoss / stake) * 100 : 0;

  return {
    total,
    successful,
    stake,
    returns,
    profitLoss,
    strikeRate,
    roi,
  };
}

function isWithinRange(
  value: string | null | undefined,
  from: string,
  to: string,
) {
  const dateKey = getPerthDateKey(value);

  if (!dateKey) return false;

  return dateKey >= from && dateKey <= to;
}

function isHeadTipperResultSuccessful(tip: SuggestedTipResult) {
  return tip.successful === true;
}

function buildSuccessStats<T>(
  items: T[],
  successful: (item: T) => boolean,
) {
  const total = items.length;
  const successCount = items.filter(successful).length;

  return {
    total,
    successful: successCount,
    percentage:
      total > 0 ? (successCount / total) * 100 : 0,
  };
}

function buildPublishedMaverickStats(
  tips: SuggestedTipResult[],
): PublishedTipStats {
  const total = tips.length;

  const successful = tips.filter(
    isHeadTipperResultSuccessful,
  ).length;

  const stake = roundMoney(
    tips.reduce(
      (sum, tip) =>
        sum + toNumber(tip.stake_points),
      0,
    ),
  );

  const returns = roundMoney(
    tips.reduce(
      (sum, tip) =>
        sum + toNumber(tip.return_points),
      0,
    ),
  );

  const storedProfitLoss = roundMoney(
    tips.reduce((sum, tip) => {
      if (
        tip.profit_loss_points !== null &&
        tip.profit_loss_points !== undefined
      ) {
        return (
          sum +
          toNumber(tip.profit_loss_points)
        );
      }

      return (
        sum +
        toNumber(tip.return_points) -
        toNumber(tip.stake_points)
      );
    }, 0),
  );

  return {
    total,
    successful,
    percentage:
      total > 0
        ? (successful / total) * 100
        : 0,
    stake,
    returns,
    profitLoss: storedProfitLoss,
    roi:
      stake > 0
        ? (storedProfitLoss / stake) * 100
        : 0,
  };
}

function ROINumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const valueClasses =
    value > 0
      ? "text-emerald-200"
      : value < 0
        ? "text-rose-200"
        : "text-zinc-200";

  return (
    <p
      className={`font-black tracking-tight ${valueClasses} ${className}`}
    >
      {formatPercentage(value)}
    </p>
  );
}

function SummaryCard({
  label,
  stats,
  detail,
  tone = "gold",
}: {
  label: string;
  stats: PersonalStats;
  detail: string;
  tone?: "gold" | "green" | "blue";
}) {
  const toneClasses = {
    gold: "border-amber-300/30 bg-amber-400/10",
    green: "border-emerald-300/30 bg-emerald-400/10",
    blue: "border-sky-300/30 bg-sky-400/10",
  }[tone];

  return (
    <div
      className={`rounded-[22px] border p-4 shadow-[0_16px_36px_rgba(0,0,0,0.28)] ${toneClasses}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-300">
        {label}
      </p>

      <ROINumber
        value={stats.roi}
        className="mt-2 text-3xl"
      />

      <p
        className={`mt-2 text-sm font-black ${
          stats.profitLoss >= 0
            ? "text-emerald-200"
            : "text-rose-200"
        }`}
      >
        {formatSignedMoney(stats.profitLoss)}
      </p>

      <p className="mt-1 text-[10px] font-semibold leading-4 text-zinc-400">
        {detail}
      </p>
    </div>
  );
}

function SourceROICard({
  label,
  stats,
  tone,
  showMaverickBadge = false,
}: {
  label: string;
  stats: PersonalStats;
  tone: "gold" | "blue" | "green";
  showMaverickBadge?: boolean;
}) {
  const toneClasses = {
    gold: "border-amber-300/25 bg-amber-400/10",
    blue: "border-sky-300/25 bg-sky-400/10",
    green: "border-emerald-300/25 bg-emerald-400/10",
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClasses}`}>
      {showMaverickBadge ? (
        <div className="flex items-center gap-2">
          <img
            src="/maverick/maverick-shield.png"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 shrink-0 object-contain"
          />

          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-amber-200">
              The Maverick
            </p>

            <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-zinc-500">
              Your Accepted Tips
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-300">
          {label}
        </p>
      )}

      <ROINumber
        value={stats.roi}
        className="mt-2 text-xl"
      />

      <p
        className={`mt-1 text-[10px] font-black ${
          stats.profitLoss >= 0
            ? "text-emerald-200"
            : "text-rose-200"
        }`}
      >
        {formatSignedMoney(stats.profitLoss)}
      </p>

      <p className="mt-1 text-[9px] font-semibold text-zinc-500">
        {stats.total} accepted
      </p>
    </div>
  );
}

function SuccessCard({
  label,
  successful,
  total,
  percentage,
  tone,
  description,
  roi,
  profitLoss,
  showMaverickBadge = false,
}: {
  label: string;
  successful: number;
  total: number;
  percentage: number;
  tone: "gold" | "blue";
  description: string;
  roi?: number;
  profitLoss?: number;
  showMaverickBadge?: boolean;
}) {
  const toneClasses = {
    gold: "border-amber-300/30 bg-amber-400/10",
    blue: "border-sky-300/30 bg-sky-400/10",
  }[tone];

  const numberClasses = {
    gold: "text-amber-200",
    blue: "text-sky-200",
  }[tone];

  return (
    <div className={`rounded-[22px] border p-4 ${toneClasses}`}>
      {showMaverickBadge ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-black/40 p-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/40 bg-black/70 shadow-[0_0_18px_rgba(251,191,36,0.24)]">
            <img
              src="/maverick/maverick-shield.png"
              alt="The Maverick"
              className="h-full w-full object-contain p-1"
            />
          </div>

          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-amber-200">
              The Maverick
            </p>

            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
              Official Performance
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-300">
          {label}
        </p>
      )}

      <div
        className={
          roi !== undefined
            ? "grid grid-cols-2 gap-3"
            : ""
        }
      >
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
            Success
          </p>

          <p className={`mt-2 text-3xl font-black ${numberClasses}`}>
            {total > 0
              ? `${percentage.toFixed(1)}%`
              : "—"}
          </p>
        </div>

        {roi !== undefined ? (
          <div className="border-l border-white/10 pl-3">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
              ROI
            </p>

            <ROINumber
              value={roi}
              className="mt-2 text-3xl"
            />
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs font-black text-white">
        {successful}/{total} successful
      </p>

      {profitLoss !== undefined ? (
        <p
          className={`mt-1 text-[11px] font-black ${
            profitLoss >= 0
              ? "text-emerald-200"
              : "text-rose-200"
          }`}
        >
          {formatSignedMoney(profitLoss)} profit / loss
        </p>
      ) : null}

      <p className="mt-2 text-[10px] font-semibold leading-4 text-zinc-400">
        {description}
      </p>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const resolvedSearchParams =
    (await searchParams) || {};

  const today = getPerthTodayKey();
  const defaultFrom = shiftDateKey(today, -29);

  let rangeFrom = isValidDateKey(
    resolvedSearchParams.from,
  )
    ? String(resolvedSearchParams.from)
    : defaultFrom;

  let rangeTo = isValidDateKey(
    resolvedSearchParams.to,
  )
    ? String(resolvedSearchParams.to)
    : today;

  if (rangeFrom > rangeTo) {
    [rangeFrom, rangeTo] = [rangeTo, rangeFrom];
  }

  const rangeStartIso = `${rangeFrom}T00:00:00+08:00`;
  const rangeEndExclusiveIso = `${shiftDateKey(
    rangeTo,
    1,
  )}T00:00:00+08:00`;

  const supabase = await createClient();

  const [
    userBetsResult,
    headTipperResults,
    calculatorSuccessResult,
  ] = await Promise.all([
    supabase
      .from("user_bets")
      .select("*")
      .eq("user_id", profile.id)
      .not("settled_at", "is", null)
      .order("settled_at", { ascending: false }),

    supabase
      .from("suggested_tips")
.select(
  `
  id,
  type,
  successful,
  finishing_position,
  stake_points,
  return_points,
  profit_loss_points,
  settled_at
`,
)
      .not("settled_at", "is", null)
      .gte("settled_at", rangeStartIso)
      .lt("settled_at", rangeEndExclusiveIso),

    getCalculatorSuccessStatsAction({
      from: rangeFrom,
      to: rangeTo,
    }),
  ]);

  if (userBetsResult.error) {
    throw new Error(userBetsResult.error.message);
  }

  if (headTipperResults.error) {
    throw new Error(headTipperResults.error.message);
  }

  if (!calculatorSuccessResult.success) {
    throw new Error(
      calculatorSuccessResult.error ||
        "Failed to load Calculator success statistics.",
    );
  }

  const bets =
    (userBetsResult.data || []) as UserBet[];

  const nonVoidedBets = bets.filter(
    (bet) => bet.voided !== true,
  );

  const todayBets = nonVoidedBets.filter(
    (bet) => getPerthDateKey(bet.settled_at) === today,
  );

  const selectedRangeBets = nonVoidedBets.filter(
    (bet) =>
      isWithinRange(
        bet.settled_at,
        rangeFrom,
        rangeTo,
      ),
  );

  const selectedRangeDisplayBets = bets.filter(
    (bet) =>
      isWithinRange(
        bet.settled_at,
        rangeFrom,
        rangeTo,
      ),
  );

  const allTimeStats =
    buildPersonalStats(nonVoidedBets);

  const todayStats =
    buildPersonalStats(todayBets);

  const selectedRangeStats =
    buildPersonalStats(selectedRangeBets);

  const selectedHeadTipperStats = buildPersonalStats(
    selectedRangeBets.filter(
      (bet) => bet.source === "head_tipper",
    ),
  );

  const selectedCalculatorStats = buildPersonalStats(
    selectedRangeBets.filter(
      (bet) => bet.source === "calculator",
    ),
  );

  const selectedSubscriberStats = buildPersonalStats(
    selectedRangeBets.filter(
      (bet) => bet.source === "subscriber",
    ),
  );

  const headTipperTips =
    (headTipperResults.data || []) as SuggestedTipResult[];

const maverickPerformance =
  buildPublishedMaverickStats(
    headTipperTips,
  );

  const calculatorSuccess = {
    total: calculatorSuccessResult.total,
    successful:
      calculatorSuccessResult.successful,
    percentage:
      calculatorSuccessResult.percentage,
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_90%_8%,rgba(14,165,233,0.10),transparent_26%),linear-gradient(180deg,#030303_0%,#09090b_48%,#020617_100%)] text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 lg:px-8">
        <header className="sticky top-2 z-20 rounded-[26px] border border-amber-300/20 bg-black/85 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_24px_rgba(245,158,11,0.25)]">
                <img
                  src="/smartpunt-icon-512.png"
                  alt="SmartPunt"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300">
                  SmartPunt
                </p>

                <h1 className="truncate text-xl font-black tracking-tight">
                  My Resulted Tips
                </h1>
              </div>
            </div>

            <Link
              href="/subscriber-dashboard"
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/15"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <main className="mt-4 space-y-4 pb-10">
          <section className="overflow-hidden rounded-[30px] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.98),rgba(24,24,27,0.96),rgba(120,53,15,0.32))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
              Personal Performance
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Your betting results
            </h2>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-zinc-300">
              Track your personal return on investment and compare how
              different SmartPunt sources performed.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <SummaryCard
                label="All-Time ROI"
                stats={allTimeStats}
                detail={`${allTimeStats.successful}/${allTimeStats.total} successful · ${formatMoney(allTimeStats.stake)} staked`}
                tone="gold"
              />

              <SummaryCard
                label="Today ROI"
                stats={todayStats}
                detail={`${todayStats.successful}/${todayStats.total} successful today`}
                tone="green"
              />
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-black/70 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Date Range
              </p>

              <p className="mt-1 text-xs font-semibold text-zinc-400">
                Personal ROI and SmartPunt success figures below use this
                selected period.
              </p>
            </div>

            <form
              method="get"
              className="mt-4 grid grid-cols-2 gap-2"
            >
              <label className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                From
                <input
                  type="date"
                  name="from"
                  defaultValue={rangeFrom}
                  max={rangeTo}
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm font-black text-zinc-950 outline-none focus:border-amber-400"
                  style={{
                    colorScheme: "light",
                  }}
                />
              </label>

              <label className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                To
                <input
                  type="date"
                  name="to"
                  defaultValue={rangeTo}
                  min={rangeFrom}
                  max={today}
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm font-black text-zinc-950 outline-none focus:border-amber-400"
                  style={{
                    colorScheme: "light",
                  }}
                />
              </label>

              <button
                type="submit"
                className="col-span-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110"
              >
                Apply Date Range
              </button>
            </form>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link
                href={`/my-resulted-tips?from=${today}&to=${today}`}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-zinc-300"
              >
                Today
              </Link>

              <Link
                href={`/my-resulted-tips?from=${shiftDateKey(
                  today,
                  -6,
                )}&to=${today}`}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-zinc-300"
              >
                7 Days
              </Link>

              <Link
                href={`/my-resulted-tips?from=${defaultFrom}&to=${today}`}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-zinc-300"
              >
                30 Days
              </Link>
            </div>
          </section>

          <section className="rounded-[28px] border border-amber-300/25 bg-[linear-gradient(145deg,rgba(9,9,11,0.98),rgba(2,6,23,0.96))] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.42)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Selected Range ROI
                </p>

                <ROINumber
                  value={selectedRangeStats.roi}
                  className="mt-2 text-4xl"
                />
              </div>

              <div className="text-right">
                <p
                  className={`text-lg font-black ${
                    selectedRangeStats.profitLoss >= 0
                      ? "text-emerald-200"
                      : "text-rose-200"
                  }`}
                >
                  {formatSignedMoney(
                    selectedRangeStats.profitLoss,
                  )}
                </p>

                <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                  {formatMoney(selectedRangeStats.stake)} staked
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold text-zinc-400">
              {formatDate(`${rangeFrom}T12:00:00+08:00`)} to{" "}
              {formatDate(`${rangeTo}T12:00:00+08:00`)} ·{" "}
              {selectedRangeStats.successful}/
              {selectedRangeStats.total} successful
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
<SourceROICard
  label="The Maverick"
  stats={selectedHeadTipperStats}
  tone="gold"
  showMaverickBadge
/>

              <SourceROICard
                label="Calculator"
                stats={selectedCalculatorStats}
                tone="blue"
              />

              <SourceROICard
                label="My Picks"
                stats={selectedSubscriberStats}
                tone="green"
              />
            </div>
          </section>

<section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <SuccessCard
    label="The Maverick"
    successful={maverickPerformance.successful}
    total={maverickPerformance.total}
    percentage={maverickPerformance.percentage}
    roi={maverickPerformance.roi}
    profitLoss={maverickPerformance.profitLoss}
    showMaverickBadge
    tone="gold"
    description="All officially published and resulted Maverick tips in this period"
  />

  <SuccessCard
    label="Calculator Success"
    successful={calculatorSuccess.successful}
    total={calculatorSuccess.total}
    percentage={calculatorSuccess.percentage}
    tone="blue"
    description="All resulted Calculator tips in this period"
  />
</section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Resulted Tips
                </p>

                <p className="mt-1 text-xs font-semibold text-zinc-400">
                  Your personal bets in the selected range
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black text-zinc-200">
                {selectedRangeDisplayBets.length}
              </span>
            </div>

            {selectedRangeDisplayBets.length > 0 ? (
              selectedRangeDisplayBets.map((bet) => {
                const betType = normaliseBetType(
                  bet.bet_type,
                );

                const isEachWay =
                  betType === "Each Way";

                const successful =
                  isPersonalBetSuccessful(bet);

                const totalStake =
                  getTotalStake(bet);

                const totalReturn =
                  getStoredReturn(bet);

                const profitLoss =
                  getProfitLoss(bet);

                return (
                  <article
                    key={bet.id}
                    className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,9,11,0.98),rgba(2,6,23,0.96))] shadow-[0_20px_50px_rgba(0,0,0,0.42)]"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                            {bet.race || "Race"}
                          </p>

                          <h3 className="mt-1 truncate text-2xl font-black leading-tight text-white">
                            {bet.horse || "Unnamed horse"}
                          </h3>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`text-xl font-black ${
                              profitLoss >= 0
                                ? "text-emerald-200"
                                : "text-rose-200"
                            }`}
                          >
                            {formatSignedMoney(profitLoss)}
                          </p>

                          <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                            {formatDateTime(bet.settled_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
<span
  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${sourceClasses(
    bet.source,
  )}`}
>
  {bet.source === "head_tipper" ? (
    <>
      <img
        src="/maverick/maverick-shield.png"
        alt=""
        aria-hidden="true"
        className="h-5 w-5 shrink-0 object-contain"
      />

      <span className="leading-none">
        Official Maverick
      </span>
    </>
  ) : (
    sourceLabel(bet.source)
  )}
</span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${betTypeClasses(
                            bet.bet_type,
                          )}`}
                        >
                          {betType}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${
                            bet.voided
                              ? "border-zinc-400/30 bg-zinc-400/10 text-zinc-200"
                              : successful
                                ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                                : "border-rose-300/40 bg-rose-400/15 text-rose-100"
                          }`}
                        >
                          {bet.voided
                            ? "Void"
                            : successful
                              ? "Successful"
                              : "Unsuccessful"}
                        </span>

                        {bet.finishing_position ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-300">
                            Finished {bet.finishing_position}
                          </span>
                        ) : null}
                      </div>

                      {isEachWay ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-200">
                              Win Leg
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatMoney(
                                toNumber(
                                  bet.win_stake_points,
                                ),
                              )}
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-emerald-100/80">
                              at{" "}
                              {formatOdds(
                                bet.win_odds_taken,
                              )}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-sky-200">
                              Place Leg
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatMoney(
                                toNumber(
                                  bet.place_stake_points,
                                ),
                              )}
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-sky-100/80">
                              at{" "}
                              {formatOdds(
                                bet.place_odds_taken,
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                              Odds Taken
                            </p>

                            <p className="mt-2 text-xl font-black text-white">
                              {formatOdds(bet.odds_taken)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                              Stake
                            </p>

                            <p className="mt-2 text-xl font-black text-white">
                              {formatMoney(totalStake)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                            Total Stake
                          </p>

                          <p className="mt-2 text-base font-black text-white">
                            {formatMoney(totalStake)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-sky-200">
                            Return
                          </p>

                          <p className="mt-2 text-base font-black text-white">
                            {formatMoney(totalReturn)}
                          </p>
                        </div>

                        <div
                          className={`rounded-2xl border p-3 ${
                            profitLoss >= 0
                              ? "border-emerald-300/20 bg-emerald-400/10"
                              : "border-rose-300/20 bg-rose-400/10"
                          }`}
                        >
                          <p
                            className={`text-[8px] font-black uppercase tracking-[0.12em] ${
                              profitLoss >= 0
                                ? "text-emerald-200"
                                : "text-rose-200"
                            }`}
                          >
                            Profit / Loss
                          </p>

                          <p
                            className={`mt-2 text-base font-black ${
                              profitLoss >= 0
                                ? "text-emerald-100"
                                : "text-rose-100"
                            }`}
                          >
                            {formatSignedMoney(profitLoss)}
                          </p>
                        </div>
                      </div>

                      {bet.voided && bet.void_reason ? (
                        <div className="mt-3 rounded-2xl border border-zinc-400/20 bg-zinc-400/10 p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                            Void Reason
                          </p>

                          <p className="mt-1 text-[11px] font-semibold leading-5 text-zinc-400">
                            {bet.void_reason}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-white/10 bg-black/35 px-4 py-3">
                      <p className="text-[10px] font-black text-zinc-300">
                        {sourceDescription(bet.source)}
                      </p>

                      <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                        Settled {formatDateTime(bet.settled_at)}
                      </p>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/25 bg-black/70 p-1 shadow-[0_0_22px_rgba(251,191,36,0.18)]">
                  <img
                    src="/smartpunt-icon-512.png"
                    alt="SmartPunt"
                    className="h-full w-full object-cover"
                  />
                </div>

                <h2 className="mt-4 text-2xl font-black">
                  No resulted tips
                </h2>

                <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-zinc-400">
                  You have no personal bets settled within the selected
                  date range.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
