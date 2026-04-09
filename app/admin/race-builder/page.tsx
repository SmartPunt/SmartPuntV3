import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import RaceBuilderPage from "@/components/admin-race-builder";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const [{ data: meetings }, { data: races }, { data: horses }, { data: raceRunners }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false })
        .order("meeting_name", { ascending: true }),
      supabase
        .from("races")
        .select("*")
        .order("meeting_id", { ascending: false })
        .order("race_number", { ascending: true }),
      supabase
        .from("horses")
        .select("*")
        .order("horse_name", { ascending: true }),
      supabase
        .from("race_runners")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <RaceBuilderPage
      currentUser={profile}
      initialMeetings={meetings || []}
      initialRaces={races || []}
      initialHorses={horses || []}
      initialRunners={raceRunners || []}
    />
  );
}
