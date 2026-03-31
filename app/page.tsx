import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminDashboard from "@/components/admin-dashboard";
import SubscriberDashboard from "@/components/subscriber-dashboard";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: tips } = await supabase
    .from("suggested_tips")
    .select("*")
    .order("race_start_at", { ascending: true, nullsFirst: false });

  const { data: watchlistItems } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: longTermBets } = await supabase
    .from("long_term_bets")
    .select("*")
    .order("created_at", { ascending: false });

  const liveTips = (tips || []).filter((tip: any) => typeof tip.successful !== "boolean");

  if (profile.role === "admin") {
    return (
      <AdminDashboard
        currentUser={profile}
        initialSuggestedTips={liveTips}
        initialWatchlistItems={watchlistItems || []}
        initialLongTermBets={longTermBets || []}
      />
    );
  }

  const { data: activeSelections } = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const activeTipIds = (activeSelections || []).map((row: any) => row.tip_id);

  return (
    <SubscriberDashboard
      currentUser={profile}
      initialSuggestedTips={liveTips}
      initialWatchlistItems={watchlistItems || []}
      initialLongTermBets={longTermBets || []}
      initialActiveTipIds={activeTipIds}
    />
  );
}
