import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  createFortuneFiveAction,
  resultFortuneFiveAction,
  updateFortuneFiveLegResultAction,
  updateFortuneFiveNotesAction,
} from "@/lib/actions";
import { Badge, Panel } from "@/components/ui";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string | null;
  distance_m: number | null;
  status: string | null;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  barrier: number | null;
  market_price: number | null;
  scratched: boolean | null;
};

type Horse = {
  id: number;
  horse_name: string;
};

type FortuneFive = {
  id: number;
  title: string;
  description: string | null;
  week_start_date: string;
  week_end_date: string;
  published_date: string;
  status: string;
  won: boolean | null;
  settled_at: string | null;
};

type FortuneFiveLeg = {
  id: number;
  fortune_five_id: number;
  leg_number: number;
  race: string;
  horse: string;
  bet_type: string;
  won: boolean | null;
  leg_status?: string | null;
};

const PERTH_TIMEZONE = "Australia/Perth";

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

function getTodayPerthDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getWeekStart(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function statusBadge(fortune: FortuneFive) {
  if (fortune.status === "void") return <Badge tone="slate">Void</Badge>;
  if (fortune.settled_at && fortune.won === true) return <Badge tone="green">Multi Won</Badge>;
  if (fortune.settled_at && fortune.won === false) return <Badge tone="rose">Multi Lost</Badge>;
  return <Badge tone="amber">Live / Pending</Badge>;
}

function legStatusBadge(leg: FortuneFiveLeg) {
  const status = leg.leg_status || (leg.won === true ? "won" : leg.won === false ? "lost" : "pending");

  if (status === "won") return <Badge tone="green">✓ Won</Badge>;
  if (status === "lost") return <Badge tone="rose">✕ Lost</Badge>;
  if (status === "scratched") return <Badge tone="slate">Scratched</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const today = getTodayPerthDate();
  const weekStart = getWeekStart(today);

  const meetings = await fetchAllRows<Meeting>({
    getPage: async (from, to) => {
      const result = await supabase
        .from("meetings")
        .select("id, meeting_name, meeting_date")
        .gte("meeting_date", weekStart)
        .order("meeting_date", { ascending: true })
        .order("meeting_name", { ascending: true })
        .range(from, to);
      return { data: result.data ?? [], error: result.error };
    },
  });

  const meetingIds = meetings.map((meeting) => meeting.id);

  const races =
    meetingIds.length === 0
      ? []
      : await fetchAllRows<Race>({
          getPage: async (from, to) => {
            const result = await supabase
              .from("races")
              .select("id, meeting_id, race_number, race_name, distance_m, status")
              .in("meeting_id", meetingIds)
              .in("status", ["published", "closed"])
              .order("meeting_id", { ascending: true })
              .order("race_number", { ascending: true })
              .range(from, to);
            return { data: result.data ?? [], error: result.error };
          },
        });

  const raceIds = races.map((race) => race.id);

  const runners =
    raceIds.length === 0
      ? []
      : await fetchAllRows<Runner>({
          getPage: async (from, to) => {
            const result = await supabase
              .from("race_runners")
              .select("id, race_id, horse_id, barrier, market_price, scratched")
              .in("race_id", raceIds)
              .or("scratched.is.false,scratched.is.null")
              .order("race_id", { ascending: true })
              .order("barrier", { ascending: true, nullsFirst: false })
              .range(from, to);
            return { data: result.data ?? [], error: result.error };
          },
        });

  const horseIds = Array.from(
    new Set(runners.map((runner) => runner.horse_id).filter(Boolean)),
  );

  const horses =
    horseIds.length === 0
      ? []
      : await fetchAllRows<Horse>({
          getPage: async (from, to) => {
            const result = await supabase
              .from("horses")
              .select("id, horse_name")
              .in("id", horseIds)
              .order("horse_name", { ascending: true })
              .range(from, to);
            return { data: result.data ?? [], error: result.error };
          },
        });

  const [fortuneFives, fortuneFiveLegs] = await Promise.all([
    fetchAllRows<FortuneFive>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("fortune_fives")
          .select("*")
          .gte("published_date", weekStart)
          .order("published_date", { ascending: false })
          .range(from, to);
        return { data: result.data ?? [], error: result.error };
      },
    }),
    fetchAllRows<FortuneFiveLeg>({
      getPage: async (from, to) => {
        const result = await supabase
          .from("fortune_five_legs")
          .select("*")
          .order("leg_number", { ascending: true })
          .range(from, to);
        return { data: result.data ?? [], error: result.error };
      },
    }),
  ]);

  const meetingMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const raceMap = new Map(races.map((race) => [race.id, race]));
  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));

  const runnerOptions = runners
    .map((runner) => {
      const race = raceMap.get(runner.race_id);
      const meeting = race ? meetingMap.get(race.meeting_id) : null;
      const horse = horseMap.get(runner.horse_id);

      if (!race || !meeting || !horse) return null;

      return {
        id: runner.id,
        label: `${formatDate(meeting.meeting_date)} — ${meeting.meeting_name} R${race.race_number} ${race.race_name || "Race"} — ${horse.horse_name}${runner.barrier ? ` — Barrier ${runner.barrier}` : ""}`,
      };
    })
    .filter((item): item is { id: number; label: string } => Boolean(item));

  const legsByFortuneId = new Map<number, FortuneFiveLeg[]>();
  for (const leg of fortuneFiveLegs) {
    const existing = legsByFortuneId.get(leg.fortune_five_id) || [];
    existing.push(leg);
    legsByFortuneId.set(leg.fortune_five_id, existing);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] p-4 text-white lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Fortune on 5 Admin</h1>
            <p className="mt-2 text-sm text-amber-100/75">
              Build and result the daily 5-leg Fortune on 5 multi.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Back to Admin
          </Link>
        </div>

        <Panel className="bg-white/95">
          <form action={createFortuneFiveAction} className="space-y-5 p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Create today&apos;s Fortune on 5</h2>
                <p className="text-sm text-zinc-500">
                  Select five runners from loaded races. This stays separate from normal tips.
                </p>
              </div>
              <Badge tone="amber">5-leg multi</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700">
                Title
                <input
                  name="title"
                  defaultValue="Fortune on 5"
                  required
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                />
              </label>

              <label className="text-sm font-medium text-zinc-700">
                Published date
                <input
                  name="published_date"
                  type="date"
                  defaultValue={today}
                  required
                  className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                />
              </label>
            </div>

            <label className="text-sm font-medium text-zinc-700">
              Notes / intro
              <textarea
                name="description"
                placeholder="Today’s 5-leg play..."
                className="mt-2 min-h-[90px] w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((legNumber) => (
                <div key={legNumber} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Leg {legNumber}
                  </p>
                  <select
                    name={`leg_${legNumber}_race_runner_id`}
                    required
                    className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300"
                  >
                    <option value="">Select runner</option>
                    {runnerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    name={`leg_${legNumber}_bet_type`}
                    defaultValue="Win"
                    className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-300"
                  >
                    <option value="Win">Win</option>
                    <option value="Place">Place</option>
                  </select>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900"
            >
              Publish Fortune on 5
            </button>
          </form>
        </Panel>

        <Panel className="bg-white/95">
          <div className="space-y-5 p-6 text-zinc-950">
            <div>
              <h2 className="text-xl font-semibold">This week&apos;s Fortune on 5 board</h2>
              <p className="text-sm text-zinc-500">
                Monday to Sunday results for the weekly multi feature.
              </p>
            </div>

            {fortuneFives.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {fortuneFives.map((fortune) => {
                  const legs = legsByFortuneId.get(fortune.id) || [];
                  const isSettled = Boolean(fortune.settled_at) || fortune.status === "void";

                  return (
                    <div key={fortune.id} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            {formatDate(fortune.published_date)}
                          </p>
                          <h3 className="mt-1 text-xl font-bold">{fortune.title}</h3>
                          <form action={updateFortuneFiveNotesAction} className="mt-3 space-y-2">
                            <input type="hidden" name="fortune_five_id" value={fortune.id} />
                            <textarea
                              name="description"
                              defaultValue={fortune.description || ""}
                              placeholder="Update notes as the multi unfolds, e.g. scratched runner / odds changes..."
                              className="min-h-[72px] w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-amber-300"
                            />
                            <button
                              type="submit"
                              className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900"
                            >
                              Update Notes
                            </button>
                          </form>
                        </div>
                        {statusBadge(fortune)}
                      </div>

                      {isSettled ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                          Final multi result: {fortune.won === true ? "Won" : fortune.won === false ? "Lost" : "Void"}
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-2">
                        {legs.map((leg) => (
                          <div
                            key={leg.id}
                            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                  Leg {leg.leg_number} · {leg.bet_type}
                                </p>
                                <p className="mt-1 font-bold text-zinc-950">{leg.horse}</p>
                                <p className="mt-1 text-zinc-600">{leg.race}</p>
                              </div>
                              {legStatusBadge(leg)}
                            </div>

                            <form action={updateFortuneFiveLegResultAction} className="mt-3 flex flex-wrap gap-2">
                              <input type="hidden" name="leg_id" value={leg.id} />
                              <button
                                type="submit"
                                name="result"
                                value="won"
                                className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                Tick Won
                              </button>
                              <button
                                type="submit"
                                name="result"
                                value="lost"
                                className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                              >
                                Mark Lost
                              </button>
                              <button
                                type="submit"
                                name="result"
                                value="scratched"
                                className="rounded-xl bg-zinc-500 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-600"
                              >
                                Scratched
                              </button>
                              <button
                                type="submit"
                                name="result"
                                value="pending"
                                className="rounded-xl bg-zinc-700 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                              >
                                Reset Pending
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>

                      {!isSettled ? (
                        <form action={resultFortuneFiveAction} className="mt-4 flex flex-wrap gap-2">
                          <input type="hidden" name="fortune_five_id" value={fortune.id} />
                          <button
                            name="result"
                            value="won"
                            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                          >
                            Result Won
                          </button>
                          <button
                            name="result"
                            value="lost"
                            className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
                          >
                            Result Lost
                          </button>
                          <button
                            name="result"
                            value="void"
                            className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                          >
                            Void
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                No Fortune on 5 multis have been published this week.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
