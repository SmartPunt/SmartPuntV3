import { createClient } from "@/lib/supabase/server";

export const VAULT_INTELLIGENCE_VERSION = 1;

type VaultIntelligenceMatch = {
  runner: {
    id: number;
    horse_id: number | null;
    jockey_name?: string | null;
  };
  race: {
    id: number;
    distance_m?: number | null;
  };
  meeting: {
    id: number;
    meeting_name?: string | null;
    meeting_date?: string | null;
    track_condition?: string | null;
  };
};

type HistoricalRunner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  finishing_position: number | null;
  scratched: boolean | null;
};

type HistoricalRace = {
  id: number;
  meeting_id: number;
  distance_m: number | null;
};

type HistoricalMeeting = {
  id: number;
  meeting_name: string | null;
  meeting_date: string | null;
  track_condition: string | null;
};

type HistoricalRun = {
  runner: HistoricalRunner;
  race: HistoricalRace;
  meeting: HistoricalMeeting;
};

type EvidenceStats = {
  starts: number;
  wins: number;
  places: number;
  winRate: number;
  placeRate: number;
};

function normaliseText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getConditionBucket(condition: unknown) {
  const value = normaliseText(condition);

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  if (value.startsWith("synthetic")) return "Synthetic";

  return null;
}

function toPositiveNumber(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

function calculateStats(runs: HistoricalRun[]): EvidenceStats {
  const starts = runs.length;

  const wins = runs.filter(
    (run) => Number(run.runner.finishing_position) === 1,
  ).length;

  const places = runs.filter((run) => {
    const position = Number(run.runner.finishing_position);

    return (
      Number.isFinite(position) &&
      position >= 1 &&
      position <= 3
    );
  }).length;

  return {
    starts,
    wins,
    places,
    winRate:
      starts > 0
        ? Number(((wins / starts) * 100).toFixed(1))
        : 0,
    placeRate:
      starts > 0
        ? Number(((places / starts) * 100).toFixed(1))
        : 0,
  };
}

function buildContextSignature(match: VaultIntelligenceMatch) {
  return [
    Number(match.race.id),
    Number(match.runner.id),
    Number(match.runner.horse_id),
    normaliseText(match.meeting.meeting_name),
    String(match.meeting.meeting_date || ""),
    toPositiveNumber(match.race.distance_m) ?? "",
    getConditionBucket(match.meeting.track_condition) || "",
    normaliseText(match.runner.jockey_name),
  ].join("|");
}

function getStoredContextSignature(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return typeof record.contextSignature === "string"
    ? record.contextSignature
    : null;
}

function uniquePositiveNumbers(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0,
        ),
    ),
  );
}

