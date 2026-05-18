import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type ResultedTip = {
  id: number;
  race: string | null;
  horse: string | null;
  type: string | null;
  confidence: string | null;
  note: string | null;
  commentary: string | null;
  result_comment: string | null;
  race_runner_id: number | null;
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
  calculator_score?: number | null;
};

type CalculatorPrediction = {
  runner_id: number | null;
  score: number | string | null;
  predicted_at: string | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

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

function getServiceRoleConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration in environment variables.",
    );
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
}

async function fetchCalculatorPredictionsForRunnerIds(
  runnerIds: number[],
): Promise<CalculatorPrediction[]> {
  if (!runnerIds.length) return [];

  const { supabaseUrl, headers } = getServiceRoleConfig();
  const uniqueRunnerIds = Array.from(new Set(runnerIds.filter(Boolean)));
  const allRows: CalculatorPrediction[] = [];

  for (let i = 0; i < uniqueRunnerIds.length; i += 400) {
    const chunk = uniqueRunnerIds.slice(i, i + 400);
    const path = `calculator_predictions?select=runner_id,score,predicted_at&runner_id=in.(${chunk.join(
      ",",
    )})&order=predicted_at.desc`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to load calculator predictions.");
    }

    allRows.push(...((await response.json()) as CalculatorPrediction[]));
  }

  return allRows;
}

function attachCalculatorScores(
  tips: ResultedTip[],
  predictions: CalculatorPrediction[],
) {
  const scoreByRunnerId = new Map<number, number>();

  for (const prediction of predictions) {
    const runnerId = Number(prediction.runner_id);
    if (!runnerId || scoreByRunnerId.has(runnerId)) continue;

    const score = Number(prediction.score ?? 0);
    scoreByRunnerId.set(runnerId, Number.isFinite(score) ? Math.round(score) : 0);
  }

  return tips.map((tip) => ({
    ...tip,
    calculator_score: tip.race_runner_id
      ? scoreByRunnerId.get(Number(tip.race_runner_id)) ?? null
      : null,
  }));
}

function groupTips(tips: ResultedTip[]) {
  const todayKey = getTodayPerthKey();
  const lastMonthCutoffKey = getDaysAgoPerthKey(30);

  const todaysTips: ResultedTip[] = [];
  const lastMonthsTips: ResultedTip[] = [];
  const olderTips: ResultedTip[] = [];

  for (const tip of tips) {
    const settledKey = getPerthDayKey(tip.settled_at);

    if (!settledKey) {
      olderTips.push(tip);
      continue;
    }

    if (settledKey === todayKey) {
      todaysTips.push(tip);
      continue;
    }

    if (settledKey >= lastMonthCutoffKey) {
      lastMonthsTips.push(tip);
      continue;
    }

    olderTips.push(tip);
  }

  return { todaysTips, lastMonthsTips, olderTips };
}

