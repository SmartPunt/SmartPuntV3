import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { sendPowerRatingRaceCardEmailAction } from "@/lib/actions";
import {
  calculateRaceConfidence,
  calculateRaceScores,
  getQualifiedCalculatorTip,
  type Horse,
  type JockeyProfile,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";

type RaceCardSelection = {
  meetingName: string;
  trackCondition: string;
  raceNumber: number;
  raceName: string;
  distance: number | null;
  horseName: string;
  score: number;
  winPercent: number;
  placePercent: number;
  confidenceTier: string;
  confidencePercent: number;
  tipLabel: string;
  tipTone: "win" | "place" | "none";
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

function getTipDisplay({
  topRunnerId,
  tip,
}: {
  topRunnerId: number;
  tip: ReturnType<typeof getQualifiedCalculatorTip<any>>;
}) {
  if (!tip || Number(tip.runner.id) !== Number(topRunnerId)) {
    return {
      label: "⚪ No Bet",
      tone: "none" as const,
    };
  }

  if (tip.type === "Win") {
    return {
      label: "🏆 Win Tip",
      tone: "win" as const,
    };
  }

  if (tip.type === "Place") {
    return {
      label: "🥈 Place Tip",
      tone: "place" as const,
    };
  }

  return {
    label: "⚪ No Bet",
    tone: "none" as const,
  };
}

function tipClass(tone: RaceCardSelection["tipTone"]) {
  if (tone === "win") {
    return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200";
  }

  if (tone === "place") {
    return "border-sky-400/50 bg-sky-500/15 text-sky-200";
  }

  return "border-zinc-500/40 bg-zinc-800/70 text-zinc-300";
}

export default async function PowerRatingRaceCardPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  const supabase = await createClient();
  const today = perthToday();

  async function emailPowerRatingRaceCard() {
    "use server";

    const result = await sendPowerRatingRaceCardEmailAction();

    if (!result.success) {
      throw new Error(result.error || "Race Card email failed.");
    }
  }

  const meetings = await fetchAllRows<Meeting>({
    getPage: async (from, to) => {
      const result = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_date", today)
        .order("meeting_name", { ascending: true })
        .range(from, to);

      return { data: result.data ?? [], error: result.error };
    },
  });

  const meetingIds = meetings.map((meeting) => Number(meeting.id));

  const currentRaces = meetingIds.length
    ? await fetchAllRows<Race>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("races")
            .select("*")
            .in("meeting_id", meetingIds)
            .neq("status", "closed")
            .order("meeting_id", { ascending: true })
            .order("race_number", { ascending: true })
            .range(from, to);

          return { data: result.data ?? [], error: result.error };
        },
      })
    : [];

  const currentRaceIds = uniqueNumbers(currentRaces.map((race) => race.id));

  const currentRunners = currentRaceIds.length
    ? await fetchAllRows<Runner>({
        getPage: async (from, to) => {
          const result = await supabase
            .from("race_runners")
            .select("*")
            .in("race_id", currentRaceIds)
            .eq("scratched", false)
            .is("finishing_position", null)
            .order("race_id", { ascending: true })
            .order("barrier", { ascending: true })
            .range(from, to);

          return { data: result.data ?? [], error: result.error };
        },
      })
    : [];

  const activeHorseIds = uniqueNumbers(
    currentRunners.map((runner) => runner.horse_id),
  );

  const horses = await fetchRowsByIds<Horse>({
    supabase,
    table: "horses",
    ids: activeHorseIds,
  });

  let historicalRunners: Runner[] = [];

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

      historicalRunners.push(...((data ?? []) as Runner[]));
    }
  }

  const runnerMap = new Map<number, Runner>();

  [...historicalRunners, ...currentRunners].forEach((runner) => {
    runnerMap.set(Number(runner.id), runner);
  });

  const runners = Array.from(runnerMap.values());

  const requiredRaceIds = uniqueNumbers([
    ...currentRaceIds,
    ...historicalRunners.map((runner) => runner.race_id),
  ]);

  const historicalAndCurrentRaces = await fetchRowsByIds<Race>({
    supabase,
    table: "races",
    ids: requiredRaceIds,
  });

  const raceMap = new Map<number, Race>();

  [...historicalAndCurrentRaces, ...currentRaces].forEach((race) => {
    raceMap.set(Number(race.id), race);
  });

  const races = Array.from(raceMap.values());

  const requiredMeetingIds = uniqueNumbers([
    ...meetingIds,
    ...races.map((race) => race.meeting_id),
  ]);

  const historicalAndCurrentMeetings = await fetchRowsByIds<Meeting>({
    supabase,
    table: "meetings",
    ids: requiredMeetingIds,
  });

  const meetingMap = new Map<number, Meeting>();

  [...historicalAndCurrentMeetings, ...meetings].forEach((meeting) => {
    meetingMap.set(Number(meeting.id), meeting);
  });

  const allMeetings = Array.from(meetingMap.values());

  const activeJockeyNames = uniqueStrings(
    currentRunners.map((runner) => runner.jockey_name),
  );

  let jockeyProfiles: JockeyProfile[] = [];

  if (activeJockeyNames.length) {
    for (const nameChunk of chunk(activeJockeyNames)) {
      const { data, error } = await supabase
        .from("jockey_profiles")
        .select("*")
        .in("jockey_name", nameChunk);

      if (error) {
        throw new Error(error.message);
      }

      jockeyProfiles.push(...((data ?? []) as JockeyProfile[]));
    }
  }

  const selections = currentRaces
    .map((race) => {
      const meeting = meetingMap.get(Number(race.meeting_id)) || null;

      const scoredRunners = calculateRaceScores({
        activeRace: race,
        races,
        runners,
        horses,
        meetings: allMeetings,
        jockeyProfiles,
      });

      const topRunner = scoredRunners[0] || null;

      if (!topRunner) return null;

      const raceConfidence = calculateRaceConfidence(scoredRunners, {
        trackCondition: meeting?.track_condition || null,
        raceName: race.race_name,
        placeTerms: race.place_terms || "top_3",
      });

      const qualifiedTip = getQualifiedCalculatorTip(scoredRunners, {
        trackCondition: meeting?.track_condition || null,
        raceName: race.race_name,
        placeTerms: race.place_terms || "top_3",
      });

      const tipDisplay = getTipDisplay({
        topRunnerId: Number(topRunner.id),
        tip: qualifiedTip,
      });

      return {
        meetingName: meeting?.meeting_name || "Unknown meeting",
        trackCondition: meeting?.track_condition || "",
        raceNumber: race.race_number,
        raceName: race.race_name,
        distance: race.distance_m,
        horseName: topRunner.horse_name,
        score: Number(topRunner.score),
        winPercent: Number(topRunner.winPercent),
        placePercent: Number(topRunner.placePercent),
        confidenceTier: raceConfidence.tier,
        confidencePercent: raceConfidence.confidencePercent,
        tipLabel: tipDisplay.label,
        tipTone: tipDisplay.tone,
      };
    })
    .filter(Boolean) as RaceCardSelection[];

  const grouped = new Map<string, RaceCardSelection[]>();

  selections.forEach((selection) => {
    const existing = grouped.get(selection.meetingName) || [];
    existing.push(selection);
    grouped.set(selection.meetingName, existing);
  });

  const topRated = [...selections]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
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
              SmartPunt Calculator Race Card
            </h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.22em] text-zinc-200">
              {new Intl.DateTimeFormat("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Australia/Perth",
              }).format(new Date())}{" "}
              Race Card — Calculator #1 in Every Race
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Auto-generated from today&apos;s active races. Calculator rank,
              tip status and race confidence are live.
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
            {Array.from(grouped.entries()).map(
              ([meetingName, meetingSelections]) => (
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

                  <div className="mt-3 grid grid-cols-[46px_minmax(0,1fr)_86px] gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                    <div>Race</div>
                    <div>Selection</div>
                    <div className="text-right">Tip</div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {meetingSelections
                      .sort((a, b) => a.raceNumber - b.raceNumber)
                      .map((selection) => (
                        <div
                          key={`${meetingName}-${selection.raceNumber}`}
                          className="grid grid-cols-[46px_minmax(0,1fr)_86px] gap-2 rounded-lg border border-amber-400/10 bg-zinc-900/70 px-2 py-1.5 text-sm"
                        >
                          <div className="font-black text-amber-300">
                            R{selection.raceNumber}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">
                              {selection.horseName}
                            </div>
                            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                              {selection.confidenceTier} · Score{" "}
                              {Math.round(selection.score)}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${tipClass(
                                selection.tipTone,
                              )}`}
                            >
                              {selection.tipLabel}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-400/50 bg-black/80 p-4">
            <h2 className="text-center text-xl font-black uppercase tracking-[0.18em] text-amber-300">
              Top Calculator Selections — Today
            </h2>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {topRated.map((selection, index) => (
                <div
                  key={`${selection.meetingName}-${selection.raceNumber}-${selection.horseName}`}
                  className="grid grid-cols-[40px_minmax(0,1fr)_120px_50px_95px] gap-2 rounded-lg border border-amber-400/10 bg-zinc-900/80 px-3 py-2 text-sm"
                >
                  <div className="font-black text-amber-300">{index + 1}</div>
                  <div className="truncate font-bold">{selection.horseName}</div>
                  <div className="truncate text-zinc-300">
                    {selection.meetingName}
                  </div>
                  <div className="text-zinc-300">R{selection.raceNumber}</div>
                  <div className="flex justify-end">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${tipClass(
                        selection.tipTone,
                      )}`}
                    >
                      {selection.tipLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/30 pt-4 text-xs text-zinc-400">
            <p>🏆 Calculator ratings. Smarter picks. Bet with discipline.</p>
            <p>Generated {today} · smartpunt.online</p>
          </div>
        </section>
      </div>
    </main>
  );
}
