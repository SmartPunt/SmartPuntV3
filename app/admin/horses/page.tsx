import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminHorsesPage from "@/components/admin-horses-page";

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

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  try {
    const supabase = await createClient();

    const horses = await fetchAllRows({
      getPage: async (from, to) => {
        return await supabase
          .from("horses")
          .select("*")
          .order("horse_name", { ascending: true })
          .range(from, to);
      },
    });

    const raceRunners = await fetchAllRows({
      getPage: async (from, to) => {
        return await supabase
          .from("race_runners")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);
      },
    });

    const races = await fetchAllRows({
      getPage: async (from, to) => {
        return await supabase
          .from("races")
          .select("*")
          .order("meeting_id", { ascending: false })
          .order("race_number", { ascending: true })
          .range(from, to);
      },
    });

    const meetings = await fetchAllRows({
      getPage: async (from, to) => {
        return await supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: false })
          .range(from, to);
      },
    });

    return (
      <AdminHorsesPage
        currentUser={profile}
        initialHorses={horses}
        initialRunners={raceRunners}
        initialRaces={races}
        initialMeetings={meetings}
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