export async function ensureVaultIntelligenceSnapshots(
  matches: VaultIntelligenceMatch[],
) {
  if (!matches.length) {
    return;
  }

  /*
   * Vault Intelligence is generated only from the authoritative
   * event/admin-side Vault workflow.
   *
   * Subscriber-facing requests must only read stored snapshots.
   *
   * This function does NOT call the SmartPunt Calculator and does
   * not alter Calculator predictions, scoring or settlement.
   */

  const uniqueMatches = Array.from(
    new Map(
      matches
        .filter(
          (match) =>
            Number(match.runner?.id) > 0 &&
            Number(match.runner?.horse_id) > 0 &&
            Number(match.race?.id) > 0 &&
            Boolean(match.meeting?.meeting_date),
        )
        .map((match) => [
          Number(match.runner.id),
          match,
        ]),
    ).values(),
  );

  if (!uniqueMatches.length) {
    return;
  }

  const supabase = await createClient();

  const raceRunnerIds = uniquePositiveNumbers(
    uniqueMatches.map((match) => match.runner.id),
  );

  const { data: existingSnapshots, error: existingError } =
    await supabase
      .from("vault_intelligence_snapshots")
      .select(
        "race_id, race_runner_id, intelligence, version",
      )
      .in("race_runner_id", raceRunnerIds);

  if (existingError) {
    throw new Error(
      existingError.message ||
        "Could not read Vault Intelligence snapshots.",
    );
  }

  const existingByRunnerId = new Map(
    (existingSnapshots || []).map((snapshot) => [
      Number(snapshot.race_runner_id),
      snapshot,
    ]),
  );

  /*
   * Only regenerate when:
   * - there is no snapshot yet;
   * - the intelligence version changed; or
   * - today's relevant race context changed, such as jockey,
   *   condition, track or distance.
   */
  const matchesToGenerate = uniqueMatches.filter((match) => {
    const existing = existingByRunnerId.get(
      Number(match.runner.id),
    );

    if (!existing) {
      return true;
    }

    if (
      Number(existing.version) !==
      VAULT_INTELLIGENCE_VERSION
    ) {
      return true;
    }

    const currentSignature =
      buildContextSignature(match);

    const storedSignature =
      getStoredContextSignature(
        existing.intelligence,
      );

    return storedSignature !== currentSignature;
  });

  if (!matchesToGenerate.length) {
    return;
  }

  const horseIds = uniquePositiveNumbers(
    matchesToGenerate.map(
      (match) => match.runner.horse_id,
    ),
  );

  /*
   * Load only resulted historical runner records for horses that
   * actually need a new/refreshed Vault Intelligence snapshot.
   */
  const { data: runnerRows, error: runnerError } =
    await supabase
      .from("race_runners")
      .select(
        "id, race_id, horse_id, jockey_name, finishing_position, scratched",
      )
      .in("horse_id", horseIds)
      .not("finishing_position", "is", null);

  if (runnerError) {
    throw new Error(
      runnerError.message ||
        "Could not load Vault horse history.",
    );
  }

  const historicalRunners = (runnerRows || [])
    .map(
      (runner): HistoricalRunner => ({
        id: Number(runner.id),
        race_id: Number(runner.race_id),
        horse_id: Number(runner.horse_id),
        jockey_name: runner.jockey_name
          ? String(runner.jockey_name)
          : null,
        finishing_position:
          runner.finishing_position !== null &&
          runner.finishing_position !== undefined &&
          Number.isFinite(
            Number(runner.finishing_position),
          )
            ? Number(runner.finishing_position)
            : null,
        scratched: runner.scratched === true,
      }),
    )
    .filter(
      (runner) =>
        runner.race_id > 0 &&
        runner.horse_id > 0 &&
        runner.finishing_position !== null &&
        runner.finishing_position > 0 &&
        runner.scratched !== true,
    );

  const historicalRaceIds = uniquePositiveNumbers(
    historicalRunners.map(
      (runner) => runner.race_id,
    ),
  );

  if (!historicalRaceIds.length) {
    await writeEmptySnapshots(
      supabase,
      matchesToGenerate,
    );

    return;
  }

  const { data: raceRows, error: raceError } =
    await supabase
      .from("races")
      .select("id, meeting_id, distance_m")
      .in("id", historicalRaceIds);

  if (raceError) {
    throw new Error(
      raceError.message ||
        "Could not load Vault race history.",
    );
  }

  const historicalRaces = (raceRows || [])
    .map(
      (race): HistoricalRace => ({
        id: Number(race.id),
        meeting_id: Number(race.meeting_id),
        distance_m:
          race.distance_m !== null &&
          race.distance_m !== undefined &&
          Number.isFinite(Number(race.distance_m))
            ? Number(race.distance_m)
            : null,
      }),
    )
    .filter(
      (race) =>
        race.id > 0 &&
        race.meeting_id > 0,
    );

  const historicalMeetingIds =
    uniquePositiveNumbers(
      historicalRaces.map(
        (race) => race.meeting_id,
      ),
    );

  if (!historicalMeetingIds.length) {
    await writeEmptySnapshots(
      supabase,
      matchesToGenerate,
    );

    return;
  }

  const { data: meetingRows, error: meetingError } =
    await supabase
      .from("meetings")
      .select(
        "id, meeting_name, meeting_date, track_condition",
      )
      .in("id", historicalMeetingIds);

  if (meetingError) {
    throw new Error(
      meetingError.message ||
        "Could not load Vault meeting history.",
    );
  }

  const meetingMap = new Map<number, HistoricalMeeting>(
    (meetingRows || []).map((meeting) => [
      Number(meeting.id),
      {
        id: Number(meeting.id),
        meeting_name: meeting.meeting_name
          ? String(meeting.meeting_name)
          : null,
        meeting_date: meeting.meeting_date
          ? String(meeting.meeting_date)
          : null,
        track_condition: meeting.track_condition
          ? String(meeting.track_condition)
          : null,
      },
    ]),
  );

  const raceMap = new Map<number, HistoricalRace>(
    historicalRaces.map((race) => [
      race.id,
      race,
    ]),
  );

  const historyByHorseId = new Map<
    number,
    HistoricalRun[]
  >();

  historicalRunners.forEach((runner) => {
    const race = raceMap.get(runner.race_id);

    if (!race) {
      return;
    }

    const meeting = meetingMap.get(
      race.meeting_id,
    );

    if (!meeting?.meeting_date) {
      return;
    }

    const existing =
      historyByHorseId.get(runner.horse_id) ||
      [];

    existing.push({
      runner,
      race,
      meeting,
    });

    historyByHorseId.set(
      runner.horse_id,
      existing,
    );
  });

  const now = new Date().toISOString();

  const snapshotRows = matchesToGenerate.map(
    (match) => {
      const horseId = Number(
        match.runner.horse_id,
      );

      const raceDate = String(
        match.meeting.meeting_date,
      );

      /*
       * Critical integrity rule:
       *
       * Only meetings BEFORE the current race date are eligible.
       * Same-day earlier results are deliberately excluded so a
       * horse's Vault Intelligence cannot change during race day
       * because another race has just been resulted.
       */
      const history = (
        historyByHorseId.get(horseId) || []
      )
        .filter(
          (run) =>
            Boolean(run.meeting.meeting_date) &&
            String(run.meeting.meeting_date) <
              raceDate &&
            Number(run.runner.id) !==
              Number(match.runner.id),
        )
        .sort((a, b) =>
          String(b.meeting.meeting_date).localeCompare(
            String(a.meeting.meeting_date),
          ),
        );

      const currentTrack = normaliseText(
        match.meeting.meeting_name,
      );

      const currentDistance =
        toPositiveNumber(
          match.race.distance_m,
        );

      const currentCondition =
        getConditionBucket(
          match.meeting.track_condition,
        );

      const currentJockey = normaliseText(
        match.runner.jockey_name,
      );

      const trackRuns = currentTrack
        ? history.filter(
            (run) =>
              normaliseText(
                run.meeting.meeting_name,
              ) === currentTrack,
          )
        : [];

      const distanceRuns =
        currentDistance !== null
          ? history.filter(
              (run) =>
                Number(run.race.distance_m) ===
                currentDistance,
            )
          : [];

      const courseDistanceRuns =
        currentTrack &&
        currentDistance !== null
          ? history.filter(
              (run) =>
                normaliseText(
                  run.meeting.meeting_name,
                ) === currentTrack &&
                Number(run.race.distance_m) ===
                  currentDistance,
            )
          : [];

      const conditionRuns =
        currentCondition
          ? history.filter(
              (run) =>
                getConditionBucket(
                  run.meeting.track_condition,
                ) === currentCondition,
            )
          : [];

      const jockeyRuns = currentJockey
        ? history.filter(
            (run) =>
              normaliseText(
                run.runner.jockey_name,
              ) === currentJockey,
          )
        : [];

      const recentForm = history
        .slice(0, 5)
        .map((run) => ({
          meetingDate:
            run.meeting.meeting_date,
          track:
            run.meeting.meeting_name,
          distanceM:
            run.race.distance_m,
          jockey:
            run.runner.jockey_name,
          finishingPosition:
            run.runner.finishing_position,
        }));

      const intelligence = {
        version:
          VAULT_INTELLIGENCE_VERSION,

        contextSignature:
          buildContextSignature(match),

        today: {
          meetingName:
            match.meeting.meeting_name ||
            null,
          meetingDate:
            match.meeting.meeting_date ||
            null,
          distanceM:
            currentDistance,
          trackCondition:
            match.meeting.track_condition ||
            null,
          conditionBucket:
            currentCondition,
          jockeyName:
            match.runner.jockey_name ||
            null,
        },

        evidence: {
          courseDistance:
            calculateStats(
              courseDistanceRuns,
            ),
          track:
            calculateStats(trackRuns),
          distance:
            calculateStats(distanceRuns),
          condition:
            calculateStats(conditionRuns),
          jockey:
            calculateStats(jockeyRuns),
        },

        recentForm,

        totalHistoricalStarts:
          history.length,

        source:
          "smartpunt_resulted_history",
      };

      return {
        race_id: Number(match.race.id),
        race_runner_id: Number(
          match.runner.id,
        ),
        horse_id: horseId,
        intelligence,
        version:
          VAULT_INTELLIGENCE_VERSION,
        generated_at: now,
        updated_at: now,
      };
    },
  );

  const { error: upsertError } =
    await supabase
      .from("vault_intelligence_snapshots")
      .upsert(snapshotRows, {
        onConflict: "race_id,race_runner_id",
        ignoreDuplicates: false,
      });

  if (upsertError) {
    throw new Error(
      upsertError.message ||
        "Could not save Vault Intelligence snapshots.",
    );
  }
}

