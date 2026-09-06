import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppEntryLoader from "@/components/app-entry-loader";
import SubscriberDashboard from "@/components/subscriber-dashboard";
import { loadSubscriberLivePicksData } from "@/lib/subscriber-live-picks-data";
import { syncVaultNotifications } from "@/lib/vault-matching";
import { getSubscriberLiveOpportunityCount } from "@/lib/subscriber-live-opportunity-count";


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

    const { data, error } = await getPage(from, to);

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
  const totalStartedAt = Date.now();

  function logStage(
    stage: string,
    startedAt: number,
    details?: Record<string, unknown>,
  ) {
    console.info("[SmartPunt Performance]", {
      area: "subscriber-dashboard-page",
      stage,
      durationMs: Date.now() - startedAt,
      ...details,
    });
  }

  const profileStartedAt = Date.now();
  const profile = await getCurrentProfile();

  logStage(
    "get current profile",
    profileStartedAt,
    {
      hasProfile: Boolean(profile),
      role: profile?.role || null,
    },
  );

  if (!profile) {
    redirect("/login");
  }

if (
  profile.status !== "active" ||
  !["user", "admin", "staff_admin"].includes(profile.role)
) {
  redirect("/");
}

  const clientStartedAt = Date.now();
  const supabase = await createClient();

  logStage(
    "create Supabase client",
    clientStartedAt,
  );

  const parallelQueriesStartedAt =
    Date.now();

  const [
    livePicksData,
    watchlistItems,
    longTermBets,
    activeUserBetsQuery,
    resultedUserBetsQuery,
    liveFortuneFivesQuery,
    subscriberNotificationsQuery,
    subscriberNotificationPreferencesQuery,
  ] = await Promise.all([
loadSubscriberLivePicksData({
  userId: profile.id,
  includeCalculatorPredictions: true,
}),

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

    supabase
      .from("subscriber_notifications")
      .select(
        "id, notification_type, title, message, link, race_id, meeting_id, is_read, created_at, read_at",
      )
      .eq("user_id", profile.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(30),

    supabase
      .from("subscriber_notification_preferences")
      .select(
        "maverick_tips_enabled, race_day_started_enabled, conditions_changed_enabled, vault_matches_today_enabled",
      )
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  logStage(
    "all parallel Dashboard queries",
    parallelQueriesStartedAt,
    {
      watchlistCount:
        watchlistItems.length,
      longTermBetCount:
        longTermBets.length,
      activeUserBetCount:
        activeUserBetsQuery.data?.length ?? 0,
      resultedUserBetCount:
        resultedUserBetsQuery.data?.length ??
        0,
      liveFortuneFiveCount:
        liveFortuneFivesQuery.data?.length ??
        0,
    },
  );

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

  if (subscriberNotificationsQuery.error) {
    throw new Error(
      subscriberNotificationsQuery.error.message,
    );
  }

  if (subscriberNotificationPreferencesQuery.error) {
    throw new Error(
      subscriberNotificationPreferencesQuery.error.message,
    );
  }

  const vaultSyncStartedAt = Date.now();

  /*
   * SUBSCRIBER PERFORMANCE BOUNDARY
   *
   * Vault matching and notification creation belong to
   * the authoritative admin/event-side workflow.
   *
   * The subscriber Dashboard must only READ matches that
   * have already been stored. Never run Vault rule
   * evaluation or database writes from this request.
   */
  const vaultState =
    await syncVaultNotifications({
      userId: profile.id,
      liveData: {
        dayDates: {
          today:
            livePicksData.dayDates.today,
          tomorrow:
            livePicksData.dayDates.tomorrow,
        },
        currentMeetings:
          livePicksData.currentMeetings,
        currentRaces:
          livePicksData.currentRaces,
        currentRunners:
          livePicksData.currentRunners,
        horses:
          livePicksData.horses,
      },
      performSync: false,
    });

  logStage(
    "Vault notification read",
    vaultSyncStartedAt,
    {
      liveMatchCount:
        vaultState.liveMatchCount,
    },
  );

const liveVaultRaceIds = new Set(
  livePicksData.currentRaces
    .filter((race) => {
      if (race.status !== "published") {
        return false;
      }

      const meeting =
        livePicksData.currentMeetings.find(
          (item) =>
            Number(item.id) ===
            Number(race.meeting_id),
        );

      return (
        meeting?.meeting_date ===
        livePicksData.dayDates.today
      );
    })
    .map((race) => Number(race.id)),
);

const liveVaultMatches =
  vaultState.matches.filter((match) =>
    liveVaultRaceIds.has(
      Number(match.raceId),
    ),
  );

const liveVaultMatchCount =
  liveVaultMatches.length;

const liveOpportunityCount =
  getSubscriberLiveOpportunityCount({
    meetingDate:
      livePicksData.dayDates.today,
    races:
      livePicksData.races,
    runners:
      livePicksData.runners,
    horses:
      livePicksData.horses,
    meetings:
      livePicksData.meetings,
    calculatorPredictions:
      livePicksData.calculatorPredictions,
    officialTips:
      livePicksData.officialTips,
    vaultMatches:
      liveVaultMatches,
  });

const transformStartedAt = Date.now();

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

  logStage(
    "prepare Dashboard props",
    transformStartedAt,
    {
      activeTipIdCount:
        activeTipIds.length,
      activeCalculatorTipIdCount:
        activeCalculatorTipIds.length,
      activeCalculatorRunnerIdCount:
        activeCalculatorRunnerIds.length,
    },
  );

  logStage(
    "TOTAL Dashboard server load",
    totalStartedAt,
    {
      currentRaceCount:
        livePicksData.currentRaces.length,
      currentRunnerCount:
        livePicksData.currentRunners.length,
      scoringRunnerCount:
        livePicksData.runners.length,
      scoringRaceCount:
        livePicksData.races.length,
    },
  );

  return (
    <AppEntryLoader>
      <SubscriberDashboard
        currentUser={profile}
        initialSuggestedTips={
          livePicksData.officialTips
        }
        initialCalculatorTips={
          livePicksData.calculatorTips
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
          livePicksData.currentRaces
        }
        initialPublishedRunners={
          livePicksData.currentRunners
        }
        initialScoringRaces={
  livePicksData.races
}
initialScoringRunners={
  livePicksData.runners
}
initialJockeyProfiles={
  livePicksData.jockeyProfiles
}
        initialHorses={
          livePicksData.horses
        }
        initialMeetings={
          livePicksData.meetings
        }
        initialResultedUserBets={
          resultedUserBetsQuery.data ?? []
        }
        initialLiveFortuneFives={
          liveFortuneFivesQuery.data ?? []
        }
        initialVaultMatchCount={
          liveVaultMatchCount
        }
        initialLiveOpportunityCount={
          liveOpportunityCount
        }
        initialSubscriberNotifications={
          subscriberNotificationsQuery.data ?? []
        }
        initialSubscriberNotificationPreferences={
          subscriberNotificationPreferencesQuery.data ?? null
        }
      />
    </AppEntryLoader>
  );
}
