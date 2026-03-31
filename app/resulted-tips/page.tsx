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
  const settledToday = settled.filter((tip) => isToday(tip.settled_at || tip.race_start_at));
  const settledThisMonth = settled.filter((tip) =>
    isThisMonth(tip.settled_at || tip.race_start_at),
  );

  const pct = (items: any[]) =>
    items.length ? Math.round((items.filter((tip) => tip.successful).length / items.length) * 100) : 0;

  return {
    day: { rate: pct(settledToday), total: settledToday.length },
    month: { rate: pct(settledThisMonth), total: settledThisMonth.length },
    all: { rate: pct(settled), total: settled.length },
  };
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
            <p className="mt-2 text-sm text-amber-100/70">Head Tipper settled history and strike rate.</p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            Back to Live Tips
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Head Tipper Today</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.day.rate}%</p>
                <Badge tone="green">{stats.day.total} settled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Head Tipper Month</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.month.rate}%</p>
                <Badge tone="amber">{stats.month.total} settled</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="text-zinc-950">
            <div className="p-4">
              <p className="text-sm text-zinc-500">Head Tipper All Time</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-semibold">{stats.all.rate}%</p>
                <Badge tone="rose">{stats.all.total} settled</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 space-y-4">
          {(resultedTips || []).map((tip: any) => (
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
                {tip.finishing_position ? <Badge tone="slate">Placed {tip.finishing_position}</Badge> : null}
                {tip.successful === true ? <Badge tone="green">Successful</Badge> : null}
                {tip.successful === false ? <Badge tone="rose">Unsuccessful</Badge> : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-700">{tip.commentary || ""}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
