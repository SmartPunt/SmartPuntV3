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

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function calculateScore(runner: Runner) {
  let score = 50;

  if (runner.market_price !== null && runner.market_price !== undefined) {
    const price = Number(runner.market_price);

    if (price <= 2) score += 25;
    else if (price <= 4) score += 15;
    else if (price <= 8) score += 5;
    else score -= 5;
  }

  if (runner.barrier !== null && runner.barrier !== undefined) {
    const barrier = Number(runner.barrier);

    if (barrier <= 4) score += 10;
    else if (barrier <= 8) score += 5;
    else score -= 5;
  }

  if (runner.form_last_3) {
    const form = runner.form_last_3
      .replace(/[^0-9]/g, "")
      .split("")
      .map(Number)
      .filter((num) => !Number.isNaN(num));

    form.forEach((pos) => {
      if (pos === 1) score += 5;
      else if (pos <= 3) score += 2;
      else if (pos >= 8) score -= 2;
    });
  }

  return clamp(score);
}

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
                  <Badge tone="green">SmartPunt ratings live</Badge>
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

              const raceRunners = runnerRows
                .filter((runner) => runner.race_id === race.id)
                .map((runner) => ({
                  ...runner,
                  score: calculateScore(runner),
                }))
                .sort((a, b) => b.score - a.score);

              const topScore = raceRunners[0]?.score ?? null;

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
                        raceRunners.map((runner, index) => {
                          const horse =
                            horseRows.find((item) => item.id === runner.horse_id) || null;

                          const isTopRated = topScore !== null && runner.score === topScore && index === 0;

                          return (
                            <div
                              key={runner.id}
                              className={`rounded-2xl border p-4 ${
                                isTopRated
                                  ? "border-amber-300/50 bg-amber-50"
                                  : "border-zinc-200 bg-zinc-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-zinc-950">
                                      {horse?.horse_name || "Unknown horse"}
                                    </p>
                                    {isTopRated ? <Badge tone="amber">Top Rated</Badge> : null}
                                  </div>

                                  <p className="mt-1 text-sm text-zinc-500">
                                    Jockey: {runner.jockey_name || "—"}
                                  </p>

                                  <div className="mt-3 flex items-center gap-2">
                                    <span className="text-2xl font-bold text-amber-700">
                                      {runner.score}%
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                      SmartPunt Rating
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-end">
                                  <Badge tone="slate">Rank #{index + 1}</Badge>
                                  {runner.barrier !== null && runner.barrier !== undefined ? (
                                    <Badge tone="amber">Barrier {runner.barrier}</Badge>
                                  ) : null}
                                  {runner.market_price !== null && runner.market_price !== undefined ? (
                                    <Badge tone="green">${runner.market_price}</Badge>
                                  ) : null}
                                </div>
                              </div>

                              {runner.form_last_3 ? (
                                <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                    Recent snapshot used in rating
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                                    {runner.form_last_3}
                                  </p>
                                </div>
                              ) : null}
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
                  Once the head tipper publishes race fields, they’ll appear here.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
