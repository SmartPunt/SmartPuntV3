import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import CurrentRacesPage from "@/components/admin-current-races";

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

function chunkIds<T>(items: T[], size = 500) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  try {
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

    const raceIds = publishedRaces.map((race) => race.id).filter(Boolean);
    const meetingIds = Array.from(
      new Set(publishedRaces.map((race) => race.meeting_id).filter(Boolean)),
    );

    const meetings =
      meetingIds.length > 0
        ? await fetchAllRows<any>({
            getPage: async (from, to) => {
              const result = await supabase
                .from("meetings")
                .select("*")
                .in("id", meetingIds)
                .order("meeting_date", { ascending: false })
                .order("meeting_name", { ascending: true })
                .range(from, to);

              return {
                data: result.data ?? [],
                error: result.error,
              };
            },
          })
        : [];

    let raceRunners: any[] = [];

    for (const raceIdChunk of chunkIds(raceIds)) {
      const rows = await fetchAllRows<any>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("race_runners")
            .select("*")
            .in("race_id", raceIdChunk)
            .order("race_id", { ascending: true })
            .order("barrier", { ascending: true, nullsFirst: false })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      });

      raceRunners = [...raceRunners, ...rows];
    }

    const horseIds = Array.from(
      new Set(raceRunners.map((runner) => runner.horse_id).filter(Boolean)),
    );

    let horses: any[] = [];

    for (const horseIdChunk of chunkIds(horseIds)) {
      const rows = await fetchAllRows<any>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("horses")
            .select("*")
            .in("id", horseIdChunk)
            .order("horse_name", { ascending: true })
            .range(from, to);

          return {
            data: result.data ?? [],
            error: result.error,
          };
        },
      });

      horses = [...horses, ...rows];
    }

    return (
      <CurrentRacesPage
        currentUser={profile}
        initialMeetings={meetings}
        initialRaces={publishedRaces}
        initialHorses={horses}
        initialRunners={raceRunners}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error while loading Current Races.";

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[32px] border border-white/10 bg-black p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Current Races</h1>
              <Link
                href="/"
                className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Back to Dashboard
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-100 px-4 py-4 text-sm text-red-900">
              Current Races could not load from the server.
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-100 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Likely cause</p>
              <p className="mt-2">
                One of the Supabase queries or fields used by Current Races is failing on the server.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-200">
              <p className="font-semibold text-white">Server message</p>
              <p className="mt-2 break-words text-zinc-300">{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
