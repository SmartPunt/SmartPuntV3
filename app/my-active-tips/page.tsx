import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { removeTipActiveAction } from "@/lib/actions";
import { Badge, Panel, TipPill } from "@/components/ui";

type SuggestedTip = {
  id: number;
  race: string;
  horse: string;
  type: string;
  confidence: string | null;
  note: string | null;
  commentary: string | null;
  race_start_at: string | null;
  race_timezone: string | null;
};

function formatRaceDateTime(value?: string | null, timezone?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone || "Australia/Perth",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
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

  const tipIds = (userTips || []).map((t: any) => t.tip_id);

  let activeTips: SuggestedTip[] = [];

  if (tipIds.length > 0) {
    const { data } = await supabase
      .from("suggested_tips")
      .select("*")
      .in("id", tipIds)
      .is("settled_at", null)
      .order("race_start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    activeTips = (data || []) as SuggestedTip[];
  }

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
            My Active Tips
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
        <div className="grid gap-4 md:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Active Tips</p>
              <p className="mt-2 text-2xl font-semibold">{activeTips.length}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Status</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">Live</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Workflow</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">
                Accepted tips move here until they result.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-6">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Active board</h2>
                  <p className="text-sm text-zinc-500">
                    These are the tips you’ve accepted and moved off the live board.
                  </p>
                </div>
                <Badge tone="amber">{activeTips.length}</Badge>
              </div>

              {activeTips.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {activeTips.map((tip) => {
                    const raceDateTime = formatRaceDateTime(tip.race_start_at, tip.race_timezone);

                    return (
                      <div
                        key={tip.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">{tip.race}</p>
                            <h3 className="mt-1 text-xl font-bold text-zinc-950">
                              {tip.horse}
                            </h3>
                          </div>

                          <TipPill type={tip.type} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {tip.confidence ? <Badge tone="blue">{tip.confidence} confidence</Badge> : null}
                          {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
                          {raceDateTime ? <Badge tone="slate">{raceDateTime}</Badge> : null}
                          <Badge tone="green">Active</Badge>
                        </div>

                        {tip.commentary ? (
                          <p className="mt-4 text-sm leading-7 text-zinc-700">
                            {tip.commentary}
                          </p>
                        ) : null}

                        <div className="mt-5">
                          <form action={removeTipActiveAction}>
                            <input type="hidden" name="tip_id" value={tip.id} />
                            <button className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                              Remove from My Active Tips
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">
                    No active tips yet.
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Accept a tip from the subscriber dashboard and it’ll land here.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
