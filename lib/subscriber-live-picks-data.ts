import { createClient } from "@/lib/supabase/server";

export type SubscriberLivePicksData = {
  dayDates: {
    yesterday: string;
    today: string;
    tomorrow: string;
  };
  currentMeetings: any[];
  currentRaces: any[];
  currentRaceIds: number[];
  currentRunners: any[];
  races: any[];
  runners: any[];
  horses: any[];
  meetings: any[];
  jockeyProfiles: any[];
  calculatorTips: any[];
  officialTips: any[];
  activeUserBets: any[];
};

export function getPerthDate(offsetDays = 0) {
  const perthParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(perthParts.find((part) => part.type === "year")?.value);
  const month = Number(perthParts.find((part) => part.type === "month")?.value);
  const day = Number(perthParts.find((part) => part.type === "day")?.value);

  const perthCalendarDate = new Date(
    Date.UTC(year, month - 1, day + offsetDays, 12),
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(perthCalendarDate);
}

function uniqueNumbers(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => Number(value)).filter(Boolean)),
  );
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
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

async function fetchRowsByNumberColumn<T>({
  supabase,
  table,
  column,
  values,
  orders = [],
  notNullColumns = [],
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  column: string;
  values: number[];
  orders?: { column: string; ascending: boolean }[];
  notNullColumns?: string[];
}) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (const valueChunk of chunk(uniqueNumbers(values))) {
    let from = 0;

    while (true) {
      let query: any = supabase
        .from(table)
        .select("*")
        .in(column, valueChunk);

      notNullColumns.forEach((notNullColumn) => {
        query = query.not(notNullColumn, "is", null);
      });

      orders.forEach((order) => {
        query = query.order(order.column, { ascending: order.ascending });
      });

      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      const pageRows = (data ?? []) as T[];
      rows.push(...pageRows);

      if (pageRows.length < pageSize) break;

      from += pageSize;
    }
  }

  return rows;
}

function getServiceRoleConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    if (rows.length < pageSize) break;

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

  for (const raceIdChunk of chunk(uniqueNumbers(raceIds))) {
    const orderQuery = order ? `&order=${order}` : "";

    rows.push(
      ...(await fetchServiceRoleRows<T>(
        `${table}?select=${select}&race_id=in.(${raceIdChunk.join(",")})${orderQuery}`,
      )),
    );
  }

  return rows;
}

