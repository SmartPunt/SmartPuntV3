import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  form_last_3: string | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  created_at: string;
  updated_at: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export default async function PublishedRacesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: races, error: racesError } = await supabase
    .from("races")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("race_number", { ascending: true });

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  const { data: runners, error: runnersError } = await supabase
    .from("race_runners")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: horses, error: horsesError } = await supabase
    .from("horses")
    .select("*")
    .order("horse_name", { ascending: true });

  const publishedRaces: Race[] = races || [];
  const meetingRows: Meeting[] = meetings || [];
  const runnerRows: Runner[] = runners || [];
  const horseRows: Horse[] = horses || [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_20%),linear-gradient(180deg,#111315_0%,#18181b_50%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="relative overflow-hidden rounded-[32px] bg-black shadow-xl border border-white/10 min-h-[180px] lg:min-h-[260px]">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="absolute left-1/2 top-[45%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-95 pointer-events-none select-none sm:w-[400px] lg:top-[42%] lg:w-[943px]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.46)_100%)]" />

          <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between p-4 lg:min-h-[260px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="green">Published race fields</Badge>

              <div className="ml-auto flex flex-col items-end gap-2 lg:gap-3">
                <Link
                  href="/"
                  className="w-fit rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 lg:px-4 lg:py-2.5 lg:text-sm"
                >
                  Back to Live Tips
                </Link>
              </div>
            </div>

            <div className="mt-auto">
              <div className="rounded-2xl bg-black/18 px-4 py-3 backdrop-blur-[1px] lg:px-5 lg:py-4">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-white lg:gap-x-5">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-4xl">
                    Race Fields
                  </h1>
                  <p className="text-sm text-zinc-200 lg:text-base">
                    View published races and loaded fields in one place.
                  </p>
                  <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                    Logged in as {profile.full_name || profile.email}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="amber">{publishedRaces.length} published races</Badge>
                  <Badge tone="blue">{runnerRows.length} visible runners</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(racesError || meetingsError || runnersError || horsesError) ? (
          <Panel className="mt-6 bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Data check</h2>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                {racesError ? <p>Races error: {racesError.message}</p> : null}
                {meetingsError ? <p>Meetings error: {meetingsError.message}</p> : null}
                {runnersError ? <p>Runners error: {runnersError.message}</p> : null}
                {horsesError ? <p>Horses error: {horsesError.message}</p> : null}
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="mt-6 space-y-6">
          {publishedRaces.length > 0 ? (
            publishedRaces.map((race) => {
              const meeting =
                meetingRows.find((item) => item.id === race.meeting_id) || null;
              const raceRunners = runnerRows.filter((runner) => runner.race_id === race.id);

              return (
                <Panel key={race.id} className="bg-white/95">
                  <div className="p-6 text-zinc-950">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-500">
                          {meeting?.meeting_name || "Meeting"}
                          {meeting?.meeting_date ? ` · ${meeting.meeting_date}` : ""}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold">
                          R{race.race_number} {race.race_name}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-600">
                          {race.distance_m ? `${race.distance_m}m` : "Distance TBC"}
                          {meeting?.track_condition ? ` · ${meeting.track_condition}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">Published</Badge>
                        <Badge tone="blue">{raceRunners.length} runners</Badge>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {raceRunners.length > 0 ? (
                        raceRunners.map((runner) => {
                          const horse =
                            horseRows.find((item) => item.id === runner.horse_id) || null;

                          return (
                            <div
                              key={runner.id}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold text-zinc-950">
                                    {horse?.horse_name || "Unknown horse"}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-500">
                                    Jockey: {runner.jockey_name || "—"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {runner.barrier !== null && runner.barrier !== undefined ? (
                                    <Badge tone="amber">Barrier {runner.barrier}</Badge>
                                  ) : null}
                                  {runner.market_price !== null && runner.market_price !== undefined ? (
                                    <Badge tone="green">${runner.market_price}</Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                          This race is published, but no runners are visible yet.
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })
          ) : (
            <Panel className="bg-white/95">
              <div className="p-6 text-zinc-950">
                <h2 className="text-xl font-semibold">No published races yet</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  If you have just published one and this still shows empty, the problem is almost certainly data access rather than page layout.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
