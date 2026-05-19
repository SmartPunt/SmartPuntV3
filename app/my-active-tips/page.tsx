import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

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
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  created_at: string | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

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
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
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

function sourceDescription(source: string | null | undefined) {
  if (source === "calculator") return "Model Signal";
  if (source === "subscriber") return "Your own selection";
  return "Published head tipper selection";
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

const activeBets = ((data || []) as Array<
  UserBet & {
    race_runner?: {
      id: number;
      scratched: boolean | null;
    } | null;
  }
>).filter((bet) => bet.race_runner?.scratched !== true);
  const totalStake = activeBets.reduce(
    (sum, bet) => sum + (toNumber(bet.stake_points) || 1),
    0,
  );
  const headTipperCount = activeBets.filter((bet) => bet.source === "head_tipper").length;
  const calculatorCount = activeBets.filter((bet) => bet.source === "calculator").length;
  const subscriberCount = activeBets.filter((bet) => bet.source === "subscriber").length;

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
            My Active Bets
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
        <div className="grid gap-4 md:grid-cols-5">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Active Bets</p>
              <p className="mt-2 text-2xl font-semibold">{activeBets.length}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Stake Points</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {totalStake.toFixed(1)}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Head Tipper</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {headTipperCount}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Calculator</p>
              <p className="mt-2 text-2xl font-semibold text-blue-700">
                {calculatorCount}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">My Picks</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">
                {subscriberCount}
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-6">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Active betting ledger</h2>
                  <p className="text-sm text-zinc-500">
                    These are your accepted bets waiting to be resulted. ROI will be calculated from your odds once the race is settled.
                  </p>
                </div>
                <Badge tone="amber">{activeBets.length}</Badge>
              </div>

              {activeBets.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {activeBets.map((bet) => {
                    const stake = toNumber(bet.stake_points) || 1;
                    const odds = toNumber(bet.odds_taken);

                    return (
                      <div
                        key={bet.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">{bet.race || "Race"}</p>
                            <h3 className="mt-1 text-xl font-bold text-zinc-950">
                              {bet.horse || "Unnamed horse"}
                            </h3>
                          </div>

                          <Badge tone={sourceTone(bet.source)}>{sourceLabel(bet.source)}</Badge>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge tone="blue">{bet.bet_type || "Win"}</Badge>
                          <Badge tone="green">Odds {odds.toFixed(2)}</Badge>
                          <Badge tone="amber">Stake {stake.toFixed(1)} pt</Badge>
                          <Badge tone="slate">Active</Badge>
                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Source
                          </p>
                          <p className="mt-2 text-sm text-zinc-700">
                            {sourceDescription(bet.source)}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Added {formatDateTime(bet.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">
                    No active bets yet.
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Add a Head Tipper tip, Calculator signal, or your own pick from the dashboard.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
