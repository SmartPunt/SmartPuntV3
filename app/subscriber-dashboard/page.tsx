import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
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

function getServiceRoleConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration in environment variables.");
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
}

async function fetchServiceRoleRows<T>(tablePath: string) {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers } = getServiceRoleConfig();
    const separator = tablePath.includes("?") ? "&" : "?";
    const path = `${tablePath}${separator}limit=${pageSize}&offset=${offset}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Service role request failed for ${tablePath}`);
    }

    const rows = (await response.json()) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

export default async function SubscriberDashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/");
  }

  if (profile.role === "staff_admin") {
    redirect("/current-races");
  }

  if (profile.role !== "user") {
    redirect("/");
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

  const calculatorTips = await fetchServiceRoleRows<{
    id: number;
    race_id: number | null;
    race_runner_id: number | null;
    horse_id: number | null;
    race: string | null;
    horse: string | null;
    bet_type: string | null;
    confidence: string | null;
    score: number | string | null;
    win_percent: number | string | null;
    place_percent: number | string | null;
    race_gap: number | string | null;
    race_confidence_percent: number | string | null;
    race_confidence_tier: string | null;
    status: string | null;
    finishing_position: number | null;
    won: boolean | null;
    placed: boolean | null;
    settled_at: string | null;
    published_at: string | null;
  }>(
    "smartpunt_calculator_tips?select=*&settled_at=is.null&status=eq.active&order=published_at.desc",
  );

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

  const subscriberProfiles =
    profile.role === "admin"
      ? await fetchAllRows({
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
        })
      : [];

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
          initialSubscriberProfiles={subscriberProfiles}
        />
      </AppEntryLoader>
    );
  }

const activeUserBetsQuery = await supabase
  .from("user_bets")
  .select("suggested_tip_id, calculator_tip_id")
  .eq("user_id", profile.id)
  .is("settled_at", null);

const activeTipIds = (activeUserBetsQuery.data || [])
  .map((row: any) => row.suggested_tip_id)
  .filter(Boolean);

const activeCalculatorTipIds = (activeUserBetsQuery.data || [])
  .map((row: any) => row.calculator_tip_id)
  .filter(Boolean);
const activeUserBetCount =
  (activeUserBetsQuery.data || []).length;
  return (
    <AppEntryLoader>
      <SubscriberDashboard
        currentUser={profile}
        initialSuggestedTips={suggestedTips}
        initialCalculatorTips={calculatorTips}
        initialWatchlistItems={watchlistItems}
        initialLongTermBets={longTermBets}
        initialActiveTipIds={activeTipIds}
        initialActiveCalculatorTipIds={activeCalculatorTipIds}
        initialActiveUserBetCount={activeUserBetCount}
        initialPublishedRaces={publishedRaces}
        initialPublishedRunners={publishedRunners}
        initialHorses={horses}
        initialMeetings={meetings}
      />
    </AppEntryLoader>
  );
}
