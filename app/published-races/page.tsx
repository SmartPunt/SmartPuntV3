import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: races } = await supabase
    .from("races")
    .select("*")
    .eq("status", "published")
    .order("meeting_id", { ascending: false })
    .order("race_number", { ascending: true });

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*");

  const { data: runners } = await supabase
    .from("race_runners")
    .select("*");

  const { data: horses } = await supabase
    .from("horses")
    .select("*");

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white">
      <div className="mx-auto max-w-6xl p-4 lg:p-8">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Published Races</h1>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm"
          >
            Back
          </Link>
        </div>

        <div className="space-y-5">
          {(races || []).map((race) => {
            const meeting = meetings?.find(m => m.id === race.meeting_id);
            const field = runners?.filter(r => r.race_id === race.id) || [];

            return (
              <Panel key={race.id}>
                <div className="p-5 text-zinc-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-zinc-500">
                        {meeting?.meeting_name}
                      </p>
                      <h2 className="text-xl font-bold">
                        R{race.race_number} {race.race_name}
                      </h2>
                    </div>

                    <Badge tone="green">Live Field</Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    {field.map((runner) => {
                      const horse = horses?.find(h => h.id === runner.horse_id);

                      return (
                        <div
                          key={runner.id}
                          className="flex justify-between text-sm border-b border-zinc-200 pb-2"
                        >
                          <span>{horse?.horse_name}</span>
                          <span className="text-zinc-500">
                            Barrier {runner.barrier ?? "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
