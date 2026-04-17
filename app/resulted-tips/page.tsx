import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
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

  const today = resultedTips.filter((t) => isToday(t.settled_at));
  const lastMonth = resultedTips.filter((t) => isLastMonth(t.settled_at));
  const older = resultedTips.filter(
    (t) => !isToday(t.settled_at) && !isLastMonth(t.settled_at)
  );

  const total = resultedTips.length;
  const wins = resultedTips.filter((t) => t.successful === true).length;
  const strikeRate =
    total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

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
    <div className="min-h-screen bg-black text-white p-4 lg:p-8">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Resulted Tips</h1>
          <Link href="/" className="text-sm text-zinc-400">
            Back
          </Link>
        </div>

        {/* STATS */}
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

        {/* GROUPS */}
        <Section title="Today" data={today} />
        <Section title="Last Month" data={lastMonth} />
        <Section title="Older" data={older} />
      </div>
    </div>
  );
}
