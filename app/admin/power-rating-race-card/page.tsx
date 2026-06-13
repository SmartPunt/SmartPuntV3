import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { sendPowerRatingRaceCardEmailAction } from "@/lib/actions";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number | null;
  scratched: boolean | null;
  finishing_position: number | null;
};

type Horse = {
  id: number;
  horse_name: string;
  smartpunt_power_rating: number | null;
};

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

    if (error) throw new Error(error.message || "Failed to fetch rows.");

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

function perthToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function PowerRatingRaceCardPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  const supabase = await createClient();
  const today = perthToday();
  async function emailPowerRatingRaceCard() {
  "use server";

  await sendPowerRatingRaceCardEmailAction();
}

  const meetings = await fetchAllRows<Meeting>({
    getPage: async (from, to) => {
      const result = await supabase
        .from("meetings")
        .select("id, meeting_name, meeting_date, track_condition")
        .eq("meeting_date", today)
        .order("meeting_name", { ascending: true })
        .range(from, to);

      return { data: result.data ?? [], error: result.error };
    },
  });

  const meetingIds = meetings.map((meeting) => Number(meeting.id));

  const races = meetingIds.length
    ? await fetchAllRows<Race>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("races")
            .select("id, meeting_id, race_number, race_name, distance_m, status")
            .in("meeting_id", meetingIds)
            .neq("status", "closed")
            .order("meeting_id", { ascending: true })
            .order("race_number", { ascending: true })
            .range(from, to);

          return { data: result.data ?? [], error: result.error };
        },
      })
    : [];

  const raceIds = races.map((race) => Number(race.id));

  const runners = raceIds.length
    ? await fetchAllRows<Runner>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("race_runners")
            .select("id, race_id, horse_id, scratched, finishing_position")
            .in("race_id", raceIds)
            .eq("scratched", false)
            .is("finishing_position", null)
            .range(from, to);

          return { data: result.data ?? [], error: result.error };
        },
      })
    : [];

  const horseIds = Array.from(
    new Set(runners.map((runner) => Number(runner.horse_id)).filter(Boolean)),
  );

  const horses = horseIds.length
    ? await fetchAllRows<Horse>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("horses")
            .select("id, horse_name, smartpunt_power_rating")
            .in("id", horseIds)
            .range(from, to);

          return { data: result.data ?? [], error: result.error };
        },
      })
    : [];

  const meetingMap = new Map(meetings.map((meeting) => [Number(meeting.id), meeting]));
  const horseMap = new Map(horses.map((horse) => [Number(horse.id), horse]));

  const selections = races
    .map((race) => {
      const raceRunners = runners.filter((runner) => Number(runner.race_id) === Number(race.id));

      const topRunner = raceRunners
        .map((runner) => {
          const horse = runner.horse_id ? horseMap.get(Number(runner.horse_id)) : null;
          return { runner, horse };
        })
        .filter((item) => item.horse?.smartpunt_power_rating !== null && item.horse?.smartpunt_power_rating !== undefined)
        .sort(
          (a, b) =>
            Number(b.horse?.smartpunt_power_rating || 0) -
            Number(a.horse?.smartpunt_power_rating || 0),
        )[0];

      if (!topRunner?.horse) return null;

      const meeting = meetingMap.get(Number(race.meeting_id));

      return {
        meetingName: meeting?.meeting_name || "Unknown meeting",
        trackCondition: meeting?.track_condition || "",
        raceNumber: race.race_number,
        raceName: race.race_name,
        distance: race.distance_m,
        horseName: topRunner.horse.horse_name,
        rating: topRunner.horse.smartpunt_power_rating,
      };
    })
    .filter(Boolean) as {
      meetingName: string;
      trackCondition: string;
      raceNumber: number;
      raceName: string;
      distance: number | null;
      horseName: string;
      rating: number | null;
    }[];

  const grouped = new Map<string, typeof selections>();

  selections.forEach((selection) => {
    const existing = grouped.get(selection.meetingName) || [];
    existing.push(selection);
    grouped.set(selection.meetingName, existing);
  });

  const topRated = [...selections]
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-[1600px] rounded-[32px] border border-amber-400/60 bg-[#070707] p-4 shadow-2xl shadow-amber-900/20">
        <div className="overflow-hidden rounded-[28px] border border-amber-400/50 bg-black">
          <img
            src="/power-rating-header.png"
            alt="Fortune on 5 SmartPunt"
            className="h-auto w-full object-cover"
          />
        </div>

        <section className="mt-4 rounded-[28px] border border-amber-400/60 bg-zinc-950/95 p-5">
          <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-[0.18em] text-amber-300">
              SmartPunt Power Rating Selections
            </h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.22em] text-zinc-200">
{new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Australia/Perth",
}).format(new Date())} Race Card — Power #1 in Every Race
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Auto-generated from today&apos;s active races. Display only.
            </p>
<form action={emailPowerRatingRaceCard} className="mt-4">
  <button
    type="submit"
    className="rounded-2xl border border-amber-400/50 bg-amber-500/20 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/30"
  >
    Email Race Card to Subscribers
  </button>
</form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from(grouped.entries()).map(([meetingName, meetingSelections]) => (
              <div
                key={meetingName}
                className="rounded-2xl border border-amber-400/40 bg-black/70 p-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-amber-400/30 pb-2">
                  <h2 className="text-lg font-black uppercase tracking-[0.12em] text-amber-300">
                    🐎 {meetingName}
                  </h2>
                  <span className="text-xs font-bold text-zinc-400">
                    {meetingSelections[0]?.trackCondition || ""}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[46px_minmax(0,1fr)_64px] gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                  <div>Race</div>
                  <div>Selection</div>
                  <div className="text-right">Rating</div>
                </div>

                <div className="mt-2 space-y-1">
                  {meetingSelections
                    .sort((a, b) => a.raceNumber - b.raceNumber)
                    .map((selection) => (
                      <div
                        key={`${meetingName}-${selection.raceNumber}`}
                        className="grid grid-cols-[46px_minmax(0,1fr)_64px] gap-2 rounded-lg border border-amber-400/10 bg-zinc-900/70 px-2 py-1.5 text-sm"
                      >
                        <div className="font-black text-amber-300">R{selection.raceNumber}</div>
                        <div className="truncate font-semibold text-white">
                          {selection.horseName}
                        </div>
                        <div className="text-right font-black text-amber-300">
                          {selection.rating ?? "N/A"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-400/50 bg-black/80 p-4">
            <h2 className="text-center text-xl font-black uppercase tracking-[0.18em] text-amber-300">
              Top Rated Selections — Today
            </h2>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {topRated.map((selection, index) => (
                <div
                  key={`${selection.meetingName}-${selection.raceNumber}-${selection.horseName}`}
                  className="grid grid-cols-[40px_minmax(0,1fr)_120px_50px_55px] gap-2 rounded-lg border border-amber-400/10 bg-zinc-900/80 px-3 py-2 text-sm"
                >
                  <div className="font-black text-amber-300">{index + 1}</div>
                  <div className="truncate font-bold">{selection.horseName}</div>
                  <div className="truncate text-zinc-300">{selection.meetingName}</div>
                  <div className="text-zinc-300">R{selection.raceNumber}</div>
                  <div className="text-right font-black text-amber-300">
                    {selection.rating}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/30 pt-4 text-xs text-zinc-400">
            <p>🏆 Power ratings. Smarter picks. Bet with discipline.</p>
            <p>Generated {today} · smartpunt.online</p>
          </div>
        </section>
      </div>
    </main>
  );
}
