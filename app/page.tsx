import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminDashboard from "@/components/admin-dashboard";
import AppEntryLoader from "@/components/app-entry-loader";

async function fetchAllRows<T>({
  pageSize = 1000,
  getPage,
}: {
  pageSize?: number;
  getPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>;
}) {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await getPage(from, to);

    if (error) {
      throw new Error(error.message || "Failed to fetch rows.");
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "staff_admin") {
    redirect("/current-races");
  }

  if (profile.role === "user") {
    redirect("/smartpunt-calculator-live-picks");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const [suggestedTips, watchlistItems, longTermBets, subscriberProfiles] =
    await Promise.all([
      fetchAllRows({
        getPage: async (from, to) => {
          const result = await supabase
            .from("suggested_tips")
            .select("*")
            .is("settled_at", null)
            .order("race_start_at", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      }),
      fetchAllRows({
        getPage: async (from, to) => {
          const result = await supabase
            .from("watchlist_items")
            .select("*")
            .order("created_at", { ascending: false })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      }),
      fetchAllRows({
        getPage: async (from, to) => {
          const result = await supabase
            .from("long_term_bets")
            .select("*")
            .order("race_start_at", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      }),
      fetchAllRows({
        getPage: async (from, to) => {
          const result = await supabase
            .from("profiles")
            .select("id, full_name, email, role, status, email_alerts_enabled, created_at")
            .eq("role", "user")
            .order("full_name", { ascending: true, nullsFirst: false })
            .order("email", { ascending: true, nullsFirst: false })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      }),
    ]);

  return (
    <AppEntryLoader>
      <AdminDashboard
        currentUser={profile}
        initialSuggestedTips={suggestedTips}
        initialWatchlistItems={watchlistItems}
        initialLongTermBets={longTermBets}
        initialPublishedRaces={[]}
        initialPublishedRunners={[]}
        initialHorses={[]}
        initialMeetings={[]}
        initialSubscriberProfiles={subscriberProfiles}
      />
    </AppEntryLoader>
  );
}