async function writeEmptySnapshots(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  matches: VaultIntelligenceMatch[],
) {
  const now = new Date().toISOString();

  const rows = matches.map((match) => ({
    race_id: Number(match.race.id),
    race_runner_id: Number(
      match.runner.id,
    ),
    horse_id: Number(
      match.runner.horse_id,
    ),
    intelligence: {
      version:
        VAULT_INTELLIGENCE_VERSION,

      contextSignature:
        buildContextSignature(match),

      today: {
        meetingName:
          match.meeting.meeting_name ||
          null,
        meetingDate:
          match.meeting.meeting_date ||
          null,
        distanceM:
          toPositiveNumber(
            match.race.distance_m,
          ),
        trackCondition:
          match.meeting.track_condition ||
          null,
        conditionBucket:
          getConditionBucket(
            match.meeting.track_condition,
          ),
        jockeyName:
          match.runner.jockey_name ||
          null,
      },

      evidence: {
        courseDistance:
          calculateStats([]),
        track:
          calculateStats([]),
        distance:
          calculateStats([]),
        condition:
          calculateStats([]),
        jockey:
          calculateStats([]),
      },

      recentForm: [],
      totalHistoricalStarts: 0,
      source:
        "smartpunt_resulted_history",
    },
    version:
      VAULT_INTELLIGENCE_VERSION,
    generated_at: now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("vault_intelligence_snapshots")
    .upsert(rows, {
      onConflict: "race_id,race_runner_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(
      error.message ||
        "Could not save empty Vault Intelligence snapshots.",
    );
  }
}
