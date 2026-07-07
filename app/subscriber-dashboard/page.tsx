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

function uniqueNumbers(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => Number(value)).filter(Boolean)),
  );
}

function chunk<T>(items: T[], size = 200) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchRowsByIds<T>({
  supabase,
  table,
  ids,
  orderBy,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  ids: number[];
  orderBy?: { column: string; ascending: boolean };
}) {
  const rows: T[] = [];

  for (const idChunk of chunk(uniqueNumbers(ids))) {
    let query = (supabase as any).from(table).select("*").in("id", idChunk);

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as T[]));
  }

  return rows;
}

async function fetchRunnersByRaceIds<T>({
  supabase,
  raceIds,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  raceIds: number[];
}) {
  const rows: T[] = [];

  for (const raceIdChunk of chunk(uniqueNumbers(raceIds))) {
    const { data, error } = await (supabase as any)
      .from("race_runners")
      .select("*")
      .in("race_id", raceIdChunk)
      .order("race_id", { ascending: true })
      .order("barrier", { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as T[]));
  }

  return rows;
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

  const [
    suggestedTips,
    calculatorTips,
    watchlistItems,
    longTermBets,
    activeUserBetsQuery,
    latestPublishedRaces,
  ] = await Promise.all([
    fetchAllRows<any>({
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

    fetchServiceRoleRows<{
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
    ),

    fetchAllRows<any>({
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

    fetchAllRows<any>({
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

    supabase
      .from("user_bets")
      .select("suggested_tip_id, calculator_tip_id")
      .eq("user_id", profile.id)
      .is("settled_at", null),

    supabase
      .from("races")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  if (activeUserBetsQuery.error) {
    throw new Error(activeUserBetsQuery.error.message);
  }

  if (latestPublishedRaces.error) {
    throw new Error(latestPublishedRaces.error.message);
  }

  const latestRaces = latestPublishedRaces.data ?? [];

  const raceIds = uniqueNumbers([
    ...latestRaces.map((race: any) => race.id),
    ...suggestedTips.map((tip: any) => tip.race_id),
    ...calculatorTips.map((tip: any) => tip.race_id),
  ]);

  const runnerIdsFromTips = uniqueNumbers([
    ...suggestedTips.map((tip: any) => tip.race_runner_id),
    ...calculatorTips.map((tip: any) => tip.race_runner_id),
  ]);

  const racesFromTips = await fetchRowsByIds<any>({
    supabase,
    table: "races",
    ids: raceIds,
    orderBy: { column: "race_number", ascending: true },
  });

  const raceMap = new Map<number, any>();

  [...latestRaces, ...racesFromTips].forEach((race: any) => {
    raceMap.set(Number(race.id), race);
  });

  const publishedRaces = Array.from(raceMap.values());

  const runnersForLatestRaces = raceIds.length
    ? await fetchRunnersByRaceIds<any>({
        supabase,
        raceIds,
      })
    : [];

  const linkedRunners = runnerIdsFromTips.length
    ? await fetchRowsByIds<any>({
        supabase,
        table: "race_runners",
        ids: runnerIdsFromTips,
      })
    : [];

  const runnerMap = new Map<number, any>();

  [...runnersForLatestRaces, ...linkedRunners].forEach((runner: any) => {
    runnerMap.set(Number(runner.id), runner);
  });

  const publishedRunners = Array.from(runnerMap.values());

  const meetingIds = uniqueNumbers([
    ...publishedRaces.map((race: any) => race.meeting_id),
    ...suggestedTips.map((tip: any) => tip.meeting_id),
  ]);

  const horseIds = uniqueNumbers([
    ...publishedRunners.map((runner: any) => runner.horse_id),
    ...suggestedTips.map((tip: any) => tip.horse_id),
    ...calculatorTips.map((tip: any) => tip.horse_id),
  ]);

  const [meetings, horses] = await Promise.all([
    fetchRowsByIds<any>({
      supabase,
      table: "meetings",
      ids: meetingIds,
      orderBy: { column: "meeting_date", ascending: false },
    }),

    fetchRowsByIds<any>({
      supabase,
      table: "horses",
      ids: horseIds,
      orderBy: { column: "horse_name", ascending: true },
    }),
  ]);

  const activeTipIds = (activeUserBetsQuery.data || [])
    .map((row: any) => row.suggested_tip_id)
    .filter(Boolean);

  const activeCalculatorTipIds = (activeUserBetsQuery.data || [])
    .map((row: any) => row.calculator_tip_id)
    .filter(Boolean);

  const activeUserBetCount = (activeUserBetsQuery.data || []).length;

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
