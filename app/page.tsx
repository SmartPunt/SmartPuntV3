import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import LoginPage from "@/components/login-page";
import SubscriberDashboard from "@/components/subscriber-dashboard";
import AdminDashboard from "@/components/admin-dashboard";

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const profile = await getCurrentProfile();

  if (!auth.user || !profile) {
    return <LoginPage />;
  }

  const [{ data: suggestedTips }, { data: watchlistItems }, { data: longTermBets }] = await Promise.all([
    supabase.from("suggested_tips").select("*").order("created_at", { ascending: false }),
    supabase.from("watchlist_items").select("*").order("created_at", { ascending: false }),
    supabase.from("long_term_bets").select("*").order("created_at", { ascending: false }),
  ]);

  if (profile.role === "admin") {
    return (
      <AdminDashboard
        currentUser={profile}
        initialSuggestedTips={suggestedTips ?? []}
        initialWatchlistItems={watchlistItems ?? []}
        initialLongTermBets={longTermBets ?? []}
      />
    );
  }

  return (
    <SubscriberDashboard
      currentUser={profile}
      initialSuggestedTips={suggestedTips ?? []}
      initialWatchlistItems={watchlistItems ?? []}
      initialLongTermBets={longTermBets ?? []}
    />
  );
}
