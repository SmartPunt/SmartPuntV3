import { createClient } from "@/lib/supabase/server";
import { getPerthDate } from "@/lib/subscriber-live-picks-data";

export type SubscriberDashboardData = {
  dayDates: {
    today: string;
    tomorrow: string;
  };
  currentMeetings: any[];
  currentRaces: any[];
  currentRaceIds: number[];
  currentRunners: any[];
  horses: any[];
  calculatorTips: any[];
  officialTips: any[];
};

function uniqueNumbers(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0,
        ),
    ),
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
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  ids: number[];
}) {
  const rows: T[] = [];

  for (const idChunk of chunk(uniqueNumbers(ids))) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("id", idChunk);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as T[]));
  }

  return rows;
}

async function fetchRowsByRaceIds<T>({
  supabase,
  table,
  raceIds,
  orders = [],
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  raceIds: number[];
  orders?: Array<{
    column: string;
    ascending: boolean;
  }>;
}) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (const raceIdChunk of chunk(uniqueNumbers(raceIds))) {
    let from = 0;

    while (true) {
      let query: any = supabase
        .from(table)
        .select("*")
        .in("race_id", raceIdChunk);

      orders.forEach((order) => {
        query = query.order(order.column, {
          ascending: order.ascending,
        });
      });

      const { data, error } = await query.range(
        from,
        from + pageSize - 1,
      );

      if (error) {
        throw new Error(error.message);
      }

      const pageRows = (data ?? []) as T[];

      rows.push(...pageRows);

      if (pageRows.length < pageSize) {
        break;
      }

      from += pageSize;
    }
  }

  return rows;
}

function getServiceRoleConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration in environment variables.",
    );
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

async function fetchServiceRoleRows<T>(
  tablePath: string,
) {
  const allRows: T[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { supabaseUrl, headers } =
      getServiceRoleConfig();

    const separator = tablePath.includes("?")
      ? "&"
      : "?";

    const path =
      `${tablePath}${separator}` +
      `limit=${pageSize}&offset=${offset}`;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        text ||
          `Service role request failed for ${tablePath}`,
      );
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

async function fetchServiceRoleRowsByRaceIds<T>({
  table,
  select,
  raceIds,
  order,
}: {
  table: string;
  select: string;
  raceIds: number[];
  order?: string;
}) {
  const rows: T[] = [];

  for (const raceIdChunk of chunk(
    uniqueNumbers(raceIds),
  )) {
    const orderQuery = order
      ? `&order=${order}`
      : "";

    rows.push(
      ...(await fetchServiceRoleRows<T>(
        `${table}?select=${select}` +
          `&race_id=in.(${raceIdChunk.join(",")})` +
          orderQuery,
      )),
    );
  }

  return rows;
}

export async function loadSubscriberDashboardData(): Promise<SubscriberDashboardData> {
  const supabase = await createClient();

  const today = getPerthDate(0);
  const tomorrow = getPerthDate(1);

  const { data: meetingRows, error: meetingError } =
    await supabase
      .from("meetings")
      .select("*")
      .in("meeting_date", [today, tomorrow])
      .order("meeting_date", {
        ascending: true,
      })
      .order("meeting_name", {
        ascending: true,
      });

  if (meetingError) {
    throw new Error(meetingError.message);
  }

  const currentMeetings = meetingRows ?? [];

  const currentMeetingIds = uniqueNumbers(
    currentMeetings.map(
      (meeting: any) => meeting.id,
    ),
  );

  let currentRaces: any[] = [];

  if (currentMeetingIds.length > 0) {
    for (const meetingIdChunk of chunk(
      currentMeetingIds,
    )) {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .in("meeting_id", meetingIdChunk)
        .in("status", ["published", "closed"])
        .order("meeting_id", {
          ascending: true,
        })
        .order("race_number", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      currentRaces.push(...(data ?? []));
    }
  }

  const currentRaceIds = uniqueNumbers(
    currentRaces.map((race) => race.id),
  );

  const currentRunners =
    currentRaceIds.length > 0
      ? await fetchRowsByRaceIds<any>({
          supabase,
          table: "race_runners",
          raceIds: currentRaceIds,
          orders: [
            {
              column: "race_id",
              ascending: true,
            },
            {
              column: "barrier",
              ascending: true,
            },
            {
              column: "id",
              ascending: true,
            },
          ],
        })
      : [];

  const activeHorseIds = uniqueNumbers(
    currentRunners.map(
      (runner) => runner.horse_id,
    ),
  );

  const horses =
    activeHorseIds.length > 0
      ? await fetchRowsByIds<any>({
          supabase,
          table: "horses",
          ids: activeHorseIds,
        })
      : [];

  const [calculatorTips, officialTips] =
    await Promise.all([
      currentRaceIds.length > 0
        ? fetchServiceRoleRowsByRaceIds<any>({
            table:
              "smartpunt_calculator_tips",
            select: "*",
            raceIds: currentRaceIds,
            order: "published_at.desc",
          })
        : Promise.resolve([]),

      currentRaceIds.length > 0
        ? fetchServiceRoleRowsByRaceIds<any>({
            table: "suggested_tips",
            select: "*",
            raceIds: currentRaceIds,
            order: "created_at.desc",
          })
        : Promise.resolve([]),
    ]);

  return {
    dayDates: {
      today,
      tomorrow,
    },
    currentMeetings,
    currentRaces,
    currentRaceIds,
    currentRunners,
    horses,
    calculatorTips,
    officialTips,
  };
}
