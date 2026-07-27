import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

type MaverickTip = {
  id: number;
  race: string | null;
  horse: string | null;
  type: string | null;
  confidence: string | null;
  note: string | null;
  commentary: string | null;
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
  result_comment: string | null;
  win_odds: number | string | null;
  place_odds: number | string | null;
  tip_angle: string | null;
};

type ReportPreset =
  | "today"
  | "yesterday"
  | "7-days"
  | "30-days"
  | "all"
  | "custom";

type ReportSearchParams = {
  preset?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

type TipFinancialResult = {
  hasOfficialOdds: boolean;
  stake: number;
  returnAmount: number;
  profitLoss: number;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getPerthDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatUnits(value: number) {
  const prefix = value > 0 ? "+" : "";

  return `${prefix}${value.toFixed(2)}u`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function normaliseBetType(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function calculateTipFinancialResult(
  tip: MaverickTip,
): TipFinancialResult {
  const betType = normaliseBetType(tip.type);
  const winOdds = numberValue(tip.win_odds);
  const placeOdds = numberValue(tip.place_odds);
  const finishingPosition = Number(tip.finishing_position);
  const wonRace = finishingPosition === 1;
  const successful = tip.successful === true;

  if (betType === "win") {
    if (winOdds === null) {
      return {
        hasOfficialOdds: false,
        stake: 0,
        returnAmount: 0,
        profitLoss: 0,
      };
    }

    const returnAmount = wonRace || successful ? winOdds : 0;

    return {
      hasOfficialOdds: true,
      stake: 1,
      returnAmount,
      profitLoss: returnAmount - 1,
    };
  }

  if (betType === "place") {
    if (placeOdds === null) {
      return {
        hasOfficialOdds: false,
        stake: 0,
        returnAmount: 0,
        profitLoss: 0,
      };
    }

    const returnAmount = successful ? placeOdds : 0;

    return {
      hasOfficialOdds: true,
      stake: 1,
      returnAmount,
      profitLoss: returnAmount - 1,
    };
  }

  if (betType === "each way" || betType === "each-way") {
    if (winOdds === null || placeOdds === null) {
      return {
        hasOfficialOdds: false,
        stake: 0,
        returnAmount: 0,
        profitLoss: 0,
      };
    }

    const winStake = 0.25;
    const placeStake = 0.75;

    const winReturn = wonRace ? winStake * winOdds : 0;
    const placeReturn = successful ? placeStake * placeOdds : 0;
    const returnAmount = winReturn + placeReturn;

    return {
      hasOfficialOdds: true,
      stake: winStake + placeStake,
      returnAmount,
      profitLoss: returnAmount - (winStake + placeStake),
    };
  }

  return {
    hasOfficialOdds: false,
    stake: 0,
    returnAmount: 0,
    profitLoss: 0,
  };
}

function tipWasSuccessful(tip: MaverickTip) {
  return tip.successful === true;
}

function getSelectedDateRange({
  preset,
  customFrom,
  customTo,
}: {
  preset: ReportPreset;
  customFrom: string;
  customTo: string;
}) {
  const today = getPerthDateKey(new Date());

  if (preset === "today") {
    return {
      from: today,
      to: today,
      label: "Today",
    };
  }

  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);

    return {
      from: yesterday,
      to: yesterday,
      label: "Yesterday",
    };
  }

  if (preset === "7-days") {
    return {
      from: addDays(today, -6),
      to: today,
      label: "Last 7 Days",
    };
  }

  if (preset === "30-days") {
    return {
      from: addDays(today, -29),
      to: today,
      label: "Last 30 Days",
    };
  }

  if (preset === "custom") {
    return {
      from: customFrom,
      to: customTo,
      label:
        customFrom || customTo
          ? `${customFrom || "Beginning"} to ${customTo || "Today"}`
          : "Custom Range",
    };
  }

  return {
    from: "",
    to: "",
    label: "All Time",
  };
}

function filterTipsByDate(
  tips: MaverickTip[],
  from: string,
  to: string,
) {
  return tips.filter((tip) => {
    const settledDate = tip.settled_at
      ? getPerthDateKey(tip.settled_at)
      : "";

    if (!settledDate) {
      return false;
    }

    if (from && settledDate < from) {
      return false;
    }

    if (to && settledDate > to) {
      return false;
    }

    return true;
  });
}

function calculateSummary(tips: MaverickTip[]) {
  const successfulTips = tips.filter(tipWasSuccessful).length;

  const pricedRows = tips
    .map((tip) => ({
      tip,
      financial: calculateTipFinancialResult(tip),
    }))
    .filter((row) => row.financial.hasOfficialOdds);

  const stake = pricedRows.reduce(
    (total, row) => total + row.financial.stake,
    0,
  );

  const returns = pricedRows.reduce(
    (total, row) => total + row.financial.returnAmount,
    0,
  );

  const profitLoss = returns - stake;
  const roi = stake > 0 ? (profitLoss / stake) * 100 : 0;
  const strikeRate =
    tips.length > 0 ? (successfulTips / tips.length) * 100 : 0;

  return {
    totalTips: tips.length,
    successfulTips,
    strikeRate,
    pricedTips: pricedRows.length,
    unpricedTips: tips.length - pricedRows.length,
    stake,
    returns,
    profitLoss,
    roi,
  };
}

function resultTone(tip: MaverickTip) {
  return tipWasSuccessful(tip) ? "green" : "rose";
}

function resultLabel(tip: MaverickTip) {
  const type = normaliseBetType(tip.type);

  if (!tipWasSuccessful(tip)) {
    return "Unsuccessful";
  }

  if (type === "place") {
    return "Placed";
  }

  if (type === "each way" || type === "each-way") {
    return Number(tip.finishing_position) === 1
      ? "Won"
      : "Placed";
  }

  return "Won";
}

function typeTone(type?: string | null) {
  const normalised = normaliseBetType(type);

  if (normalised === "win") {
    return "green";
  }

  if (normalised === "place") {
    return "blue";
  }

  if (normalised === "each way" || normalised === "each-way") {
    return "rose";
  }

  return "slate";
}

function officialOddsLabel(tip: MaverickTip) {
  const type = normaliseBetType(tip.type);
  const winOdds = numberValue(tip.win_odds);
  const placeOdds = numberValue(tip.place_odds);

  if (type === "win") {
    return winOdds !== null ? `Win $${winOdds.toFixed(2)}` : "No official odds";
  }

  if (type === "place") {
    return placeOdds !== null
      ? `Place $${placeOdds.toFixed(2)}`
      : "No official odds";
  }

  if (type === "each way" || type === "each-way") {
    if (winOdds === null || placeOdds === null) {
      return "No complete official odds";
    }

    return `Win $${winOdds.toFixed(2)} · Place $${placeOdds.toFixed(2)}`;
  }

  return "No official odds";
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-amber-300 text-black"
          : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function MaverickReportPage({
  searchParams,
}: {
  searchParams?: Promise<ReportSearchParams>;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const resolvedSearchParams = searchParams
    ? await searchParams
    : {};

  const requestedPreset = firstParam(
    resolvedSearchParams.preset,
  );

  const preset: ReportPreset = [
    "today",
    "yesterday",
    "7-days",
    "30-days",
    "custom",
    "all",
  ].includes(requestedPreset)
    ? (requestedPreset as ReportPreset)
    : "30-days";

  const customFrom = firstParam(resolvedSearchParams.from);
  const customTo = firstParam(resolvedSearchParams.to);

  const selectedRange = getSelectedDateRange({
    preset,
    customFrom,
    customTo,
  });

  const supabase = await createClient();

const { data, error } = await supabase
  .from("suggested_tips")
  .select(
    "id,race,horse,type,confidence,note,commentary,finishing_position,successful,settled_at,result_comment,win_odds,place_odds,tip_angle",
  )
  .not("successful", "is", null)
  .not("settled_at", "is", null)
  .order("settled_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message || "Failed to load The Maverick report.",
    );
  }

const allTips = (data ?? []) as unknown as MaverickTip[];

  const filteredTips = filterTipsByDate(
    allTips,
    selectedRange.from,
    selectedRange.to,
  );

  const summary = calculateSummary(filteredTips);
  const recentForm = filteredTips.slice(0, 10);
const monthlyPerformance = Array.from(
  filteredTips.reduce((map, tip) => {
    const key = tip.settled_at
      ? new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Perth",
          month: "long",
          year: "numeric",
        }).format(new Date(tip.settled_at))
      : "Unknown";

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(tip);

    return map;
  }, new Map<string, MaverickTip[]>()),
)
  .map(([month, tips]) => ({
    month,
    summary: calculateSummary(tips),
  }))
  .reverse();
  const typeBreakdown = ["Win", "Place", "Each Way"].map(
    (type) => {
      const tips = filteredTips.filter(
        (tip) => normaliseBetType(tip.type) === type.toLowerCase(),
      );

      return {
        type,
        tips,
        summary: calculateSummary(tips),
      };
    },
  );

  const angleBreakdown = Array.from(
    filteredTips.reduce((map, tip) => {
      const angle = String(tip.tip_angle || "").trim();

      if (!angle) {
        return map;
      }

      const existingTips = map.get(angle) ?? [];
      existingTips.push(tip);
      map.set(angle, existingTips);

      return map;
    }, new Map<string, MaverickTip[]>()),
  )
    .map(([angle, tips]) => ({
      angle,
      summary: calculateSummary(tips),
    }))
    .sort((a, b) => {
      if (b.summary.totalTips !== a.summary.totalTips) {
        return b.summary.totalTips - a.summary.totalTips;
      }

      return a.angle.localeCompare(b.angle);
    });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[30px] border border-white/10 bg-black/70 p-5 shadow-2xl backdrop-blur-sm lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">Admin Report</Badge>
                <Badge tone="slate">{selectedRange.label}</Badge>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">
                The Maverick Report
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                Official tip performance using fixed SmartPunt staking
                and the publication odds recorded against each tip.
              </p>
            </div>

            <Link
              href="/"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to Admin
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <FilterLink
              href="/admin/maverick-report?preset=today"
              active={preset === "today"}
            >
              Today
            </FilterLink>

            <FilterLink
              href="/admin/maverick-report?preset=yesterday"
              active={preset === "yesterday"}
            >
              Yesterday
            </FilterLink>

            <FilterLink
              href="/admin/maverick-report?preset=7-days"
              active={preset === "7-days"}
            >
              7 Days
            </FilterLink>

            <FilterLink
              href="/admin/maverick-report?preset=30-days"
              active={preset === "30-days"}
            >
              30 Days
            </FilterLink>

            <FilterLink
              href="/admin/maverick-report?preset=all"
              active={preset === "all"}
            >
              All Time
            </FilterLink>
          </div>

          <form
            method="get"
            className="mt-4 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input type="hidden" name="preset" value="custom" />

            <label className="text-sm font-medium text-zinc-200">
              From
              <input
                type="date"
                name="from"
                defaultValue={customFrom}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black px-3 py-3 text-white outline-none focus:border-amber-300"
              />
            </label>

            <label className="text-sm font-medium text-zinc-200">
              To
              <input
                type="date"
                name="to"
                defaultValue={customTo}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black px-3 py-3 text-white outline-none focus:border-amber-300"
              />
            </label>

            <button
              type="submit"
              className="self-end rounded-2xl bg-amber-300 px-5 py-3 font-semibold text-black transition hover:bg-amber-200"
            >
              Apply Dates
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Total Tips
              </p>
              <p className="mt-2 text-3xl font-bold">
                {summary.totalTips}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {summary.successfulTips} successful tips
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Strike Rate
              </p>
              <p className="mt-2 text-3xl font-bold">
                {formatPercent(summary.strikeRate)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Successful tips ÷ all resulted tips
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Profit / Loss
              </p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  summary.profitLoss > 0
                    ? "text-emerald-700"
                    : summary.profitLoss < 0
                      ? "text-red-700"
                      : "text-zinc-950"
                }`}
              >
                {formatUnits(summary.profitLoss)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {summary.stake.toFixed(2)}u staked ·{" "}
                {summary.returns.toFixed(2)}u returned
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-5 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Official ROI
              </p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  summary.roi > 0
                    ? "text-emerald-700"
                    : summary.roi < 0
                      ? "text-red-700"
                      : "text-zinc-950"
                }`}
              >
                {formatPercent(summary.roi)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Based on {summary.pricedTips} officially priced tips
              </p>
            </div>
          </Panel>
        </div>
<Panel className="mt-6 bg-white/95">
  <div className="p-5 text-zinc-950">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
      Current Form
    </p>

    <div className="mt-4 flex flex-wrap gap-3">
      {recentForm.length > 0 ? (
        recentForm.map((tip) => (
          <div
            key={tip.id}
            title={`${tip.horse ?? "Unknown"} • ${tip.race ?? ""}`}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white ${
              tip.successful
                ? "bg-emerald-600"
                : "bg-red-600"
            }`}
          >
            {tip.successful ? "✓" : "✕"}
          </div>
        ))
      ) : (
        <p className="text-sm text-zinc-500">
          No resulted tips yet.
        </p>
      )}
    </div>

    <p className="mt-4 text-sm text-zinc-500">
      Most recent 10 resulted tips.
    </p>
  </div>
</Panel>
        {summary.unpricedTips > 0 ? (
          <div className="mt-4 rounded-[24px] border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
            {summary.unpricedTips} historical{" "}
            {summary.unpricedTips === 1 ? "tip has" : "tips have"} no
            complete official odds. These tips remain included in strike
            rate but are excluded from profit and ROI.
          </div>
        ) : null}
<Panel className="mt-6 bg-white/95">
  <div className="p-5 text-zinc-950">
    <h2 className="text-xl font-semibold">
      Monthly Performance
    </h2>

    <p className="mt-1 text-sm text-zinc-500">
      Performance grouped by settled month.
    </p>

    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="py-3">Month</th>
            <th>Tips</th>
            <th>Strike Rate</th>
            <th>Profit/Loss</th>
            <th>ROI</th>
          </tr>
        </thead>

        <tbody>
          {monthlyPerformance.map((row) => (
            <tr
              key={row.month}
              className="border-b border-zinc-100"
            >
              <td className="py-3 font-semibold">
                {row.month}
              </td>

              <td>{row.summary.totalTips}</td>

              <td>
                {formatPercent(row.summary.strikeRate)}
              </td>

              <td
                className={
                  row.summary.profitLoss > 0
                    ? "font-semibold text-emerald-700"
                    : row.summary.profitLoss < 0
                    ? "font-semibold text-red-700"
                    : ""
                }
              >
                {formatUnits(row.summary.profitLoss)}
              </td>

              <td
                className={
                  row.summary.roi > 0
                    ? "font-semibold text-emerald-700"
                    : row.summary.roi < 0
                    ? "font-semibold text-red-700"
                    : ""
                }
              >
                {formatPercent(row.summary.roi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</Panel>
        <Panel className="mt-6 bg-white/95">
          <div className="p-5 text-zinc-950 lg:p-6">
            <div>
              <h2 className="text-xl font-semibold">
                Performance by Bet Type
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Fixed staking: Win 1.00u, Place 1.00u, Each Way
                0.25u win plus 0.75u place.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <th className="px-3 py-3">Bet Type</th>
                    <th className="px-3 py-3">Tips</th>
                    <th className="px-3 py-3">Successful</th>
                    <th className="px-3 py-3">Strike</th>
                    <th className="px-3 py-3">Priced</th>
                    <th className="px-3 py-3">Staked</th>
                    <th className="px-3 py-3">Profit/Loss</th>
                    <th className="px-3 py-3">ROI</th>
                  </tr>
                </thead>

                <tbody>
                  {typeBreakdown.map((row) => (
                    <tr
                      key={row.type}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-3 py-4">
                        <Badge tone={typeTone(row.type)}>
                          {row.type}
                        </Badge>
                      </td>

                      <td className="px-3 py-4 font-semibold">
                        {row.summary.totalTips}
                      </td>

                      <td className="px-3 py-4">
                        {row.summary.successfulTips}
                      </td>

                      <td className="px-3 py-4">
                        {formatPercent(row.summary.strikeRate)}
                      </td>

                      <td className="px-3 py-4">
                        {row.summary.pricedTips}
                      </td>

                      <td className="px-3 py-4">
                        {row.summary.stake.toFixed(2)}u
                      </td>

                      <td
                        className={`px-3 py-4 font-semibold ${
                          row.summary.profitLoss > 0
                            ? "text-emerald-700"
                            : row.summary.profitLoss < 0
                              ? "text-red-700"
                              : ""
                        }`}
                      >
                        {formatUnits(row.summary.profitLoss)}
                      </td>

                      <td
                        className={`px-3 py-4 font-semibold ${
                          row.summary.roi > 0
                            ? "text-emerald-700"
                            : row.summary.roi < 0
                              ? "text-red-700"
                              : ""
                        }`}
                      >
                        {formatPercent(row.summary.roi)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel className="mt-6 bg-white/95">
          <div className="p-5 text-zinc-950 lg:p-6">
            <div>
              <h2 className="text-xl font-semibold">
                Performance by Tip Angle
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Official performance grouped by The Maverick angle
                recorded when each tip was published.
              </p>
            </div>

            {angleBreakdown.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <th className="px-3 py-3">Tip Angle</th>
                      <th className="px-3 py-3">Tips</th>
                      <th className="px-3 py-3">Successful</th>
                      <th className="px-3 py-3">Strike</th>
                      <th className="px-3 py-3">Priced</th>
                      <th className="px-3 py-3">Staked</th>
                      <th className="px-3 py-3">Profit/Loss</th>
                      <th className="px-3 py-3">ROI</th>
                    </tr>
                  </thead>

                  <tbody>
                    {angleBreakdown.map((row) => (
                      <tr
                        key={row.angle}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="px-3 py-4">
                          <Badge tone="slate">
                            {row.angle}
                          </Badge>
                        </td>

                        <td className="px-3 py-4 font-semibold">
                          {row.summary.totalTips}
                        </td>

                        <td className="px-3 py-4">
                          {row.summary.successfulTips}
                        </td>

                        <td className="px-3 py-4">
                          {formatPercent(row.summary.strikeRate)}
                        </td>

                        <td className="px-3 py-4">
                          {row.summary.pricedTips}
                        </td>

                        <td className="px-3 py-4">
                          {row.summary.stake.toFixed(2)}u
                        </td>

                        <td
                          className={`px-3 py-4 font-semibold ${
                            row.summary.profitLoss > 0
                              ? "text-emerald-700"
                              : row.summary.profitLoss < 0
                                ? "text-red-700"
                                : ""
                          }`}
                        >
                          {formatUnits(row.summary.profitLoss)}
                        </td>

                        <td
                          className={`px-3 py-4 font-semibold ${
                            row.summary.roi > 0
                              ? "text-emerald-700"
                              : row.summary.roi < 0
                                ? "text-red-700"
                                : ""
                          }`}
                        >
                          {formatPercent(row.summary.roi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                No tip angles have been recorded for this period.
              </div>
            )}
          </div>
        </Panel>

        <details className="group mt-8 rounded-[30px] border border-white/10 bg-black/30 p-5 lg:p-6">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">
                  Resulted Tip History
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  {filteredTips.length} tips in the selected period.
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-amber-300 group-open:hidden">
                  Show History
                </p>

                <p className="hidden text-sm font-semibold text-amber-300 group-open:block">
                  Hide History
                </p>

                <span className="mt-1 block text-xl text-zinc-400 transition group-open:rotate-180">
                  ⌄
                </span>
              </div>
            </div>
          </summary>

          {filteredTips.length > 0 ? (
            <div className="mt-4 space-y-3">
              {filteredTips.map((tip) => {
                const financial =
                  calculateTipFinancialResult(tip);

                return (
                  <details
                    key={tip.id}
                    className="group rounded-[24px] border border-white/10 bg-white/5 p-5"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-400">
                            {tip.race || "Race not supplied"}
                          </p>

                          <h3 className="mt-1 text-lg font-semibold text-white">
                            {tip.horse || "Unknown horse"}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={typeTone(tip.type)}>
                              {tip.type || "Tip"}
                            </Badge>

                            <Badge tone={resultTone(tip)}>
                              {resultLabel(tip)}
                            </Badge>

                            {tip.confidence ? (
                              <Badge tone="amber">
                                {tip.confidence}
                              </Badge>
                            ) : null}

                            {tip.tip_angle ? (
                              <Badge tone="slate">
                                {tip.tip_angle}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-zinc-400">
                            {formatDate(tip.settled_at)}
                          </p>

                          <p
                            className={`mt-2 text-lg font-bold ${
                              !financial.hasOfficialOdds
                                ? "text-zinc-400"
                                : financial.profitLoss > 0
                                  ? "text-emerald-300"
                                  : financial.profitLoss < 0
                                    ? "text-red-300"
                                    : "text-white"
                            }`}
                          >
                            {financial.hasOfficialOdds
                              ? formatUnits(financial.profitLoss)
                              : "Unpriced"}
                          </p>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Official Result
                        </p>

                        <p className="mt-2 text-sm text-zinc-200">
                          Odds: {officialOddsLabel(tip)}
                        </p>

                        <p className="mt-1 text-sm text-zinc-200">
                          Finishing position:{" "}
                          {tip.finishing_position !== null
                            ? tip.finishing_position
                            : "—"}
                        </p>

                        {financial.hasOfficialOdds ? (
                          <>
                            <p className="mt-1 text-sm text-zinc-200">
                              Stake: {financial.stake.toFixed(2)}u
                            </p>

                            <p className="mt-1 text-sm text-zinc-200">
                              Return:{" "}
                              {financial.returnAmount.toFixed(2)}u
                            </p>
                          </>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Tip Details
                        </p>

                        {tip.note ? (
                          <p className="mt-2 text-sm text-zinc-200">
                            Tag: {tip.note}
                          </p>
                        ) : null}

                        {tip.commentary ? (
                          <p className="mt-3 text-sm leading-6 text-zinc-300">
                            {tip.commentary}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {tip.result_comment ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                          Post-race analysis
                        </p>

                        <p className="mt-2 text-sm leading-6 text-amber-50">
                          {tip.result_comment}
                        </p>
                      </div>
                    ) : null}
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-white/15 bg-white/5 p-8 text-center text-zinc-400">
              No resulted Maverick tips were found for this period.
            </div>
          )}
        </details>
      </div>
    </div>
  );
}
