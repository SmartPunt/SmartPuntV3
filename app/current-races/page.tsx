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

  if (profile.role !== "admin") {
    redirect("/");
  }

  try {
    const supabase = await createClient();

    const meetingsQuery = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false })
      .order("meeting_name", { ascending: true });

    const racesQuery = await supabase
      .from("races")
      .select("*")
      .eq("status", "published")
      .order("meeting_id", { ascending: false })
      .order("race_number", { ascending: true });

    const horsesQuery = await supabase
      .from("horses")
      .select("*")
      .order("horse_name", { ascending: true });

    const raceRunnersQuery = await supabase
      .from("race_runners")
      .select("*")
      .order("created_at", { ascending: false });

    const meetings = meetingsQuery.data || [];
    const races = racesQuery.data || [];
    const horses = horsesQuery.data || [];
    const raceRunners = raceRunnersQuery.data || [];

    return (
      <CurrentRacesPage
        currentUser={profile}
        initialMeetings={meetings}
        initialRaces={races}
        initialHorses={horses}
        initialRunners={raceRunners}
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
