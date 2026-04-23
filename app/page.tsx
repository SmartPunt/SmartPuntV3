import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminDashboard from "@/components/admin-dashboard";
import SubscriberDashboard from "@/components/subscriber-dashboard";
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

  const supabase = await createClient();

  const suggestedTips = await fetchAllRows({
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
  });

  const watchlistItems = await fetchAllRows({
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
  });

  const longTermBets = await fetchAllRows({
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
  });

  const publishedRaces = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("races")
        .select("*")
        .eq("status", "published")
        .order("meeting_id", { ascending: false })
        .order("race_number", { ascending: true })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const publishedRunners = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("race_runners")
        .select("*")
        .order("race_id", { ascending: true })
        .order("barrier", { ascending: true, nullsFirst: false })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const horses = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("horses")
        .select("*")
        .order("horse_name", { ascending: true })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  const meetings = await fetchAllRows({
    getPage: async (from, to) => {
      const result = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false })
        .order("meeting_name", { ascending: true })
        .range(from, to);

      return {
        data: result.data ?? [],
        error: result.error,
      };
    },
  });

  if (profile.role === "admin") {
    return (
      <AppEntryLoader>
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
      </AppEntryLoader>
    );
  }

  const activeSelectionsQuery = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const activeTipIds = (activeSelectionsQuery.data || []).map((row: any) => row.tip_id);

  return (
    <AppEntryLoader>
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
    </AppEntryLoader>
  );
}
