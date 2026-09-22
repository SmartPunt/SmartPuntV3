export const VAULT_INTELLIGENCE_VERSION = 2;

type VaultIntelligenceMatch = {
  runner: {
    id: number;
    horse_id: number | null;
    jockey_name?: string | null;
    barrier?: number | null;
    weight_kg?: number | null;
    apprentice_claim_kg?: number | null;
    track_form_last_6?: string | null;
    distance_form_last_6?: string | null;
    import_good_record?: string | null;
    import_soft_record?: string | null;
    import_heavy_record?: string | null;
    import_synthetic_record?: string | null;
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

function parseImportedEvidenceStats(
  value: unknown,
): EvidenceStats | null {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const match = raw.match(
    /^(\d+)\s*:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/,
  );

  if (!match) {
    return null;
  }

  const starts = Number(match[1]);
  const wins = Number(match[2]);
  const seconds = Number(match[3]);
  const thirds = Number(match[4]);

  if (
    !Number.isFinite(starts) ||
    !Number.isFinite(wins) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(thirds) ||
    starts < 0 ||
    wins < 0 ||
    seconds < 0 ||
    thirds < 0
  ) {
    return null;
  }

  const places = wins + seconds + thirds;

  if (
    wins > starts ||
    places > starts
  ) {
    return null;
  }

  return {
    starts,
    wins,
    places,
    winRate:
      starts > 0
        ? Number(
            ((wins / starts) * 100).toFixed(1),
          )
        : 0,
    placeRate:
      starts > 0
        ? Number(
            ((places / starts) * 100).toFixed(1),
          )
        : 0,
  };
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
type RaceRelativeEvidenceStatus =
  | "positive"
  | "neutral"
  | "risk";

function getRaceRelativeEvidenceStatus(
  score: unknown,
): RaceRelativeEvidenceStatus | null {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return null;
  }

  if (numericScore >= 65) {
    return "positive";
  }

  if (numericScore >= 50) {
    return "neutral";
  }

  return "risk";
}

function toFiniteNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}
type VaultCalculatorPrediction = {
  race_id: number;
  runner_id: number;
  barrier_score: number | null;
  weight_score: number | null;
};

function buildRaceRelativeEvidence(
  match: VaultIntelligenceMatch,
  calculatorPrediction?: VaultCalculatorPrediction | null,
) {
  const barrierScore = toFiniteNumber(
    calculatorPrediction?.barrier_score,
  );

  const weightScore = toFiniteNumber(
    calculatorPrediction?.weight_score,
  );

  const barrier =
    toFiniteNumber(match.runner.barrier);

  const listedWeightKg =
    toFiniteNumber(match.runner.weight_kg);

  const apprenticeClaimKg =
    toFiniteNumber(
      match.runner.apprentice_claim_kg,
    );

  const effectiveWeightKg =
    listedWeightKg !== null
      ? Number(
          (
            listedWeightKg -
            (apprenticeClaimKg ?? 0)
          ).toFixed(1),
        )
      : null;

  return {
    barrier: {
      barrier,
      score: barrierScore,
      status:
        getRaceRelativeEvidenceStatus(
          barrierScore,
        ),
    },

    weight: {
      listedWeightKg,
      apprenticeClaimKg,
      effectiveWeightKg,
      score: weightScore,
      status:
        getRaceRelativeEvidenceStatus(
          weightScore,
        ),
    },
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
    toFiniteNumber(match.runner.barrier) ?? "",
    toFiniteNumber(match.runner.weight_kg) ?? "",
    toFiniteNumber(match.runner.apprentice_claim_kg) ?? "",
    String(match.runner.track_form_last_6 || ""),
    String(match.runner.distance_form_last_6 || ""),
    String(match.runner.import_good_record || ""),
    String(match.runner.import_soft_record || ""),
    String(match.runner.import_heavy_record || ""),
    String(match.runner.import_synthetic_record || ""),
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

/*
 * VAULT INTELLIGENCE SERVICE-ROLE ACCESS
 *
 * Vault Intelligence is generated by trusted admin/event-side work.
 * It must never depend on the subscriber's authenticated Supabase
 * session and must never require subscriber write access through RLS.
 *
 * Subscriber pages only read previously generated snapshots.
 */
function getVaultIntelligenceServiceRoleConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration for Vault Intelligence.",
    );
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
}

async function vaultIntelligenceServiceRoleFetch(
  path: string,
  init?: RequestInit,
) {
  const { supabaseUrl, headers } =
    getVaultIntelligenceServiceRoleConfig();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      message ||
        `Vault Intelligence service-role request failed for ${path}.`,
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

async function vaultIntelligenceServiceRoleSelect(
  path: string,
) {
  return vaultIntelligenceServiceRoleFetch(
    path,
    {
      method: "GET",
    },
  );
}

function buildInFilter(values: number[]) {
  return `in.(${values.join(",")})`;
}

async function upsertVaultIntelligenceRows(
  rows: unknown[],
) {
  if (!rows.length) {
    return;
  }

  await vaultIntelligenceServiceRoleFetch(
    "vault_intelligence_snapshots?on_conflict=race_id,race_runner_id",
    {
      method: "POST",
      headers: {
        Prefer:
          "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
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

  const raceRunnerIds = uniquePositiveNumbers(
    uniqueMatches.map((match) => match.runner.id),
  );

  const existingSnapshots =
    (await vaultIntelligenceServiceRoleSelect(
      `vault_intelligence_snapshots?select=race_id,race_runner_id,intelligence,version` +
        `&race_runner_id=${buildInFilter(
          raceRunnerIds,
        )}`,
    )) as Array<{
      race_id: number;
      race_runner_id: number;
      intelligence: unknown;
      version: number | null;
    }> | null;

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
   * Barrier and weight must use the frozen pre-race Calculator
   * component assessment already released for this runner.
   *
   * Vault Intelligence must never call or rerun Calculator scoring.
   */
  const calculatorPredictionRows =
    (await vaultIntelligenceServiceRoleSelect(
      `calculator_predictions?select=race_id,runner_id,barrier_score,weight_score` +
        `&runner_id=${buildInFilter(
          raceRunnerIds,
        )}`,
    )) as
      | VaultCalculatorPrediction[]
      | null;

  const calculatorPredictionByRunnerId =
    new Map(
      (calculatorPredictionRows || []).map(
        (prediction) => [
          Number(prediction.runner_id),
          prediction,
        ],
      ),
    );

  /*
   * Load only resulted historical runner records for horses that
   * actually need a new/refreshed Vault Intelligence snapshot.
   */
  const runnerRows =
    (await vaultIntelligenceServiceRoleSelect(
      `race_runners?select=id,race_id,horse_id,jockey_name,finishing_position,scratched` +
        `&horse_id=${buildInFilter(
          horseIds,
        )}` +
        `&finishing_position=not.is.null`,
    )) as HistoricalRunner[] | null;

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
      matchesToGenerate,
      calculatorPredictionByRunnerId,
    );

    return;
  }

  const raceRows =
    (await vaultIntelligenceServiceRoleSelect(
      `races?select=id,meeting_id,distance_m` +
        `&id=${buildInFilter(
          historicalRaceIds,
        )}`,
    )) as HistoricalRace[] | null;

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
      matchesToGenerate,
      calculatorPredictionByRunnerId,
    );

    return;
  }

  const meetingRows =
    (await vaultIntelligenceServiceRoleSelect(
      `meetings?select=id,meeting_name,meeting_date,track_condition` +
        `&id=${buildInFilter(
          historicalMeetingIds,
        )}`,
    )) as HistoricalMeeting[] | null;

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

      const calculatorPrediction =
        calculatorPredictionByRunnerId.get(
          Number(match.runner.id),
        );

      const raceRelativeEvidence =
        buildRaceRelativeEvidence(
          match,
          calculatorPrediction,
        );

      const importedTrackStats =
        parseImportedEvidenceStats(
          match.runner.track_form_last_6,
        );

      const importedDistanceStats =
        parseImportedEvidenceStats(
          match.runner.distance_form_last_6,
        );

      const importedConditionRecord =
        currentCondition === "Good"
          ? match.runner.import_good_record
          : currentCondition === "Soft"
            ? match.runner.import_soft_record
            : currentCondition === "Heavy"
              ? match.runner.import_heavy_record
              : currentCondition === "Synthetic"
                ? match.runner.import_synthetic_record
                : null;

      const importedConditionStats =
        parseImportedEvidenceStats(
          importedConditionRecord,
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

          /*
           * Track, distance and condition use the broader
           * pre-race imported career records when available.
           *
           * These records were stored on this race_runner at
           * import time, so they represent the evidence that
           * was available for this particular race.
           *
           * SmartPunt run-level history remains the fallback
           * when an imported record is unavailable or invalid.
           */
          track:
            importedTrackStats ??
            calculateStats(trackRuns),

          distance:
            importedDistanceStats ??
            calculateStats(distanceRuns),

          condition:
            importedConditionStats ??
            calculateStats(conditionRuns),

          /*
           * Jockey combination remains based on SmartPunt's
           * actual recorded run-level history because there is
           * no equivalent imported horse/jockey career record.
           */
          jockey:
            calculateStats(jockeyRuns),
        },

        recentForm,

        /*
         * Today's Barrier and Weight assessments come from the
         * already-released Calculator prediction.
         *
         * The factual runner values are included only so the
         * subscriber explanation can show what was assessed.
         */
        raceRelativeEvidence,

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

  await upsertVaultIntelligenceRows(
    snapshotRows,
  );
}

async function writeEmptySnapshots(
  matches: VaultIntelligenceMatch[],
  calculatorPredictionByRunnerId: Map<
    number,
    VaultCalculatorPrediction
  >,
) {
  const now = new Date().toISOString();

  const rows = matches.map((match) => {
    const calculatorPrediction =
      calculatorPredictionByRunnerId.get(
        Number(match.runner.id),
      );

    const raceRelativeEvidence =
      buildRaceRelativeEvidence(
        match,
        calculatorPrediction,
      );

    return {
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

      /*
       * Even when SmartPunt has no resulted history for this horse,
       * today's frozen Calculator Barrier and Weight assessments
       * remain useful Vault evidence.
       */
      raceRelativeEvidence,

      totalHistoricalStarts: 0,
      source:
        "smartpunt_resulted_history",
    },
    version:
      VAULT_INTELLIGENCE_VERSION,
    generated_at: now,
    updated_at: now,
    };
  });

  await upsertVaultIntelligenceRows(
    rows,
  );
}

