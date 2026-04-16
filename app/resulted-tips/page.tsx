import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel, TipPill } from "@/components/ui";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const tipsQuery = await supabase
    .from("suggested_tips")
    .select("*")
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: false });

  const racesQuery = await supabase.from("races").select("*");
  const meetingsQuery = await supabase.from("meetings").select("*");
  const runnersQuery = await supabase.from("race_runners").select("*");
  const horsesQuery = await supabase.from("horses").select("*");

  const tips = tipsQuery.data || [];
  const races = racesQuery.data || [];
  const meetings = meetingsQuery.data || [];
  const runners = runnersQuery.data || [];
  const horses = horsesQuery.data || [];

  const raceMap = new Map(races.map((r) => [r.id, r]));
  const meetingMap = new Map(meetings.map((m) => [m.id, m]));
  const runnerMap = new Map(runners.map((r) => [r.id, r]));
  const horseMap = new Map(horses.map((h) => [h.id, h]));

  function getLinkedData(tip: any) {
    const runner = tip.race_runner_id ? runnerMap.get(tip.race_runner_id) : null;
    const race = tip.race_id ? raceMap.get(tip.race_id) : null;
    const meeting = tip.meeting_id ? meetingMap.get(tip.meeting_id) : null;
    const horse = tip.horse_id ? horseMap.get(tip.horse_id) : null;

    return { runner, race, meeting, horse };
  }

  function getResultTone(pos: number | null) {
    if (!pos) return "slate";
    if (pos === 1) return "green";
    if (pos <= 3) return "blue";
    return "rose";
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Resulted Tips</h1>
          <a href="/" className="text-sm underline">
            Back
          </a>
        </div>

        <Panel className="bg-white/95">
          <div className="p-6 space-y-6 text-zinc-950">
            {tips.length === 0 && (
              <p className="text-sm text-zinc-500">
                No resulted tips yet.
              </p>
            )}

            {tips.map((tip) => {
              const { runner, race, meeting, horse } = getLinkedData(tip);

              const linkedLabel =
                race && meeting
                  ? `${meeting.meeting_name} R${race.race_number} ${race.race_name}`
                  : null;

              return (
                <div
                  key={tip.id}
                  className="rounded-2xl border p-5 bg-white shadow-sm"
                >
                  {/* HEADER */}
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">{tip.race}</p>
                      <h3 className="text-xl font-bold">{tip.horse}</h3>

                      {linkedLabel && (
                        <p className="text-sm text-zinc-600 mt-1">
                          {linkedLabel}
                        </p>
                      )}
                    </div>

                    <TipPill type={tip.type} />
                  </div>

                  {/* BADGES */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tip.finishing_position && (
                      <Badge tone={getResultTone(tip.finishing_position)}>
                        Fin {tip.finishing_position}
                      </Badge>
                    )}

                    {tip.successful === true && (
                      <Badge tone="green">Win</Badge>
                    )}
                    {tip.successful === false && (
                      <Badge tone="rose">Miss</Badge>
                    )}
                  </div>

                  {/* POST RACE COMMENT */}
                  {tip.result_comment && (
                    <div className="mt-4 p-3 rounded-xl bg-zinc-100">
                      <p className="text-sm">{tip.result_comment}</p>
                    </div>
                  )}

                  {/* 🔥 NEW: LINKED RUNNER DETAILS */}
                  {runner && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {runner.barrier && (
                        <Badge tone="blue">Barrier {runner.barrier}</Badge>
                      )}

                      {runner.starting_price && (
                        <Badge tone="green">
                          SP ${runner.starting_price}
                        </Badge>
                      )}

                      {!runner.starting_price && runner.market_price && (
                        <Badge tone="green">
                          ${runner.market_price}
                        </Badge>
                      )}

                      {runner.weight_kg && (
                        <Badge tone="amber">
                          {runner.weight_kg}kg
                        </Badge>
                      )}

                      {runner.form_last_6 && (
                        <Badge tone="slate">
                          {runner.form_last_6}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* JOCKEY / TRAINER */}
                  {runner && (
                    <div className="mt-4 text-sm text-zinc-600">
                      {runner.jockey_name && (
                        <p>Jockey: {runner.jockey_name}</p>
                      )}
                      {runner.trainer_name && (
                        <p>Trainer: {runner.trainer_name}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
