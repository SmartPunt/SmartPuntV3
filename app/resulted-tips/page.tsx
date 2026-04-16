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

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: tips } = await supabase
    .from("suggested_tips")
    .select("*")
    .not("successful", "is", null)
    .order("settled_at", { ascending: false });

  const resultedTips = tips || [];

  const total = resultedTips.length;
  const wins = resultedTips.filter((t) => t.successful === true).length;
  const losses = resultedTips.filter((t) => t.successful === false).length;
  const strikeRate =
    total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      
      {/* HEADER */}
      <div className="relative overflow-hidden border-b border-white/10 bg-black">
        <img
          src="/header-logo.png"
          alt="SmartPunt"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 opacity-20 sm:w-[500px] lg:w-[900px]"
        />

        <div className="relative z-10 flex items-center justify-between px-4 py-4 lg:px-8">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Resulted Tips
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
        
        {/* STATS */}
        <div className="grid gap-4 md:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Total Tips</p>
              <p className="mt-2 text-2xl font-semibold">{total}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Wins</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{wins}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Losses</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">{losses}</p>
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

        {/* LIST */}
        <div className="mt-6 space-y-4">
          {resultedTips.length > 0 ? (
            resultedTips.map((tip) => (
              <Panel
                key={tip.id}
                className="bg-white/95 transition hover:shadow-md"
              >
                <div className="p-5 text-zinc-950">
                  
                  {/* HEADER ROW */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-500">{tip.race}</p>
                      <h2 className="text-lg font-semibold">{tip.horse}</h2>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge tone={tip.successful ? "green" : "rose"}>
                        {tip.successful ? "Win" : "Loss"}
                      </Badge>

                      <Badge tone="blue">{tip.type}</Badge>

                      <Badge tone="amber">{tip.confidence}</Badge>

                      {tip.finishing_position ? (
                        <Badge tone="slate">
                          Fin: {tip.finishing_position}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* COMMENTARY */}
                  {tip.commentary && (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      {tip.commentary}
                    </div>
                  )}

                  {/* RESULT COMMENT */}
                  {tip.result_comment && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {tip.result_comment}
                    </div>
                  )}

                  {/* FOOTER */}
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                    <span>{formatDate(tip.settled_at)}</span>
                    <span>{tip.note}</span>
                  </div>
                </div>
              </Panel>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-300">
              No resulted tips yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
