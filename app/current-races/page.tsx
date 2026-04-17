import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import CurrentRacesPage from "@/components/admin-current-races";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const meetingsQuery = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  const racesQuery = await supabase
    .from("races")
    .select("*")
    .eq("status", "published");

  const horsesQuery = await supabase
    .from("horses")
    .select("*");

  const runnersQuery = await supabase
    .from("race_runners")
    .select("*");

  return (
    <CurrentRacesPage
      currentUser={profile}
      initialMeetings={meetingsQuery.data || []}
      initialRaces={racesQuery.data || []}
      initialHorses={horsesQuery.data || []}
      initialRunners={runnersQuery.data || []}
    />
  );
}
