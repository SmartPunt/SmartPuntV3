import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppEntryLoader from "@/components/app-entry-loader";
import SubscriberDashboard from "@/components/subscriber-dashboard";
import { loadSubscriberDashboardData } from "@/lib/subscriber-dashboard-data";
import { syncVaultNotifications } from "@/lib/vault-matching";

async function fetchAllRows<T>({
  pageSize = 1000,
  getPage,
}: {
  pageSize?: number;
  getPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: any;
  }>;
}) {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await getPage(
      from,
      to,
    );

    if (error) {
      throw new Error(
        error.message || "Failed to fetch rows.",
      );
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

  const [
    dashboardData,
    watchlistItems,
    longTermBets,
    activeUserBetsQuery,
    resultedUserBetsQuery,
    liveFortuneFivesQuery,
  ] = await Promise.all([
    loadSubscriberDashboardData(),

    fetchAllRows<any>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("watchlist_items")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .range(from, to);

        return {
          data: result.data ?? [],
          error: result.error,
        };
      },
    }),

    fetchAllRows<any>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("long_term_bets")
          .select("*")
          .order("race_start_at", {
            ascending: true,
            nullsFirst: false,
          })
          .order("created_at", {
            ascending: false,
          })
          .range(from, to);

        return {
          data: result.data ?? [],
          error: result.error,
        };
      },
    }),

    supabase
      .from("user_bets")
      .select(
        "suggested_tip_id, calculator_tip_id, race_runner_id",
      )
      .eq("user_id", profile.id)
      .is("settled_at", null),

    supabase
      .from("user_bets")
      .select(
        "id, won, placed, bet_type, settled_at",
      )
      .eq("user_id", profile.id)
      .not("settled_at", "is", null),

    supabase
      .from("fortune_fives")
      .select(
        "id, title, description, published_date, status, settled_at",
      )
      .is("settled_at", null)
      .neq("status", "void")
      .order("published_date", {
        ascending: false,
      }),
  ]);

  if (activeUserBetsQuery.error) {
    throw new Error(
      activeUserBetsQuery.error.message,
    );
  }

  if (resultedUserBetsQuery.error) {
    throw new Error(
      resultedUserBetsQuery.error.message,
    );
  }

  if (liveFortuneFivesQuery.error) {
    throw new Error(
      liveFortuneFivesQuery.error.message,
    );
  }

  const vaultState =
    await syncVaultNotifications({
      userId: profile.id,
      liveData: {
        dayDates: {
          today: dashboardData.dayDates.today,
          tomorrow:
            dashboardData.dayDates.tomorrow,
        },
        currentMeetings:
          dashboardData.currentMeetings,
        currentRaces:
          dashboardData.currentRaces,
        currentRunners:
          dashboardData.currentRunners,
        horses: dashboardData.horses,
      },
    });

  const activeTipIds = (
    activeUserBetsQuery.data || []
  )
    .map(
      (row: any) => row.suggested_tip_id,
    )
    .filter(Boolean);

  const activeCalculatorTipIds = (
    activeUserBetsQuery.data || []
  )
    .map(
      (row: any) => row.calculator_tip_id,
    )
    .filter(Boolean);

  const activeCalculatorRunnerIds = (
    activeUserBetsQuery.data || []
  )
    .filter(
      (row: any) =>
        row.calculator_tip_id ||
        row.race_runner_id,
    )
    .map(
      (row: any) => row.race_runner_id,
    )
    .filter(Boolean);

  const activeUserBetCount = (
    activeUserBetsQuery.data || []
  ).length;

  return (
    <AppEntryLoader>
      <SubscriberDashboard
        currentUser={profile}
        initialSuggestedTips={
          dashboardData.officialTips
        }
        initialCalculatorTips={
          dashboardData.calculatorTips
        }
        initialWatchlistItems={
          watchlistItems
        }
        initialLongTermBets={
          longTermBets
        }
        initialActiveTipIds={
          activeTipIds
        }
        initialActiveCalculatorTipIds={
          activeCalculatorTipIds
        }
        initialActiveCalculatorRunnerIds={
          activeCalculatorRunnerIds
        }
        initialActiveUserBetCount={
          activeUserBetCount
        }
        initialPublishedRaces={
          dashboardData.currentRaces
        }
        initialPublishedRunners={
          dashboardData.currentRunners
        }
        initialHorses={
          dashboardData.horses
        }
        initialMeetings={
          dashboardData.currentMeetings
        }
        initialResultedUserBets={
          resultedUserBetsQuery.data ?? []
        }
        initialLiveFortuneFives={
          liveFortuneFivesQuery.data ?? []
        }
        initialVaultMatchCount={
          vaultState.liveMatchCount
        }
      />
    </AppEntryLoader>
  );
}
