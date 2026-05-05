import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import CurrentRacesPage from "@/components/admin-current-races";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  try {
    const supabase = await createClient();

    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("*")
      .eq("status", "published")
      .order("meeting_id", { ascending: false })
      .order("race_number", { ascending: true });

    if (racesError) {
      throw new Error(racesError.message || "Failed to load published races.");
    }

    const publishedRaces = races || [];
    const raceIds = publishedRaces.map((race) => race.id);
    const meetingIds = Array.from(
      new Set(publishedRaces.map((race) => race.meeting_id).filter(Boolean)),
    );

    const { data: meetings, error: meetingsError } =
      meetingIds.length > 0
        ? await supabase
            .from("meetings")
            .select("*")
            .in("id", meetingIds)
            .order("meeting_date", { ascending: false })
            .order("meeting_name", { ascending: true })
        : { data: [], error: null };

    if (meetingsError) {
      throw new Error(meetingsError.message || "Failed to load meetings.");
    }

    const { data: raceRunners, error: runnersError } =
      raceIds.length > 0
        ? await supabase
            .from("race_runners")
            .select("*")
            .in("race_id", raceIds)
            .order("race_id", { ascending: true })
            .order("barrier", { ascending: true, nullsFirst: false })
        : { data: [], error: null };

    if (runnersError) {
      throw new Error(runnersError.message || "Failed to load race runners.");
    }

    const horseIds = Array.from(
      new Set((raceRunners || []).map((runner) => runner.horse_id).filter(Boolean)),
    );

    const { data: horses, error: horsesError } =
      horseIds.length > 0
        ? await supabase
            .from("horses")
            .select("*")
            .in("id", horseIds)
            .order("horse_name", { ascending: true })
        : { data: [], error: null };

    if (horsesError) {
      throw new Error(horsesError.message || "Failed to load horses.");
    }

    return (
      <CurrentRacesPage
        currentUser={profile}
        initialMeetings={meetings || []}
        initialRaces={publishedRaces}
        initialHorses={horses || []}
        initialRunners={raceRunners || []}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error while loading Current Races.";

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[32px] border border-white/10 bg-black p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Current Races</h1>
              <Link
                href="/"
                className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Back to Dashboard
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-100 px-4 py-4 text-sm text-red-900">
              Current Races could not load from the server.
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-100 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Likely cause</p>
              <p className="mt-2">
                One of the Supabase queries or fields used by Current Races is failing on the server.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-200">
              <p className="font-semibold text-white">Server message</p>
              <p className="mt-2 break-words text-zinc-300">{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
