import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminHorsesPage from "@/components/admin-horses-page";

type SortMode = "alphabetical" | "newest" | "most_used";

async function fetchRows<T>({
  getPage,
}: {
  getPage: () => Promise<{ data: T[] | null; error: any }>;
}) {
  const { data, error } = await getPage();

  if (error) {
    throw new Error(error.message || "Failed to fetch rows.");
  }

  return data || [];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    sort?: SortMode;
  }>;
}) {
  const params = await searchParams;
  const search = String(params?.q ?? "").trim();
  const sortMode: SortMode =
    params?.sort === "newest" || params?.sort === "most_used"
      ? params.sort
      : "alphabetical";

  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!["admin", "staff_admin"].includes(profile.role)) {
    redirect("/");
  }

  try {
    const supabase = await createClient();

    const { count: totalHorseCount, error: countError } = await supabase
      .from("horses")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw new Error(countError.message);
    }

    let horseQuery = supabase
      .from("horses")
      .select("*");

    if (search) {
      horseQuery = horseQuery.ilike("horse_name", `%${search}%`);
    }

    const { data: horses, error: horsesError } = await horseQuery
      .order("horse_name", { ascending: true })
      .range(0, 99);

    if (horsesError) {
      throw new Error(horsesError.message);
    }

    const horseIds = (horses || [])
      .map((horse: any) => Number(horse.id))
      .filter(Boolean);

    const raceRunners =
      horseIds.length === 0
        ? []
        : await fetchRows<any>({
            getPage: async () => {
              const result = await supabase
                .from("race_runners")
                .select("*")
                .in("horse_id", horseIds)
                .order("created_at", { ascending: false })
                .limit(1000);

              return {
                data: result.data ?? [],
                error: result.error,
              };
            },
          });

    const raceIds = Array.from(
      new Set(
        (raceRunners || [])
          .map((runner: any) => Number(runner.race_id))
          .filter(Boolean),
      ),
    );

    const races =
      raceIds.length === 0
        ? []
        : await fetchRows<any>({
            getPage: async () => {
              const result = await supabase
                .from("races")
                .select("*")
                .in("id", raceIds)
                .order("meeting_id", { ascending: false })
                .order("race_number", { ascending: true });

              return {
                data: result.data ?? [],
                error: result.error,
              };
            },
          });

    const meetingIds = Array.from(
      new Set(
        (races || [])
          .map((race: any) => Number(race.meeting_id))
          .filter(Boolean),
      ),
    );

    const meetings =
      meetingIds.length === 0
        ? []
        : await fetchRows<any>({
            getPage: async () => {
              const result = await supabase
                .from("meetings")
                .select("*")
                .in("id", meetingIds)
                .order("meeting_date", { ascending: false });

              return {
                data: result.data ?? [],
                error: result.error,
              };
            },
          });

    return (
      <AdminHorsesPage
        currentUser={profile}
        initialHorses={horses || []}
        initialRunners={raceRunners || []}
        initialRaces={races || []}
        initialMeetings={meetings || []}
        totalHorseCount={totalHorseCount || 0}
        initialSearch={search}
        initialSortMode={sortMode}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error while loading Saved Horses.";

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[32px] border border-white/10 bg-black p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Saved Horses</h1>
              <Link
                href="/"
                className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Back to Admin
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-100 px-4 py-4 text-sm text-red-900">
              Saved Horses could not load from the server.
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
