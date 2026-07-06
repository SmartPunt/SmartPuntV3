import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    if (rows.length < pageSize) break;

    from += pageSize;
  }

  return allRows;
}

async function fetchRowsByIds<T>({
  supabase,
  table,
  select,
  ids,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  select: string;
  ids: number[];
}) {
  const rows: T[] = [];

  for (const idChunk of chunk(uniqueNumbers(ids))) {
    const chunkRows = await fetchAllRows<T>({
      getPage: async (from, to) => {
        const result = await supabase
          .from(table)
          .select(select)
          .in("id", idChunk)
          .range(from, to);

        return {
          data: result.data ?? [],
          error: result.error,
        };
      },
    });

    rows.push(...chunkRows);
  }

  return rows;
}

async function fetchRowsByNumberColumn<T>({
  supabase,
  table,
  select,
  column,
  values,
  orders = [],
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  table: string;
  select: string;
  column: string;
  values: number[];
  orders?: { column: string; ascending: boolean; nullsFirst?: boolean }[];
}) {
  const rows: T[] = [];

  for (const valueChunk of chunk(uniqueNumbers(values))) {
    const chunkRows = await fetchAllRows<T>({
      getPage: async (from, to) => {
        let query: any = supabase
          .from(table)
          .select(select)
          .in(column, valueChunk);

        orders.forEach((order) => {
          query = query.order(order.column, {
            ascending: order.ascending,
            nullsFirst: order.nullsFirst,
          });
        });

        const result = await query.range(from, to);

        return {
          data: result.data ?? [],
          error: result.error,
        };
      },
    });

    rows.push(...chunkRows);
  }

  return rows;
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();

    if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const publishedRaces = await fetchAllRows<any>({
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

    const raceIds = uniqueNumbers(publishedRaces.map((race) => race.id));
    const meetingIds = uniqueNumbers(publishedRaces.map((race) => race.meeting_id));

    const publishedRunners = raceIds.length
      ? await fetchRowsByNumberColumn<any>({
          supabase,
          table: "race_runners",
          select: "*",
          column: "race_id",
          values: raceIds,
          orders: [
            { column: "race_id", ascending: true },
            { column: "barrier", ascending: true, nullsFirst: false },
            { column: "id", ascending: true },
          ],
        })
      : [];

    const horseIds = uniqueNumbers(publishedRunners.map((runner) => runner.horse_id));

    const [horses, meetings] = await Promise.all([
      fetchRowsByIds<any>({
        supabase,
        table: "horses",
        select: "id,horse_name,normalised_name,sex,age",
        ids: horseIds,
      }),
      fetchRowsByIds<any>({
        supabase,
        table: "meetings",
        select: "id,meeting_name,meeting_date,track_condition",
        ids: meetingIds,
      }),
    ]);

    return NextResponse.json(
      {
        publishedRaces,
        publishedRunners,
        horses,
        meetings,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load admin dashboard race data.",
      },
      { status: 500 },
    );
  }
}
