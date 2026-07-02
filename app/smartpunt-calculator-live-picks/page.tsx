import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import SubscriberCalculatorLivePicks from "@/components/subscriber-calculator-live-picks";

export const dynamic = "force-dynamic";

function getPerthDate(offsetDays = 0) {
  const perthNow = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Australia/Perth",
    }),
  );

  perthNow.setDate(perthNow.getDate() + offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(perthNow);
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

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const today = getPerthDate(0);

  const { data: currentMeetingsData, error: meetingsError } = await supabase
    .from("meetings")
    .select("*")
    .eq("meeting_date", today)
    .order("meeting_date", { ascending: true })
    .order("meeting_name", { ascending: true });

  if (meetingsError) {
    throw new Error(meetingsError.message);
  }

  const currentMeetings = currentMeetingsData ?? [];
  const currentMeetingIds = uniqueNumbers(
    currentMeetings.map((meeting: any) => meeting.id),
  );

  let currentRaces: any[] = [];

  if (currentMeetingIds.length) {
    for (const meetingIdChunk of chunk(currentMeetingIds)) {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .eq("status", "published")
        .in("meeting_id", meetingIdChunk)
        .order("meeting_id", { ascending: true })
        .order("race_number", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      currentRaces.push(...(data ?? []));
    }
  }

  const currentRaceIds = uniqueNumbers(currentRaces.map((race) => race.id));

  let currentRunners: any[] = [];

  if (currentRaceIds.length) {
    for (const raceIdChunk of chunk(currentRaceIds)) {
      const { data, error } = await supabase
        .from("race_runners")
        .select("*")
        .in("race_id", raceIdChunk)
        .order("race_id", { ascending: true })
        .order("barrier", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      currentRunners.push(...(data ?? []));
    }
  }

  const activeHorseIds = uniqueNumbers(
    currentRunners.map((runner) => runner.horse_id),
  );

  const horses = await fetchRowsByIds<any>({
    supabase,
    table: "horses",
    ids: activeHorseIds,
  });

  let historicalRunners: any[] = [];

  if (activeHorseIds.length) {
    for (const horseIdChunk of chunk(activeHorseIds)) {
      const { data, error } = await supabase
        .from("race_runners")
        .select("*")
        .in("horse_id", horseIdChunk)
        .not("finishing_position", "is", null);

      if (error) {
        throw new Error(error.message);
      }

      historicalRunners.push(...(data ?? []));
    }
  }

  const runnerMap = new Map<number, any>();

  [...historicalRunners, ...currentRunners].forEach((runner) => {
    runnerMap.set(Number(runner.id), runner);
  });

  const runners = Array.from(runnerMap.values());

  const requiredRaceIds = uniqueNumbers([
    ...currentRaceIds,
    ...historicalRunners.map((runner) => runner.race_id),
  ]);

  const historicalAndCurrentRaces = await fetchRowsByIds<any>({
    supabase,
    table: "races",
    ids: requiredRaceIds,
  });

  const raceMap = new Map<number, any>();

  [...historicalAndCurrentRaces, ...currentRaces].forEach((race) => {
    raceMap.set(Number(race.id), race);
  });

  const races = Array.from(raceMap.values());

  const requiredMeetingIds = uniqueNumbers([
    ...currentMeetingIds,
    ...races.map((race) => race.meeting_id),
  ]);

  const historicalAndCurrentMeetings = await fetchRowsByIds<any>({
    supabase,
    table: "meetings",
    ids: requiredMeetingIds,
  });

  const meetingMap = new Map<number, any>();

  [...historicalAndCurrentMeetings, ...currentMeetings].forEach((meeting) => {
    meetingMap.set(Number(meeting.id), meeting);
  });

  const meetings = Array.from(meetingMap.values());

  const activeJockeyNames = uniqueStrings(
    currentRunners.map((runner) => runner.jockey_name),
  );

  let jockeyProfiles: any[] = [];

  if (activeJockeyNames.length) {
    for (const nameChunk of chunk(activeJockeyNames)) {
      const { data, error } = await supabase
        .from("jockey_profiles")
        .select("*")
        .in("jockey_name", nameChunk);

      if (error) {
        throw new Error(error.message);
      }

      jockeyProfiles.push(...(data ?? []));
    }
  }

  const calculatorTips = currentRaceIds.length
    ? await fetchServiceRoleRowsByRaceIds<any>({
        table: "smartpunt_calculator_tips",
        select: "*",
        raceIds: currentRaceIds,
        order: "published_at.desc",
      })
    : [];

  const officialTips = currentRaceIds.length
    ? await fetchServiceRoleRowsByRaceIds<any>({
        table: "suggested_tips",
        select: "*",
        raceIds: currentRaceIds,
        order: "created_at.desc",
      })
    : [];

  return (
    <SubscriberCalculatorLivePicks
      currentUser={profile}
      races={races}
      runners={runners}
      horses={horses}
      meetings={meetings}
      jockeyProfiles={jockeyProfiles}
      calculatorTips={calculatorTips}
      officialTips={officialTips}
    />
  );
}
