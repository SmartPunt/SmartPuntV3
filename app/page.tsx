import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminDashboard from "@/components/admin-dashboard";
import SubscriberDashboard from "@/components/subscriber-dashboard";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const suggestedTipsQuery = await supabase
    .from("suggested_tips")
    .select("*")
    .is("settled_at", null)
    .order("race_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const watchlistItemsQuery = await supabase
    .from("watchlist_items")
    .select("*")
    .order("created_at", { ascending: false });

  const longTermBetsQuery = await supabase
    .from("long_term_bets")
    .select("*")
    .order("race_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const publishedRacesQuery = await supabase
    .from("races")
    .select("*")
    .eq("status", "published")
    .order("meeting_id", { ascending: false })
    .order("race_number", { ascending: true });

  const publishedRunnersQuery = await supabase
    .from("race_runners")
    .select("*")
    .order("race_id", { ascending: true })
    .order("barrier", { ascending: true, nullsFirst: false });

  const horsesQuery = await supabase
    .from("horses")
    .select("*")
    .order("horse_name", { ascending: true });

  const meetingsQuery = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false })
    .order("meeting_name", { ascending: true });

  const suggestedTips = suggestedTipsQuery.data || [];
  const watchlistItems = watchlistItemsQuery.data || [];
  const longTermBets = longTermBetsQuery.data || [];
  const publishedRaces = publishedRacesQuery.data || [];
  const publishedRunners = publishedRunnersQuery.data || [];
  const horses = horsesQuery.data || [];
  const meetings = meetingsQuery.data || [];

  if (profile.role === "admin") {
    return (
      <AdminDashboard
        currentUser={profile}
        initialSuggestedTips={suggestedTips}
        initialWatchlistItems={watchlistItems}
        initialLongTermBets={longTermBets}
        initialPublishedRaces={publishedRaces}
        initialPublishedRunners={publishedRunners}
        initialHorses={horses}
        initialMeetings={meetings}
      />
    );
  }

  const activeSelectionsQuery = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const activeTipIds = (activeSelectionsQuery.data || []).map((row: any) => row.tip_id);

  return (
    <SubscriberDashboard
      currentUser={profile}
      initialSuggestedTips={suggestedTips}
      initialWatchlistItems={watchlistItems}
      initialLongTermBets={longTermBets}
      initialActiveTipIds={activeTipIds}
      initialPublishedRaces={publishedRaces}
      initialPublishedRunners={publishedRunners}
      initialHorses={horses}
      initialMeetings={meetings}
    />
  );
}