export async function loadSubscriberLivePicksData({
  userId,
}: {
  userId: string;
}): Promise<SubscriberLivePicksData> {
  const totalStartedAt = Date.now();

  function logStage(
    stage: string,
    startedAt: number,
    details?: Record<string, unknown>,
  ) {
    console.info("[SmartPunt Performance]", {
      area: "subscriber-live-picks-loader",
      stage,
      durationMs: Date.now() - startedAt,
      ...details,
    });
  }

  const clientStartedAt = Date.now();
  const supabase = await createClient();

  logStage("create Supabase client", clientStartedAt);

  const dateStartedAt = Date.now();

  const yesterday = getPerthDate(-1);
  const today = getPerthDate(0);
  const tomorrow = getPerthDate(1);
  const loadedMeetingDates = [
    yesterday,
    today,
    tomorrow,
  ];

  logStage("build Perth dates", dateStartedAt, {
    yesterday,
    today,
    tomorrow,
  });

  const currentMeetingsStartedAt = Date.now();

  const {
    data: currentMeetingsData,
    error: meetingsError,
  } = await supabase
    .from("meetings")
    .select("*")
    .in("meeting_date", loadedMeetingDates)
    .order("meeting_date", {
      ascending: true,
    })
    .order("meeting_name", {
      ascending: true,
    });

  if (meetingsError) {
    throw new Error(meetingsError.message);
  }

  const currentMeetings =
    currentMeetingsData ?? [];

  const currentMeetingIds = uniqueNumbers(
    currentMeetings.map(
      (meeting: any) => meeting.id,
    ),
  );

  logStage(
    "load current meetings",
    currentMeetingsStartedAt,
    {
      rowCount: currentMeetings.length,
      meetingIdCount:
        currentMeetingIds.length,
    },
  );

  const currentRacesStartedAt = Date.now();

  let currentRaces: any[] = [];

  if (currentMeetingIds.length) {
    for (const meetingIdChunk of chunk(
      currentMeetingIds,
    )) {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .in("status", [
          "published",
          "closed",
        ])
        .in("meeting_id", meetingIdChunk)
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

  logStage(
    "load current races",
    currentRacesStartedAt,
    {
      rowCount: currentRaces.length,
      raceIdCount: currentRaceIds.length,
    },
  );

  const currentRunnersStartedAt = Date.now();

  const currentRunners =
    currentRaceIds.length
      ? await fetchRowsByNumberColumn<any>({
          supabase,
          table: "race_runners",
          column: "race_id",
          values: currentRaceIds,
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

  logStage(
    "load current runners",
    currentRunnersStartedAt,
    {
      rowCount: currentRunners.length,
    },
  );

  const activeHorseIds = uniqueNumbers(
    currentRunners.map(
      (runner) => runner.horse_id,
    ),
  );

  const horsesStartedAt = Date.now();

  const horses = await fetchRowsByIds<any>({
    supabase,
    table: "horses",
    ids: activeHorseIds,
  });

  logStage(
    "load active horses",
    horsesStartedAt,
    {
      rowCount: horses.length,
      horseIdCount: activeHorseIds.length,
    },
  );

  const historicalRunnersStartedAt =
    Date.now();

  const resultedHistoricalRunners =
    activeHorseIds.length
      ? await fetchRowsByNumberColumn<any>({
          supabase,
          table: "race_runners",
          column: "horse_id",
          values: activeHorseIds,
          notNullColumns: [
            "finishing_position",
          ],
          orders: [
            {
              column: "id",
              ascending: true,
            },
          ],
        })
      : [];

  logStage(
    "load historical resulted runners",
    historicalRunnersStartedAt,
    {
      rowCount:
        resultedHistoricalRunners.length,
      horseIdCount: activeHorseIds.length,
    },
  );

  const runnerMapStartedAt = Date.now();

  const runnerMap = new Map<number, any>();

  [
    ...resultedHistoricalRunners,
    ...currentRunners,
  ].forEach((runner) => {
    runnerMap.set(
      Number(runner.id),
      runner,
    );
  });

  const runners = Array.from(
    runnerMap.values(),
  );

  logStage(
    "build combined runner map",
    runnerMapStartedAt,
    {
      rowCount: runners.length,
    },
  );

  const requiredRaceIds = uniqueNumbers([
    ...currentRaceIds,
    ...resultedHistoricalRunners.map(
      (runner) => runner.race_id,
    ),
  ]);

  const historicalRacesStartedAt =
    Date.now();

  const historicalAndCurrentRaces =
    await fetchRowsByIds<any>({
      supabase,
      table: "races",
      ids: requiredRaceIds,
    });

  logStage(
    "load historical and current races",
    historicalRacesStartedAt,
    {
      rowCount:
        historicalAndCurrentRaces.length,
      requiredRaceIdCount:
        requiredRaceIds.length,
    },
  );

  const raceMapStartedAt = Date.now();

  const raceMap = new Map<number, any>();

  [
    ...historicalAndCurrentRaces,
    ...currentRaces,
  ].forEach((race) => {
    raceMap.set(Number(race.id), race);
  });

  const races = Array.from(
    raceMap.values(),
  );

  logStage(
    "build combined race map",
    raceMapStartedAt,
    {
      rowCount: races.length,
    },
  );

  const requiredMeetingIds =
    uniqueNumbers([
      ...currentMeetingIds,
      ...races.map(
        (race) => race.meeting_id,
      ),
    ]);

  const historicalMeetingsStartedAt =
    Date.now();

  const historicalAndCurrentMeetings =
    await fetchRowsByIds<any>({
      supabase,
      table: "meetings",
      ids: requiredMeetingIds,
    });

  logStage(
    "load historical and current meetings",
    historicalMeetingsStartedAt,
    {
      rowCount:
        historicalAndCurrentMeetings.length,
      requiredMeetingIdCount:
        requiredMeetingIds.length,
    },
  );

  const meetingMapStartedAt = Date.now();

  const meetingMap = new Map<number, any>();

  [
    ...historicalAndCurrentMeetings,
    ...currentMeetings,
  ].forEach((meeting) => {
    meetingMap.set(
      Number(meeting.id),
      meeting,
    );
  });

  const meetings = Array.from(
    meetingMap.values(),
  );

  logStage(
    "build combined meeting map",
    meetingMapStartedAt,
    {
      rowCount: meetings.length,
    },
  );

  const activeJockeyNames =
    uniqueStrings(
      currentRunners.map(
        (runner) => runner.jockey_name,
      ),
    );

  const jockeyProfilesStartedAt =
    Date.now();

  let jockeyProfiles: any[] = [];

  if (activeJockeyNames.length) {
    for (const nameChunk of chunk(
      activeJockeyNames,
    )) {
      const { data, error } =
        await supabase
          .from("jockey_profiles")
          .select("*")
          .in("jockey_name", nameChunk);

      if (error) {
        throw new Error(error.message);
      }

      jockeyProfiles.push(
        ...(data ?? []),
      );
    }
  }

  logStage(
    "load jockey profiles",
    jockeyProfilesStartedAt,
    {
      rowCount: jockeyProfiles.length,
      jockeyNameCount:
        activeJockeyNames.length,
    },
  );

  const calculatorTipsStartedAt =
    Date.now();

  const calculatorTips =
    currentRaceIds.length
      ? await fetchServiceRoleRowsByRaceIds<any>(
          {
            table:
              "smartpunt_calculator_tips",
            select: "*",
            raceIds: currentRaceIds,
            order: "published_at.desc",
          },
        )
      : [];

  logStage(
    "load calculator tips",
    calculatorTipsStartedAt,
    {
      rowCount: calculatorTips.length,
    },
  );

  const officialTipsStartedAt =
    Date.now();

  const officialTips =
    currentRaceIds.length
      ? await fetchServiceRoleRowsByRaceIds<any>(
          {
            table: "suggested_tips",
            select: "*",
            raceIds: currentRaceIds,
            order: "created_at.desc",
          },
        )
      : [];

  logStage(
    "load official tips",
    officialTipsStartedAt,
    {
      rowCount: officialTips.length,
    },
  );

  const activeUserBetsStartedAt =
    Date.now();

  const activeUserBets =
    currentRaceIds.length
      ? await fetchServiceRoleRowsByRaceIds<any>(
          {
            table: "user_bets",
            select: "*",
            raceIds: currentRaceIds,
            order: "created_at.desc",
          },
        ).then((rows) =>
          rows.filter(
            (row) =>
              String(row.user_id || "") ===
                String(userId || "") &&
              !row.settled_at,
          ),
        )
      : [];

  logStage(
    "load and filter active user bets",
    activeUserBetsStartedAt,
    {
      rowCount: activeUserBets.length,
    },
  );

  logStage(
    "TOTAL live picks data loader",
    totalStartedAt,
    {
      currentMeetingCount:
        currentMeetings.length,
      currentRaceCount:
        currentRaces.length,
      currentRunnerCount:
        currentRunners.length,
      historicalRunnerCount:
        resultedHistoricalRunners.length,
      combinedRaceCount: races.length,
      combinedMeetingCount:
        meetings.length,
    },
  );

  return {
    dayDates: {
      yesterday,
      today,
      tomorrow,
    },
    currentMeetings,
    currentRaces,
    currentRaceIds,
    currentRunners,
    races,
    runners,
    horses,
    meetings,
    jockeyProfiles,
    calculatorTips,
    officialTips,
    activeUserBets,
  };
}
