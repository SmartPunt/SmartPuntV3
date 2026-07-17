import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type UserBet = {
  id: number;
  source: "head_tipper" | "calculator" | "subscriber" | string;
  suggested_tip_id: number | null;
  calculator_tip_id: number | null;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  horse: string | null;
  race: string | null;
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
  settled_at: string | null;
  created_at: string | null;
};

type ActiveUserBet = UserBet & {
  race_runner?: {
    id: number;
    scratched: boolean | null;
  } | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

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

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatOdds(value: number | string | null | undefined) {
  const parsed = toNumber(value);

  if (parsed <= 0) {
    return "—";
  }

  return parsed.toFixed(2).replace(/\.00$/, "");
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
  return "Head Tipper";
}

function sourceDescription(source: string | null | undefined) {
  if (source === "calculator") {
    return "SmartPunt Calculator selection";
  }

  if (source === "subscriber") {
    return "Your own selection";
  }

  return "Official Head Tipper selection";
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
  const betType = normaliseBetType(bet.bet_type);

  if (betType === "Each Way") {
    const winStake = toNumber(bet.win_stake_points);
    const placeStake = toNumber(bet.place_stake_points);
    const calculatedTotal = winStake + placeStake;

    if (calculatedTotal > 0) {
      return calculatedTotal;
    }
  }

  return toNumber(bet.stake_points);
}

function getPotentialReturn(bet: UserBet) {
  const betType = normaliseBetType(bet.bet_type);

  if (betType === "Each Way") {
    const winReturn =
      toNumber(bet.win_stake_points) *
      toNumber(bet.win_odds_taken);

    const placeReturn =
      toNumber(bet.place_stake_points) *
      toNumber(bet.place_odds_taken);

    return winReturn + placeReturn;
  }

  return (
    toNumber(bet.stake_points) *
    toNumber(bet.odds_taken)
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "gold",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "gold" | "green" | "blue";
}) {
  const toneClasses = {
    gold: "border-amber-300/30 bg-amber-400/10 text-amber-200",
    green:
      "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    blue: "border-sky-300/30 bg-sky-400/10 text-sky-200",
  }[tone];

  return (
    <div
      className={`rounded-[22px] border p-4 shadow-[0_16px_36px_rgba(0,0,0,0.28)] ${toneClasses}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-80">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-semibold leading-4 opacity-75">
        {detail}
      </p>
    </div>
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
    .select(
      `
      *,
      race_runner:race_runners!user_bets_race_runner_id_fkey (
        id,
        scratched
      )
    `,
    )
    .eq("user_id", profile.id)
    .is("settled_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const activeBets = ((data || []) as ActiveUserBet[]).filter(
    (bet) => bet.race_runner?.scratched !== true,
  );

  const totalStake = activeBets.reduce(
    (sum, bet) => sum + getTotalStake(bet),
    0,
  );

  const totalPotentialReturn = activeBets.reduce(
    (sum, bet) => sum + getPotentialReturn(bet),
    0,
  );

  const headTipperCount = activeBets.filter(
    (bet) => bet.source === "head_tipper",
  ).length;

  const calculatorCount = activeBets.filter(
    (bet) => bet.source === "calculator",
  ).length;

  const subscriberCount = activeBets.filter(
    (bet) => bet.source === "subscriber",
  ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.10),transparent_26%),linear-gradient(180deg,#030303_0%,#09090b_48%,#020617_100%)] text-white">
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
                  My Active Tips
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
              Personal Betting Ledger
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Your live exposure
            </h2>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-zinc-300">
              See what you have staked, your maximum potential return and
              exactly where every active selection came from.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <SummaryCard
                label="Total Staked"
                value={formatMoney(totalStake)}
                detail={`${activeBets.length} active ${
                  activeBets.length === 1 ? "tip" : "tips"
                }`}
                tone="gold"
              />

              <SummaryCard
                label="Potential Return"
                value={formatMoney(totalPotentialReturn)}
                detail="Maximum return if every live leg succeeds"
                tone="green"
              />
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Head Tipper"
              value={String(headTipperCount)}
              detail="Official tips"
              tone="gold"
            />

            <SummaryCard
              label="Calculator"
              value={String(calculatorCount)}
              detail="Model tips"
              tone="blue"
            />

            <SummaryCard
              label="My Picks"
              value={String(subscriberCount)}
              detail="Built by you"
              tone="green"
            />
          </section>

          {activeBets.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                    Active Tips
                  </p>

                  <p className="mt-1 text-xs font-semibold text-zinc-400">
                    Waiting to be settled
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black text-zinc-200">
                  {activeBets.length}
                </span>
              </div>

              {activeBets.map((bet) => {
                const betType = normaliseBetType(bet.bet_type);
                const totalBetStake = getTotalStake(bet);
                const potentialReturn = getPotentialReturn(bet);
                const isEachWay = betType === "Each Way";

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

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${sourceClasses(
                            bet.source,
                          )}`}
                        >
                          {sourceLabel(bet.source)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${betTypeClasses(
                            bet.bet_type,
                          )}`}
                        >
                          {betType}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-300">
                          Active
                        </span>
                      </div>

                      {isEachWay ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
                              Win Leg
                            </p>

                            <p className="mt-2 text-xl font-black text-white">
                              {formatMoney(
                                toNumber(bet.win_stake_points),
                              )}
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-emerald-100/80">
                              at {formatOdds(bet.win_odds_taken)}
                            </p>

                            <p className="mt-2 text-[10px] font-black text-emerald-200">
                              Return{" "}
                              {formatMoney(
                                toNumber(bet.win_stake_points) *
                                  toNumber(bet.win_odds_taken),
                              )}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-200">
                              Place Leg
                            </p>

                            <p className="mt-2 text-xl font-black text-white">
                              {formatMoney(
                                toNumber(bet.place_stake_points),
                              )}
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-sky-100/80">
                              at {formatOdds(bet.place_odds_taken)}
                            </p>

                            <p className="mt-2 text-[10px] font-black text-sky-200">
                              Return{" "}
                              {formatMoney(
                                toNumber(bet.place_stake_points) *
                                  toNumber(bet.place_odds_taken),
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                              Odds
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatOdds(bet.odds_taken)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                              Stake
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatMoney(totalBetStake)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200">
                              Return
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatMoney(potentialReturn)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                              Total stake
                            </p>

                            <p className="mt-1 text-lg font-black text-white">
                              {formatMoney(totalBetStake)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                              Potential return
                            </p>

                            <p className="mt-1 text-lg font-black text-emerald-200">
                              {formatMoney(potentialReturn)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 bg-black/35 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black text-zinc-300">
                            {sourceDescription(bet.source)}
                          </p>

                          <p className="mt-1 text-[9px] font-semibold text-zinc-500">
                            Added {formatDateTime(bet.created_at)}
                          </p>
                        </div>

                        {bet.race_id ? (
                          <Link
                            href={`/smartpunt-calculator-live-picks?raceId=${bet.race_id}`}
                            className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200"
                          >
                            View Race
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-2xl">
                🎯
              </div>

              <h2 className="mt-4 text-2xl font-black text-white">
                No active tips
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-zinc-400">
                Accept a Head Tipper tip, Calculator selection or build your own
                pick from the Dashboard.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/smartpunt-calculator-live-picks"
                  className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-black"
                >
                  Live Picks
                </Link>

                <Link
                  href="/subscriber-dashboard"
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-white"
                >
                  Dashboard
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
