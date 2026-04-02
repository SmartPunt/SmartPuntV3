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

function getVerdictIcon(tip: any) {
  if (tip.successful === true) {
    return <span className="text-emerald-600 text-xl font-bold">✔</span>;
  }

  if (tip.successful === false) {
    const text = String(tip.result_comment || "").toLowerCase();

    if (
      text.includes("luck") ||
      text.includes("blocked") ||
      text.includes("held up") ||
      text.includes("unlucky") ||
      text.includes("wide") ||
      text.includes("traffic")
    ) {
      return <span className="text-amber-500 text-xl font-bold">⚠</span>;
    }

    return <span className="text-rose-600 text-xl font-bold">✖</span>;
  }

  return null;
}

export default async function MyResultedTipsPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "user") redirect("/");

  const supabase = await createClient();

  const { data: activeSelections } = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const tipIds = (activeSelections || []).map((row: any) => row.tip_id);

  let resultedTips: any[] = [];

  if (tipIds.length) {
    const { data } = await supabase
      .from("suggested_tips")
      .select("*")
      .in("id", tipIds)
      .not("successful", "is", null)
      .order("settled_at", { ascending: false });

    resultedTips = data || [];
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">My Resulted Tips</h1>

        <div className="mt-6 space-y-4">
          {resultedTips.length ? (
            resultedTips.map((tip: any) => (
              <div
                key={tip.id}
                className={`rounded-[24px] border p-5 shadow-sm ${getTipCardStyle(tip.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">{tip.race}</p>
                    <h3 className="text-xl font-bold text-zinc-950">{tip.horse}</h3>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <TipPill type={tip.type} />
                    {getVerdictIcon(tip)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tip.note && <Badge tone="amber">{tip.note}</Badge>}
                  {tip.finishing_position && (
                    <Badge tone="slate">Placed {tip.finishing_position}</Badge>
                  )}
                </div>

                {tip.result_comment && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-zinc-900">
                    <p className="text-xs font-semibold uppercase text-amber-700">
                      Post-race analysis
                    </p>
                    <p className="mt-2 text-sm">{tip.result_comment}</p>
                  </div>
                )}

                <details className="mt-4 rounded-xl bg-white/70 p-4 text-zinc-900">
                  <summary className="cursor-pointer text-sm font-semibold">
                    View original tip write-up
                  </summary>
                  <p className="mt-2 text-sm">{tip.commentary}</p>
                </details>
              </div>
            ))
          ) : (
            <div className="text-sm text-zinc-400">
              No resulted tips yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
