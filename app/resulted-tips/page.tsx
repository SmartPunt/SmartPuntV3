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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isToday(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isLastMonth(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1);

  return d < now && d > oneMonthAgo && !isToday(dateStr);
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

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: tips } = await supabase
    .from("suggested_tips")
    .select("*")
    .not("successful", "is", null)
    .order("settled_at", { ascending: false });

  const rawResultedTips = (tips || []) as ResultedTip[];
  const runnerIds = rawResultedTips
    .map((tip) => Number(tip.race_runner_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const calculatorPredictions = await fetchCalculatorPredictionsForRunnerIds(
    runnerIds,
  );

  const resultedTips = attachCalculatorScores(
    rawResultedTips,
    calculatorPredictions,
  );

  const today = resultedTips.filter((t) => isToday(t.settled_at));
  const lastMonth = resultedTips.filter((t) => isLastMonth(t.settled_at));
  const older = resultedTips.filter(
    (t) => !isToday(t.settled_at) && !isLastMonth(t.settled_at),
  );

  const total = resultedTips.length;
  const wins = resultedTips.filter((t) => t.successful === true).length;
  const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  function Section({ title, data }: { title: string; data: ResultedTip[] }) {
    if (!data.length) return null;

    return (
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>

        <div className="space-y-2">
          {data.map((tip) => (
            <details
              key={tip.id}
              className="group rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">{tip.race}</p>
                    <p className="text-sm font-semibold">{tip.horse}</p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone={tip.successful ? "green" : "rose"}>
                      {tip.successful ? "Win" : "Loss"}
                    </Badge>
                    <Badge tone="amber">{tip.confidence}</Badge>
                    {tip.calculator_score !== null &&
                    tip.calculator_score !== undefined ? (
                      <Badge tone="blue">
                        SmartPunt Calc {tip.calculator_score}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                {tip.calculator_score !== null &&
                tip.calculator_score !== undefined ? (
                  <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-3 text-blue-100">
                    SmartPunt Calculator Score: {tip.calculator_score}%
                  </div>
                ) : null}

                {tip.commentary && <p>{tip.commentary}</p>}

                {tip.result_comment && (
                  <div className="rounded-lg bg-amber-100 p-3 text-amber-900">
                    {tip.result_comment}
                  </div>
                )}

                <div className="text-xs text-zinc-400">
                  {formatDate(tip.settled_at)}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 text-white lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Resulted Tips</h1>
          <Link href="/" className="text-sm text-zinc-400">
            Back
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Panel className="bg-white/95 p-4 text-black">
            <p>Total</p>
            <p className="text-xl font-bold">{total}</p>
          </Panel>

          <Panel className="bg-white/95 p-4 text-black">
            <p>Wins</p>
            <p className="text-xl font-bold">{wins}</p>
          </Panel>

          <Panel className="bg-white/95 p-4 text-black">
            <p>Strike</p>
            <p className="text-xl font-bold">{strikeRate}%</p>
          </Panel>
        </div>

        <Section title="Today" data={today} />
        <Section title="Last Month" data={lastMonth} />
        <Section title="Older" data={older} />
      </div>
    </div>
  );
}