function Section({
  title,
  tips,
  defaultOpen = true,
}: {
  title: string;
  tips: ResultedTip[];
  defaultOpen?: boolean;
}) {
  return (
    <Panel className="bg-white/95">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-zinc-950 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {tips.length} {tips.length === 1 ? "tip" : "tips"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="blue">{tips.length}</Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 group-open:hidden">
              Expand
            </span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 group-open:inline">
              Collapse
            </span>
          </div>
        </summary>

        <div className="border-t border-zinc-200 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {tips.length > 0 ? (
            <div className="space-y-3">
              {tips.map((tip) => (
                <details
                  key={tip.id}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-zinc-950">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        {tip.race || "Race"}
                      </p>
                      <h3 className="truncate text-base font-semibold">
                        {tip.horse || "Unnamed horse"}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={tip.successful ? "green" : "rose"}>
                          {tip.successful ? "Win" : "Loss"}
                        </Badge>

                        {tip.type ? <Badge tone="blue">{tip.type}</Badge> : null}
                        {tip.confidence ? (
                          <Badge tone="amber">{tip.confidence}</Badge>
                        ) : null}
                        {tip.finishing_position ? (
                          <Badge tone="slate">Fin: {tip.finishing_position}</Badge>
                        ) : null}
                        {tip.calculator_score !== null &&
                        tip.calculator_score !== undefined ? (
                          <Badge tone="blue">
                            SmartPunt Calc {tip.calculator_score}%
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-zinc-500">
                        {formatShortDate(tip.settled_at)}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 group-open:hidden">
                        Open
                      </p>
                      <p className="mt-1 hidden text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 group-open:block">
                        Close
                      </p>
                    </div>
                  </summary>

                  <div className="border-t border-zinc-200 bg-white px-4 py-4 text-zinc-950">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tip.successful ? "green" : "rose"}>
                        {tip.successful ? "Win" : "Loss"}
                      </Badge>
                      {tip.type ? <Badge tone="blue">{tip.type}</Badge> : null}
                      {tip.confidence ? (
                        <Badge tone="amber">{tip.confidence}</Badge>
                      ) : null}
                      {tip.finishing_position ? (
                        <Badge tone="slate">
                          Finishing position: {tip.finishing_position}
                        </Badge>
                      ) : null}
                      <Badge tone="slate">{formatDate(tip.settled_at)}</Badge>
                      {tip.calculator_score !== null &&
                      tip.calculator_score !== undefined ? (
                        <Badge tone="blue">
                          SmartPunt Calc Score: {tip.calculator_score}%
                        </Badge>
                      ) : null}
                    </div>

                    {tip.calculator_score !== null &&
                    tip.calculator_score !== undefined ? (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                        SmartPunt Calculator Score: {tip.calculator_score}%
                      </div>
                    ) : null}

                    {tip.commentary ? (
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                        {tip.commentary}
                      </div>
                    ) : null}

                    {tip.result_comment ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                        {tip.result_comment}
                      </div>
                    ) : null}

                    {tip.note ? (
                      <div className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                        Note: {tip.note}
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-sm text-zinc-500">
              No tips in this section yet.
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

  const { data: userTips } = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const tipIds = (userTips || []).map((t) => t.tip_id);

  let tips: ResultedTip[] = [];

  if (tipIds.length > 0) {
    const { data } = await supabase
      .from("suggested_tips")
      .select("*")
      .in("id", tipIds)
      .not("successful", "is", null)
      .order("settled_at", { ascending: false });

    tips = (data || []) as ResultedTip[];
  }

  const runnerIds = tips
    .map((tip) => Number(tip.race_runner_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const calculatorPredictions = await fetchCalculatorPredictionsForRunnerIds(
    runnerIds,
  );

  tips = attachCalculatorScores(tips, calculatorPredictions);

  const { data: allSettledTipsData } = await supabase
    .from("suggested_tips")
    .select("id, successful")
    .not("successful", "is", null);

  const allSettledTips = allSettledTipsData || [];

  const total = tips.length;
  const wins = tips.filter((t) => t.successful === true).length;
  const losses = tips.filter((t) => t.successful === false).length;
  const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  const headTipperTotal = allSettledTips.length;
  const headTipperWins = allSettledTips.filter((t) => t.successful === true).length;
  const headTipperStrikeRate =
    headTipperTotal > 0 ? ((headTipperWins / headTipperTotal) * 100).toFixed(1) : "0.0";

  const strikeRateDelta =
    total > 0 && headTipperTotal > 0
      ? (Number(strikeRate) - Number(headTipperStrikeRate)).toFixed(1)
      : null;

  const { todaysTips, lastMonthsTips, olderTips } = groupTips(tips);

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
            My Resulted Tips
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
              <p className="text-sm text-zinc-500">My Tips</p>
              <p className="mt-2 text-2xl font-semibold">{total}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Wins</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">
                {wins}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Losses</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">
                {losses}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">My Strike Rate</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {strikeRate}%
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Head Tipper</p>
              <p className="mt-2 text-2xl font-semibold text-blue-700">
                {headTipperStrikeRate}%
              </p>
              {strikeRateDelta !== null ? (
                <p className="mt-2 text-xs font-medium text-zinc-500">
                  {Number(strikeRateDelta) >= 0 ? "You’re up" : "You’re down"}{" "}
                  {Math.abs(Number(strikeRateDelta)).toFixed(1)} pts
                </p>
              ) : (
                <p className="mt-2 text-xs font-medium text-zinc-500">
                  Comparison builds once both sets have results.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-6 space-y-4">
          <Section title="Today’s Tips" tips={todaysTips} defaultOpen />
          <Section title="Last Month’s Tips" tips={lastMonthsTips} defaultOpen />
          <Section title="Older Tips" tips={olderTips} />
        </div>
      </div>
    </div>
  );
}
