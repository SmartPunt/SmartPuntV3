import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;

  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;

  good_track_record: string | null;
  soft_track_record: string | null;
  heavy_track_record: string | null;
synthetic_track_record: string | null;

smartpunt_power_rating: number | null;

created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  finishing_position: number | null;
  starting_price: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type EnrichedRunner = Runner & {
  race: Race | null;
  meeting: Meeting | null;
};

type StatRow = {
  label: string;
  runs: number;
  wins: number;
  places: number;
};
type TrackStatRow = {
  id: number;
  horse_id: number;
  track_name: string;
  runs: number;
  wins: number;
  seconds: number;
  thirds: number;
  updated_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFormLine(runs: EnrichedRunner[]) {
  if (!runs.length) return "—";

  return runs
    .slice(0, 6)
    .map((run) => {
      if (run.finishing_position === null || run.finishing_position === undefined) return "—";
      return String(run.finishing_position);
    })
    .join(" • ");
}

function formatHorseMeta(horse: Horse) {
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

function getConditionBucket(condition?: string | null) {
  const value = String(condition || "").toLowerCase();

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  return "Other";
}

function getDistanceBucket(distance?: number | null) {
  if (!distance) return "Unknown";

  if (distance <= 1200) return "1000–1200m";
  if (distance <= 1400) return "1201–1400m";
  if (distance <= 1600) return "1401–1600m";
  if (distance <= 1800) return "1601–1800m";
  if (distance <= 2200) return "1801–2200m";
  return "2200m+";
}

function getDistanceArchetypeLabel(distanceBucket?: string | null) {
  if (distanceBucket === "1000–1200m") return "Sprint Specialist";
  if (distanceBucket === "1201–1400m") return "Short Course Specialist";
  if (distanceBucket === "1401–1600m") return "Mile Specialist";
  if (distanceBucket === "1601–1800m") return "Middle Distance Specialist";
  if (distanceBucket === "1801–2200m") return "Staying Specialist";
  if (distanceBucket === "2200m+") return "Stayer";

  return "Distance Specialist";
}

function getEmergingDistanceArchetypeLabel(distanceBucket?: string | null) {
  if (distanceBucket === "1000–1200m") return "Emerging Sprint Specialist";
  if (distanceBucket === "1201–1400m") return "Emerging Short Course Specialist";
  if (distanceBucket === "1401–1600m") return "Emerging Mile Specialist";
  if (distanceBucket === "1601–1800m") return "Emerging Middle Distance Specialist";
  if (distanceBucket === "1801–2200m") return "Emerging Staying Specialist";
  if (distanceBucket === "2200m+") return "Emerging Stayer";

  return "Emerging Distance Specialist";
}

function getDistancePositiveLabel(distanceBucket?: string | null) {
  if (distanceBucket === "1000–1200m") return "Sprint Positive";
  if (distanceBucket === "1201–1400m") return "Short Course Positive";
  if (distanceBucket === "1401–1600m") return "Mile Positive";
  if (distanceBucket === "1601–1800m") return "Middle Distance Positive";
  if (distanceBucket === "1801–2200m") return "Staying Positive";
  if (distanceBucket === "2200m+") return "Staying Positive";

  return "Distance Positive";
}

function parseImportedRecord(value?: string | null) {
  const cleaned = String(value || "").trim();
  const match = cleaned.match(/^(\d+):([0-9]+),([0-9]+),([0-9]+)$/);

  if (!match) return null;

  const runs = Number(match[1]);
  const wins = Number(match[2]);
  const seconds = Number(match[3]);
  const thirds = Number(match[4]);

  return {
    runs: Number.isNaN(runs) ? 0 : runs,
    wins: Number.isNaN(wins) ? 0 : wins,
    seconds: Number.isNaN(seconds) ? 0 : seconds,
    thirds: Number.isNaN(thirds) ? 0 : thirds,
    places:
      (Number.isNaN(wins) ? 0 : wins) +
      (Number.isNaN(seconds) ? 0 : seconds) +
      (Number.isNaN(thirds) ? 0 : thirds),
  };
}

function formatRecord(value?: string | null) {
  return value && value.trim() ? value : "—";
}

function getStrikeRate(record?: ReturnType<typeof parseImportedRecord> | null) {
  if (!record || record.runs <= 0) {
    return {
      winRate: 0,
      placeRate: 0,
    };
  }

  return {
    winRate: record.wins / record.runs,
    placeRate: record.places / record.runs,
  };
}

function buildStatRows(
  runs: EnrichedRunner[],
  getLabel: (run: EnrichedRunner) => string | null,
  includeAllDistanceBuckets = false,
): StatRow[] {
  const map = new Map<string, StatRow>();

  if (includeAllDistanceBuckets) {
    [
      "1000–1200m",
      "1201–1400m",
      "1401–1600m",
      "1601–1800m",
      "1801–2200m",
      "2200m+",
    ].forEach((label) => {
      map.set(label, {
        label,
        runs: 0,
        wins: 0,
        places: 0,
      });
    });
  }

  runs.forEach((run) => {
    const label = getLabel(run);
    if (!label) return;

    const current = map.get(label) || {
      label,
      runs: 0,
      wins: 0,
      places: 0,
    };

    current.runs += 1;
    if (run.finishing_position === 1) current.wins += 1;
    if (
      run.finishing_position !== null &&
      run.finishing_position !== undefined &&
      run.finishing_position <= 3
    ) {
      current.places += 1;
    }

    map.set(label, current);
  });

  return Array.from(map.values()).sort((a, b) => {
    const distanceOrder = [
      "1000–1200m",
      "1201–1400m",
      "1401–1600m",
      "1601–1800m",
      "1801–2200m",
      "2200m+",
    ];

    const aIndex = distanceOrder.indexOf(a.label);
    const bIndex = distanceOrder.indexOf(b.label);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    return b.runs - a.runs || a.label.localeCompare(b.label);
  });
}

function getRaceStatusTone(status?: Race["status"] | null) {
  if (status === "published") return "green";
  if (status === "closed") return "rose";
  return "amber";
}

function getRecordLabel(record?: string | null) {
  const parsed = parseImportedRecord(record);
  if (!parsed || parsed.runs <= 0) return "No exposed record";

  return `${parsed.runs} runs • ${parsed.wins} wins • ${parsed.places} places`;
}
function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getRecordAssessment(label: string, record?: ReturnType<typeof parseImportedRecord> | null) {
  if (!record || record.runs <= 0) return `No ${label.toLowerCase()} edge`;

  const rates = getStrikeRate(record);

  if (record.runs >= 5 && rates.placeRate >= 0.55) return `${label} Advantage`;
  if (record.runs >= 3 && rates.placeRate >= 0.45) return `${label} Positive`;
  if (record.runs >= 5 && rates.placeRate <= 0.25) return `${label} Query`;

  return `${label} Neutral`;
}
function getProfileStatus(totalRuns: number, totalWins: number, totalPlaces: number) {
  const winRate = totalRuns > 0 ? totalWins / totalRuns : 0;
  const placeRate = totalRuns > 0 ? totalPlaces / totalRuns : 0;

  if (totalRuns >= 12 && placeRate >= 0.45) return "Established Profile";
  if (totalRuns >= 6 && winRate >= 0.25) return "Developing Winner";
  if (totalRuns >= 6 && placeRate >= 0.45) return "Reliable Profile";
  if (totalRuns >= 3) return "Developing Profile";

  return "Profile Building";
}
function getBestCondition(horse: Horse) {
  const rows = [
    { label: "Good", record: parseImportedRecord(horse.good_track_record) },
    { label: "Soft", record: parseImportedRecord(horse.soft_track_record) },
    { label: "Heavy", record: parseImportedRecord(horse.heavy_track_record) },
    { label: "Synthetic", record: parseImportedRecord(horse.synthetic_track_record) },
  ]
.filter((row) => row.record && row.record.runs >= 2)
    .map((row) => {
      const rates = getStrikeRate(row.record);
      return {
        label: row.label,
        record: row.record!,
        score: rates.placeRate * 100 + rates.winRate * 70 + row.record!.runs * 1.5,
      };
    })
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getWorstCondition(horse: Horse) {
  const rows = [
    { label: "Good", record: parseImportedRecord(horse.good_track_record) },
    { label: "Soft", record: parseImportedRecord(horse.soft_track_record) },
    { label: "Heavy", record: parseImportedRecord(horse.heavy_track_record) },
    { label: "Synthetic", record: parseImportedRecord(horse.synthetic_track_record) },
  ]
    .filter((row) => row.record && row.record.runs >= 2)
    .map((row) => {
      const rates = getStrikeRate(row.record);
      return {
        label: row.label,
        record: row.record!,
        score: rates.placeRate * 100 + rates.winRate * 70,
      };
    })
    .sort((a, b) => a.score - b.score);

  return rows[0] || null;
}

function parseRecentFormForProfile(value?: string | null) {
  return String(value || "")
    .replace(/[^0-9xX]/g, "")
    .split("")
    .filter((item) => item.toLowerCase() !== "x")
    .map((item) => {
      const num = Number(item);
      if (!Number.isFinite(num) || num <= 0) return 10;
      return num;
    });
}

function buildSmartPuntProfile({
  horse,
  recentFormLine,
  horseTrackStats,
  distanceStats,
}: {
  horse: Horse;
  recentFormLine: string;
  horseTrackStats: TrackStatRow[];
  distanceStats: StatRow[];
}) {
  const distanceRecord = parseImportedRecord(horse.distance_form_last_6);
  const bestCondition = getBestCondition(horse);
  const worstCondition = getWorstCondition(horse);
  const recentPositions = parseRecentFormForProfile(recentFormLine);

  const tags: string[] = [];
  const strengths: string[] = [];
  const watchOuts: string[] = [];

  const distanceRates = getStrikeRate(distanceRecord);

  const bestDistance = [...distanceStats]
    .filter((row) => row.label !== "Unknown" && row.runs >= 3)
    .map((row) => {
      const placeRate = row.runs > 0 ? row.places / row.runs : 0;
      const winRate = row.runs > 0 ? row.wins / row.runs : 0;

      return {
        ...row,
        placeRate,
        winRate,
        score: placeRate * 100 + winRate * 70 + row.runs * 1.5,
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  const bestDistanceLabel = bestDistance?.label || null;

  const bestTrack = [...horseTrackStats]
    .map((row) => {
      const places = row.wins + row.seconds + row.thirds;
      const placeRate = row.runs > 0 ? places / row.runs : 0;
      const winRate = row.runs > 0 ? row.wins / row.runs : 0;

      return {
        ...row,
        places,
        placeRate,
        winRate,
        score: placeRate * 100 + winRate * 70 + row.runs * 1.5,
      };
    })
    .filter((row) => row.runs >= 3)
    .sort((a, b) => b.score - a.score)[0];

  if (bestTrack && bestTrack.runs >= 5 && bestTrack.placeRate >= 0.5) {
    tags.push(`${bestTrack.track_name} Specialist`);
    strengths.push(
      `Strong ${bestTrack.track_name} profile: ${bestTrack.runs}:${bestTrack.wins},${bestTrack.seconds},${bestTrack.thirds} (${bestTrack.runs} runs • ${bestTrack.wins} wins • ${bestTrack.places} places).`,
    );
  } else if (bestTrack && bestTrack.runs >= 3 && bestTrack.placeRate >= 0.66) {
    tags.push(`Emerging ${bestTrack.track_name} Specialist`);
    strengths.push(
      `Emerging ${bestTrack.track_name} specialist profile: ${bestTrack.runs}:${bestTrack.wins},${bestTrack.seconds},${bestTrack.thirds} (${bestTrack.runs} runs • ${bestTrack.wins} wins • ${bestTrack.places} places). Needs more exposed runs before becoming a proven track specialist.`,
    );
  } else if (bestTrack && bestTrack.runs >= 3 && bestTrack.placeRate >= 0.45) {
    tags.push(`${bestTrack.track_name} Performer`);
    strengths.push(
      `Positive ${bestTrack.track_name} record: ${bestTrack.runs}:${bestTrack.wins},${bestTrack.seconds},${bestTrack.thirds}.`,
    );
  }

  if (bestDistance && bestDistance.runs >= 5 && bestDistance.placeRate >= 0.5) {
    tags.push(getDistanceArchetypeLabel(bestDistanceLabel));
    strengths.push(
      `Proven ${bestDistanceLabel} profile: ${bestDistance.runs} runs • ${bestDistance.wins} wins • ${bestDistance.places} places.`,
    );
  } else if (bestDistance && bestDistance.runs >= 3 && bestDistance.placeRate >= 0.66) {
    tags.push(getEmergingDistanceArchetypeLabel(bestDistanceLabel));
    strengths.push(
      `Emerging ${bestDistanceLabel} profile: ${bestDistance.runs} runs • ${bestDistance.wins} wins • ${bestDistance.places} places. Needs more exposed runs before becoming a proven specialist.`,
    );
  } else if (bestDistance && bestDistance.runs >= 3 && bestDistance.placeRate >= 0.4) {
    tags.push(getDistancePositiveLabel(bestDistanceLabel));
    strengths.push(
      `Useful ${bestDistanceLabel} evidence: ${bestDistance.runs} runs • ${bestDistance.wins} wins • ${bestDistance.places} places.`,
    );
  } else if (distanceRecord && distanceRecord.runs >= 5 && distanceRates.placeRate >= 0.5) {
    tags.push("Distance Specialist");
    strengths.push(
      `Proven imported distance profile: ${horse.distance_form_last_6} (${getRecordLabel(
        horse.distance_form_last_6,
      )}).`,
    );
  } else if (distanceRecord && distanceRecord.runs >= 3 && distanceRates.placeRate >= 0.4) {
    tags.push("Distance Positive");
    strengths.push(`Has some useful imported distance evidence: ${horse.distance_form_last_6}.`);
  }

  if (bestCondition) {
    const bestRates = getStrikeRate(bestCondition.record);

    if (bestCondition.record.runs >= 2 && bestRates.placeRate >= 0.5) {
      const conditionTag =
        bestCondition.label === "Heavy"
          ? "Heavy Tracker"
          : bestCondition.label === "Soft"
            ? "Wet Tracker"
            : `${bestCondition.label} Performer`;

      tags.push(conditionTag);
      strengths.push(
        `Best exposed condition is ${bestCondition.label}: ${bestCondition.record.runs}:${bestCondition.record.wins},${bestCondition.record.seconds},${bestCondition.record.thirds}.`,
      );
    }
  }

  if (recentPositions.length >= 3) {
    const recentSix = recentPositions.slice(0, 6);
    const recentFour = recentPositions.slice(0, 4);
    const wins = recentSix.filter((position) => position === 1).length;
    const topThree = recentSix.filter((position) => position <= 3).length;
    const poorRuns = recentSix.filter((position) => position >= 8).length;
    const recentFourAverage = recentFour.length
      ? recentFour.reduce((total, position) => total + position, 0) / recentFour.length
      : 10;

    if (wins >= 3) {
      tags.push("Winning Machine");
      strengths.push("Recent form shows a serious winning habit with three or more wins in the exposed form line.");
    } else if (recentFour.length >= 3 && recentFourAverage <= 3) {
      tags.push("In Form");
      strengths.push("Current preparation is trending strongly, with an average finish inside the top three across the latest exposed runs.");
    }

    if (topThree >= 4) {
      tags.push("Consistent Performer");
      strengths.push("Recent form shows reliable top-three consistency across the exposed form line.");
    } else if (topThree >= 3) {
      tags.push("Reliable Profile");
      strengths.push("Recent form has multiple top-three finishes, so the profile is building in the right direction.");
    }

    if (poorRuns >= 3) {
      watchOuts.push("Recent form has a few plain runs, so current performance needs monitoring.");
    }
  }

  if (bestTrack && bestTrack.runs >= 5 && bestTrack.placeRate <= 0.25) {
    watchOuts.push(
      `${bestTrack.track_name} record is a query: ${bestTrack.runs}:${bestTrack.wins},${bestTrack.seconds},${bestTrack.thirds}.`,
    );
  }
  if (distanceRecord && distanceRecord.runs >= 6 && distanceRates.placeRate <= 0.25) {
    watchOuts.push(`Distance record is a query: ${horse.distance_form_last_6}.`);
  }

  if (worstCondition) {
    const worstRates = getStrikeRate(worstCondition.record);

    if (worstCondition.record.runs >= 3 && worstRates.placeRate <= 0.25) {
      watchOuts.push(
        `${worstCondition.label} conditions look less suitable from exposed results.`,
      );
    }
  }

  if (!tags.length) {
    tags.push("Profile Building");
  }

  const primaryTag = tags[0];

  const summary =
    primaryTag === "Profile Building"
      ? `${horse.horse_name} is still building a stronger SmartPunt profile. The available data is useful, but there is not yet a clear standout pattern across track, distance, and conditions.`
      : `${horse.horse_name} has a ${primaryTag.toLowerCase()} in the current SmartPunt profile. The key indicators point to ${strengths
          .slice(0, 2)
          .map((item) => item.replace(/\.$/, "").toLowerCase())
          .join(" and ")}.`;

  return {
    primaryTag,
    tags: Array.from(new Set(tags)).slice(0, 4),
    summary,
    strengths: strengths.length
      ? Array.from(new Set(strengths)).slice(0, 4)
      : ["No standout strength yet — profile is still developing from SmartPunt history."],
    watchOuts: watchOuts.length
      ? Array.from(new Set(watchOuts)).slice(0, 3)
      : ["No major statistical watch-out from the current SmartPunt profile."],
  };
}

function StatCard({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: StatRow[];
  emptyLabel: string;
}) {
  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge tone="amber">{rows.length}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {rows.length > 0 ? (
            rows.map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-zinc-900">{row.label}</p>
                  <Badge tone="blue">
                    {row.runs}:{row.wins}-{row.places}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {row.runs} runs • {row.wins} wins • {row.places} places
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ horseId: string }>;
}) {
  const { horseId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role !== "admin" &&
    profile.role !== "staff_admin"
  ) {
    redirect("/");
  }

  const horseIdNumber = Number(horseId);

  if (!horseIdNumber) {
    notFound();
  }

  const supabase = await createClient();

  const { data: horse, error: horseError } = await supabase
    .from("horses")
    .select("*")
    .eq("id", horseIdNumber)
    .maybeSingle();

  if (horseError || !horse) {
    notFound();
  }

  const { data: allRunners } = await supabase
    .from("race_runners")
    .select("*")
    .eq("horse_id", horseIdNumber)
    .order("created_at", { ascending: false });

  const { data: horseTrackStatsData } = await supabase
    .from("horse_track_stats")
    .select("*")
    .eq("horse_id", horseIdNumber)
    .order("runs", { ascending: false })
    .order("track_name", { ascending: true });

  const runners: Runner[] = allRunners || [];
  const horseTrackStats: TrackStatRow[] = horseTrackStatsData || [];


  const raceIds = Array.from(
    new Set(
      runners
        .map((runner) => Number(runner.race_id))
        .filter((raceId) => Number.isFinite(raceId) && raceId > 0),
    ),
  );

  const { data: races } =
    raceIds.length > 0
      ? await supabase
          .from("races")
          .select("*")
          .in("id", raceIds)
          .order("meeting_id", { ascending: false })
          .order("race_number", { ascending: true })
      : { data: [] };

  const raceList: Race[] = races || [];

  const meetingIds = Array.from(
    new Set(
      raceList
        .map((race) => Number(race.meeting_id))
        .filter((meetingId) => Number.isFinite(meetingId) && meetingId > 0),
    ),
  );

  const { data: meetings } =
    meetingIds.length > 0
      ? await supabase
          .from("meetings")
          .select("*")
          .in("id", meetingIds)
          .order("meeting_date", { ascending: false })
      : { data: [] };

  const meetingList: Meeting[] = meetings || [];

  const enrichedRuns: EnrichedRunner[] = runners.map((runner) => {
    const race =
      raceList.find((item) => Number(item.id) === Number(runner.race_id)) ||
      null;

    const meeting = race
      ? meetingList.find(
          (item) => Number(item.id) === Number(race.meeting_id),
        ) || null
      : null;

    return {
      ...runner,
      race,
      meeting,
    };
  });

  const resultedRuns = enrichedRuns.filter(
    (run) => run.finishing_position !== null && run.finishing_position !== undefined,
  );

  const sortedResultedRuns = [...resultedRuns].sort((a, b) => {
    const aDate = a.meeting?.meeting_date
      ? new Date(a.meeting.meeting_date).getTime()
      : 0;
    const bDate = b.meeting?.meeting_date
      ? new Date(b.meeting.meeting_date).getTime()
      : 0;

    if (bDate !== aDate) return bDate - aDate;

    const aRaceNo = a.race?.race_number || 0;
    const bRaceNo = b.race?.race_number || 0;

    return bRaceNo - aRaceNo;
  });

  const latestRunner = sortedResultedRuns[0] || enrichedRuns[0] || null;

  function parseImportedForm(value?: string | null) {
    const cleaned = String(value || "").trim();

    if (!cleaned || cleaned === "—") return [];

    if (/^[0-9xX]+$/.test(cleaned)) {
      return cleaned
        .split("")
        .map((item: string) => (item.toLowerCase() === "x" ? null : Number(item)))
        .filter((item: number | null): item is number => item !== null && !Number.isNaN(item));
    }

    return cleaned
      .split(/[-•,\s]+/)
      .map((item: string) => Number(item))
      .filter((item: number) => !Number.isNaN(item));
  }

  const importedFormSource =
    horse.form_last_6 ||
    enrichedRuns.find((runner) => runner.form_last_6)?.form_last_6 ||
    "";

  const importedTrackSource =
    horse.track_form_last_6 ||
    enrichedRuns.find((runner) => runner.track_form_last_6)?.track_form_last_6 ||
    "";

  const importedDistanceSource =
    horse.distance_form_last_6 ||
    enrichedRuns.find((runner) => runner.distance_form_last_6)?.distance_form_last_6 ||
    "";

  const importedFormNumbers = parseImportedForm(importedFormSource);

  const totalRuns =
    importedFormNumbers.length > 0 ? importedFormNumbers.length : sortedResultedRuns.length;

  const totalWins =
    importedFormNumbers.length > 0
      ? importedFormNumbers.filter((position: number) => position === 1).length
      : sortedResultedRuns.filter((run) => run.finishing_position === 1).length;

  const totalPlaces =
    importedFormNumbers.length > 0
      ? importedFormNumbers.filter(
          (position: number) => position >= 1 && position <= 3,
        ).length
      : sortedResultedRuns.filter(
          (run) =>
            run.finishing_position !== null &&
            run.finishing_position !== undefined &&
            run.finishing_position <= 3,
        ).length;

  const uniqueJockeys = Array.from(
    new Set(enrichedRuns.map((runner) => runner.jockey_name).filter(Boolean)),
  );

  const uniqueTrainers = Array.from(
    new Set(enrichedRuns.map((runner) => runner.trainer_name).filter(Boolean)),
  );

  const conditionRecordRows: StatRow[] = [
    { label: "Good", ...(parseImportedRecord(horse.good_track_record) || { runs: 0, wins: 0, places: 0 }) },
    { label: "Soft", ...(parseImportedRecord(horse.soft_track_record) || { runs: 0, wins: 0, places: 0 }) },
    { label: "Heavy", ...(parseImportedRecord(horse.heavy_track_record) || { runs: 0, wins: 0, places: 0 }) },
    { label: "Synthetic", ...(parseImportedRecord(horse.synthetic_track_record) || { runs: 0, wins: 0, places: 0 }) },
  ];

  const distanceStats = buildStatRows(
    sortedResultedRuns,
    (run) => getDistanceBucket(run.race?.distance_m),
    true,
  );

  const trackStats = buildStatRows(sortedResultedRuns, (run) =>
    run.meeting?.meeting_name || null,
  );

  const conditionStats = conditionRecordRows.some((row) => row.runs > 0)
    ? conditionRecordRows
    : buildStatRows(sortedResultedRuns, (run) =>
        getConditionBucket(run.meeting?.track_condition),
      );

  const recentFormLine =
    horse.form_last_6 ||
    importedFormSource ||
    (sortedResultedRuns.length > 0 ? formatFormLine(sortedResultedRuns) : "—");

  const smartPuntProfile = buildSmartPuntProfile({
    horse,
    recentFormLine,
    horseTrackStats,
    distanceStats,
  });
  const profileStatus = getProfileStatus(
    totalRuns,
    totalWins,
    totalPlaces,
  );

  const winRate = totalRuns > 0 ? totalWins / totalRuns : 0;
  const placeRate = totalRuns > 0 ? totalPlaces / totalRuns : 0;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Horse Profile</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Saved Horses
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  {horse.horse_name}
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Saved horse profile built from SmartPunt form history.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {profile.full_name || profile.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {horse.sex ? <Badge tone="blue">{horse.sex}</Badge> : null}
                {horse.age !== null && horse.age !== undefined ? (
                  <Badge tone="amber">{horse.age}yo</Badge>
                ) : null}
                <Badge tone="green">{totalRuns} runs</Badge>
                <Badge tone="blue">{totalWins} wins</Badge>
                <Badge tone="amber">{totalPlaces} places</Badge>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Recent form
                </p>
                <p className="mt-2 text-2xl font-bold tracking-wide text-white">
                  {recentFormLine}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">
                  SmartPunt Profile
                </p>
                <h2 className="mt-2 text-2xl font-black text-zinc-950">
                  {smartPuntProfile.primaryTag}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {smartPuntProfile.tags.map((tag) => (
                  <Badge key={tag} tone="amber">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="mt-5 max-w-4xl text-base font-semibold leading-7 text-zinc-800">
              {smartPuntProfile.summary}
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-800">
                  Strengths
                </p>
                <div className="mt-4 space-y-3">
                  {smartPuntProfile.strengths.map((item) => (
                    <p key={item} className="text-sm font-semibold leading-6 text-zinc-800">
                      ✓ {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">
                  Watch-outs
                </p>
                <div className="mt-4 space-y-3">
                  {smartPuntProfile.watchOuts.map((item) => (
                    <p key={item} className="text-sm font-semibold leading-6 text-zinc-800">
                      • {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Last 6 Form</p>
              <p className="mt-3 text-lg font-semibold">{recentFormLine}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Track Record</p>
              <p className="mt-3 text-lg font-semibold">{formatRecord(importedTrackSource)}</p>
              <p className="mt-1 text-xs text-zinc-500">{getRecordLabel(importedTrackSource)}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Distance Record</p>
              <p className="mt-3 text-lg font-semibold">{formatRecord(importedDistanceSource)}</p>
              <p className="mt-1 text-xs text-zinc-500">{getRecordLabel(importedDistanceSource)}</p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Best Condition</p>
              <p className="mt-3 text-lg font-semibold">
                {getBestCondition(horse)?.label || "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {getBestCondition(horse)
                  ? `${getBestCondition(horse)?.record.runs}:${getBestCondition(horse)?.record.wins},${getBestCondition(horse)?.record.seconds},${getBestCondition(horse)?.record.thirds}`
                  : "No exposed condition edge"}
              </p>
            </div>
          </Panel>
        </div>

<div className="mt-6 grid gap-4 md:grid-cols-6">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Horse Name</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{horse.horse_name}</p>
                <Badge tone="amber">Saved</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Horse Type</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{horse.sex || "—"}</p>
                <Badge tone="blue">Profile</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Age</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">
                  {horse.age !== null && horse.age !== undefined ? `${horse.age}yo` : "—"}
                </p>
                <Badge tone="amber">Profile</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Jockey</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.jockey_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Trainer</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.trainer_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>
            <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">
                SmartPunt Power Rating
              </p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">
                  {horse.smartpunt_power_rating ?? "N/A"}
                </p>
<Badge tone="green">Power</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {conditionRecordRows.map((row) => (
            <Panel key={row.label} className="bg-white/95">
              <div className="p-4 text-zinc-950">
                <p className="text-sm text-zinc-500">{row.label} Record</p>
                <p className="mt-3 text-lg font-semibold">
                  {row.runs}:{row.wins},{Math.max(0, row.places - row.wins)},0
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.runs} runs • {row.wins} wins • {row.places} places
                </p>
              </div>
            </Panel>
          ))}
        </div>
        <Panel className="mt-6 bg-white/95">
          <div className="p-6 text-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
                  Distance Range History
                </p>
                <h3 className="mt-2 text-xl font-black text-zinc-950">
                  How this horse has performed across distance bands
                </h3>
              </div>
              <Badge tone="amber">{distanceStats.length}</Badge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {distanceStats.map((row) => (
                <div
                  key={row.label}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-zinc-900">{row.label}</p>
                    <Badge tone="blue">
                      {row.runs}:{row.wins}-{row.places}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    {row.runs} runs • {row.wins} wins • {row.places} places
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
                Distance Intelligence
              </p>
              <h3 className="mt-2 text-2xl font-black text-zinc-950">
                {getRecordAssessment("Distance", parseImportedRecord(importedDistanceSource))}
              </h3>
              <p className="mt-4 text-sm font-semibold text-zinc-700">
                Record: {formatRecord(importedDistanceSource)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {getRecordLabel(importedDistanceSource)}
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
                    Track Intelligence
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-zinc-950">
                    Actual track history
                  </h3>
                </div>
                <Badge tone="amber">{horseTrackStats.length}</Badge>
              </div>

              <div className="mt-5 space-y-3">
                {horseTrackStats.length > 0 ? (
                  horseTrackStats.map((row) => {
                    const places = row.wins + row.seconds + row.thirds;
                    const placeRate = row.runs > 0 ? places / row.runs : 0;

                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-zinc-900">
                            {row.track_name}
                          </p>
                          <Badge tone={row.runs >= 5 && placeRate >= 0.5 ? "green" : "blue"}>
                            {row.runs}:{row.wins}-{row.seconds}-{row.thirds}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-zinc-600">
                          {row.runs} runs • {row.wins} wins • {places} places
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                    No actual track history saved yet.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Horse summary</h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Profile
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
{formatHorseMeta(horse) || profileStatus}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Normalised name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {horse.normalised_name || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Overall record
                  </p>
<p className="mt-2 text-sm font-semibold text-zinc-900">
  {totalRuns} runs • {totalWins} wins • {totalPlaces} places
</p>
<p className="mt-1 text-sm text-zinc-600">
  Win {formatPercent(winRate)} • Place {formatPercent(placeRate)}
</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Jockeys used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueJockeys.length > 0 ? (
                      uniqueJockeys.map((jockey) => (
                        <Badge key={jockey} tone="blue">
                          {jockey}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Trainers used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueTrainers.length > 0 ? (
                      uniqueTrainers.map((trainer) => (
                        <Badge key={trainer} tone="amber">
                          {trainer}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Runner history</h2>
                  <p className="text-sm text-zinc-500">
                    This is the saved in-app history for this horse from Race Builder.
                  </p>
                </div>
                <Badge tone="green">{enrichedRuns.length} records</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {enrichedRuns.length > 0 ? (
                  enrichedRuns.map((runner) => (
                    <div
                      key={runner.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-zinc-500">
                            {runner.meeting
                              ? `${runner.meeting.meeting_name} · ${runner.meeting.meeting_date}`
                              : "Unknown meeting"}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                            {runner.race
                              ? `R${runner.race.race_number} ${runner.race.race_name}`
                              : "Unknown race"}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {runner.race?.status ? (
                            <Badge tone={getRaceStatusTone(runner.race.status)}>
                              {runner.race.status}
                            </Badge>
                          ) : null}
                          {runner.race?.distance_m ? (
                            <Badge tone="blue">{runner.race.distance_m}m</Badge>
                          ) : null}
                          {runner.meeting?.track_condition ? (
                            <Badge tone="amber">{runner.meeting.track_condition}</Badge>
                          ) : null}
                          {runner.finishing_position !== null &&
                          runner.finishing_position !== undefined ? (
                            <Badge
                              tone={
                                runner.finishing_position === 1
                                  ? "green"
                                  : runner.finishing_position <= 3
                                    ? "blue"
                                    : "rose"
                              }
                            >
                              Fin: {runner.finishing_position}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Jockey
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.jockey_name || "—"}
                          </p>
                          {runner.is_apprentice ? (
                            <p className="mt-1 text-xs text-zinc-600">
                              Apprentice
                              {runner.apprentice_claim_kg !== null &&
                              runner.apprentice_claim_kg !== undefined
                                ? ` · -${runner.apprentice_claim_kg}kg`
                                : ""}
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Trainer
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.trainer_name || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Barrier / Weight
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.barrier ?? "—"} /{" "}
                            {runner.weight_kg !== null && runner.weight_kg !== undefined
                              ? `${runner.weight_kg}kg`
                              : "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Market
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.starting_price !== null && runner.starting_price !== undefined
                              ? `$${runner.starting_price}`
                              : runner.market_price !== null && runner.market_price !== undefined
                                ? `$${runner.market_price}`
                                : "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Settled
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {formatDate(runner.settled_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Last 6
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_6 || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Track form
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.track_form_last_6 || "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Distance form
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.distance_form_last_6 || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No runner history saved for this horse yet.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
