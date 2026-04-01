import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel, TipPill } from "@/components/ui";

function getTipCardStyle(type: string) {
  if (type === "Win") return "border-emerald-300/50 bg-emerald-100";
  if (type === "Place") return "border-sky-300/50 bg-sky-100";
  if (type === "All Up") return "border-pink-300/50 bg-pink-100";
  return "border-amber-200/30 bg-white";
}

function getTipDate(tip: any) {
  return tip.settled_at || tip.race_start_at || tip.updated_at || tip.created_at || null;
}

function calculateSuccessStats(tips: any[]) {
  const now = new Date();

  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const isThisMonth = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  };

  const settled = tips.filter((tip) => typeof tip.successful === "boolean");
  const settledToday = settled.filter((tip) => isToday(getTipDate(tip)));
  const settledThisMonth = settled.filter((tip) => isThisMonth(getTipDate(tip)));

  const makeStat = (items: any[]) => {
    const total = items.length;
    const won = items.filter((tip) => tip.successful).length;

    return {
      total,
      rate: total ? Math.round((won / total) * 100) : null,
    };
  };

  return {
    day: makeStat(settledToday),
    month: makeStat(settledThisMonth),
    all: makeStat(settled),
  };
}

function StatCard({
  title,
  stat,
  emptyLabel,
  tone,
}: {
  title: string;
  stat: { total: number; rate: number | null };
  emptyLabel: string;
  tone: "green" | "amber" | "rose";
}) {
  return (
    <Panel className="text-zinc-950">
      <div className="p-4">
        <p className="text-sm text-zinc-500">{title}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold">
            {stat.total ? `${stat.rate}%` : emptyLabel}
          </p>
          <Badge tone={tone}>
            {stat.total ? `${stat.total} settled` : "No bets"}
          </Badge>
        </div>
      </div>
    </Panel>
  );
}

export default async function ResultedTipsPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();

  const { data: resultedTips } = await supabase
    .from("suggested_tips")
    .select("*")
    .not("successful", "is", null)
    .order("settled_at", { ascending: false, nullsFirst: false });

  const stats = calculateSuccessStats(resultedTips || []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">SmartPunt</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Resulted Tips</h1>
            <p className="mt-2 text-sm text-amber-100/70">
              Head Tipper settled history and strike rate.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            Back to Live Tips
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            title="Head Tipper Today"
            stat={stats.day}
            emptyLabel="No bets today"
            tone="green"
          />
          <StatCard
            title="Head Tipper This Month"
            stat={stats.month}
            emptyLabel="No bets this month"
            tone="amber"
          />
          <StatCard
            title="Head Tipper All Time"
            stat={stats.all}
            emptyLabel="No bets yet"
            tone="rose"
          />
        </div>

        <div className="mt-8 space-y-4">
          {(resultedTips || []).length ? (
            (resultedTips || []).map((tip: any) => (
              <div
                key={tip.id}
                className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(tip.type)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-500">{tip.race}</p>
                    <h3 className="mt-1 text-2xl font-semibold text-zinc-950">{tip.horse}</h3>
                  </div>
                  <TipPill type={tip.type} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
                  {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
                  {tip.finishing_position ? (
                    <Badge tone="slate">Placed {tip.finishing_position}</Badge>
                  ) : null}
                  {tip.successful === true ? <Badge tone="green">Successful</Badge> : null}
                  {tip.successful === false ? <Badge tone="rose">Unsuccessful</Badge> : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-zinc-700">{tip.commentary || ""}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
              No resulted tips yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
