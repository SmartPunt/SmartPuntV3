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
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
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
                        {tip.confidence ? <Badge tone="amber">{tip.confidence}</Badge> : null}
                        {tip.finishing_position ? (
                          <Badge tone="slate">Fin: {tip.finishing_position}</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-zinc-500">{formatShortDate(tip.settled_at)}</p>
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
                      {tip.confidence ? <Badge tone="amber">{tip.confidence}</Badge> : null}
                      {tip.finishing_position ? (
                        <Badge tone="slate">Finishing position: {tip.finishing_position}</Badge>
                      ) : null}
                      <Badge tone="slate">{formatDate(tip.settled_at)}</Badge>
                    </div>

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

  const total = tips.length;
  const wins = tips.filter((t) => t.successful === true).length;
  const losses = tips.filter((t) => t.successful === false).length;
  const strikeRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

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
        <div className="grid gap-4 md:grid-cols-4">
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
              <p className="text-sm text-zinc-500">Strike Rate</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {strikeRate}%
              </p>
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
