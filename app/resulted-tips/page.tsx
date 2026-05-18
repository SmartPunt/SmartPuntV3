import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { SMARTPUNT_SCORING_VERSION } from "@/lib/calculator/scoring";
import { Badge, Panel } from "@/components/ui";

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

type SmartPuntCalculatorPrediction = {
  id: number;
  won: boolean | null;
  placed: boolean | null;
  finishing_position: number | null;
  smartpunt_tip_type: string | null;
};

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

async function fetchServiceRoleRows<T>(tablePath: string) {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers } = getServiceRoleConfig();
    const separator = tablePath.includes("?") ? "&" : "?";
    const path = `${tablePath}${separator}limit=${pageSize}&offset=${offset}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Service role request failed for ${tablePath}`);
    }

    const rows = (await response.json()) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) break;

    offset += pageSize;
  }

  return allRows;
}

function isCalculatorTipSuccessful(row: SmartPuntCalculatorPrediction) {
  const type = String(row.smartpunt_tip_type || "").toLowerCase();

  if (type.includes("place")) {
    return row.placed === true;
  }

  return row.won === true || row.finishing_position === 1;
}

async function getSmartPuntCalculatorStrikeRate() {
  try {
    const rows = await fetchServiceRoleRows<SmartPuntCalculatorPrediction>(
      `calculator_predictions?select=id,won,placed,finishing_position,smartpunt_tip_type&scoring_version=eq.${encodeURIComponent(
        SMARTPUNT_SCORING_VERSION,
      )}&is_smartpunt_tip=eq.true&settled_at=not.is.null&finishing_position=not.is.null`,
    );

    const total = rows.length;
    const wins = rows.filter(isCalculatorTipSuccessful).length;
    const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    return { total, wins, strikeRate };
  } catch (error) {
    console.error(error);
    return { total: 0, wins: 0, strikeRate: "0.0" };
  }
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

  const resultedTips = tips || [];
  const calculatorStats = await getSmartPuntCalculatorStrikeRate();

  const today = resultedTips.filter((t) => isToday(t.settled_at));
  const lastMonth = resultedTips.filter((t) => isLastMonth(t.settled_at));
  const older = resultedTips.filter(
    (t) => !isToday(t.settled_at) && !isLastMonth(t.settled_at),
  );

  const total = resultedTips.length;
  const wins = resultedTips.filter((t) => t.successful === true).length;
  const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  function Section({ title, data }: any) {
    if (!data.length) return null;

    return (
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>

        <div className="space-y-2">
          {data.map((tip: any) => (
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

                  <div className="flex gap-2">
                    <Badge tone={tip.successful ? "green" : "rose"}>
                      {tip.successful ? "Win" : "Loss"}
                    </Badge>
                    <Badge tone="amber">{tip.confidence}</Badge>
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-3 text-sm text-zinc-300">
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

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Panel className="bg-white/95 p-4 text-black">
            <p>Total</p>
            <p className="text-xl font-bold">{total}</p>
          </Panel>

          <Panel className="bg-white/95 p-4 text-black">
            <p>Wins</p>
            <p className="text-xl font-bold">{wins}</p>
          </Panel>

          <Panel className="bg-white/95 p-4 text-black">
            <p>Head Tipper Strike</p>
            <p className="text-xl font-bold">{strikeRate}%</p>
          </Panel>

          <Panel className="bg-white/95 p-4 text-black">
            <p>SmartPunt Calculator</p>
            <p className="text-xl font-bold text-amber-700">
              {calculatorStats.strikeRate}%
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {calculatorStats.wins}/{calculatorStats.total} model tips successful
            </p>
          </Panel>
        </div>

        <Section title="Today" data={today} />
        <Section title="Last Month" data={lastMonth} />
        <Section title="Older" data={older} />
      </div>
    </div>
  );
}