/*
 * SUBSCRIBER READ-ONLY VAULT INTELLIGENCE
 *
 * Vault Intelligence is generated by trusted admin/event-side work.
 *
 * Subscriber-facing requests may use this helper to read the already
 * generated snapshots for the specific race runners currently matched
 * in that subscriber's Vault.
 *
 * IMPORTANT:
 * - this does not generate or refresh intelligence;
 * - this does not inspect historical race data;
 * - this does not call the SmartPunt Calculator;
 * - this does not write to the database;
 * - this does not alter settlement or Calculator predictions.
 */
export async function loadVaultIntelligenceSnapshots(
  raceRunnerIds: number[],
) {
  const uniqueRunnerIds =
    uniquePositiveNumbers(raceRunnerIds);

  if (!uniqueRunnerIds.length) {
    return [];
  }

  const rows =
    (await vaultIntelligenceServiceRoleSelect(
      `vault_intelligence_snapshots?select=id,race_id,race_runner_id,horse_id,intelligence,version,generated_at` +
        `&race_runner_id=${buildInFilter(
          uniqueRunnerIds,
        )}`,
    )) as
      | Array<{
          id: number;
          race_id: number;
          race_runner_id: number;
          horse_id: number;
          intelligence: unknown;
          version: number | null;
          generated_at: string | null;
        }>
      | null;

  return rows || [];
}
