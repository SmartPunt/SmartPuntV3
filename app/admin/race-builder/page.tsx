import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import RaceBuilderPage from "@/components/admin-race-builder";

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

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  try {
    const supabase = await createClient();

    // ✅ KEEP ALL MEETINGS (fix)
    const meetings = await fetchAllRows({
      getPage: async (from, to) => {
        const result = await supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: false })
          .order("meeting_name", { ascending: true })
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    });

    // ✅ ONLY ACTIVE RACES (speed gain)
    const races = await fetchAllRows({
      getPage: async (from, to) => {
        const result = await supabase
          .from("races")
          .select("*")
          .in("status", ["draft", "published"])
          .order("meeting_id", { ascending: false })
          .order("race_number", { ascending: true })
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    });

    // ✅ ONLY RUNNERS FOR ACTIVE RACES
    const raceIds = Array.from(new Set(races.map((r: any) => r.id)));

    const raceRunners =
      raceIds.length > 0
        ? await fetchAllRows({
            getPage: async (from, to) => {
              const result = await supabase
                .from("race_runners")
                .select("*")
                .in("race_id", raceIds)
                .order("created_at", { ascending: false })
                .range(from, to);

              return { data: result.data ?? [], error: result.error };
            },
          })
        : [];

    // ⚠️ KEEP HORSES FOR NOW (we optimise this next)
    const horses = await fetchAllRows({
      getPage: async (from, to) => {
        const result = await supabase
          .from("horses")
          .select("*")
          .order("horse_name", { ascending: true })
          .range(from, to);

        return { data: result.data ?? [], error: result.error };
      },
    });

    return (
      <RaceBuilderPage
        currentUser={profile}
        initialMeetings={meetings}
        initialRaces={races}
        initialHorses={horses}
        initialRunners={raceRunners}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error while loading Race Builder.";

    return (
      <div className="min-h-screen p-4 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-white/10 bg-black p-6">
            <h1 className="text-xl font-bold">Race Builder Error</h1>
            <p className="mt-2 text-sm text-red-300">{message}</p>
          </div>
        </div>
      </div>
    );
  }
}
