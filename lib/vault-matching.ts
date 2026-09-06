import { createClient } from "@/lib/supabase/server";

type VaultAlert = {
  id: number;
  user_id: string;
  alert_name: string;
  alert_type: string;
  horse_id: number | null;
  target_name: string;
  enabled: boolean;
  jockey_names: string[];
  trainer_names: string[];
  track_names: string[];
  distance_buckets: string[];
  track_conditions: string[];
  min_effective_barrier: number | null;
  max_effective_barrier: number | null;
};

type VaultLiveData = {
  dayDates: {
    today: string;
    tomorrow: string;
  };
  currentMeetings: any[];
  currentRaces: any[];
  currentRunners: any[];
  horses: any[];
};

export type VaultLiveMatch = {
  notificationId: number;
  alertId: number;
  alertName: string;
  raceId: number;
  raceRunnerId: number;
  horseId: number;
  horseName: string;
  runnerNumber: number | null;
  meetingName: string;
  meetingDate: string;
  raceNumber: number;
  raceName: string;
  distanceM: number | null;
  trackCondition: string | null;
  jockeyName: string | null;
  trainerName: string | null;
  barrier: number | null;
  effectiveBarrier: number | null;
  matchedRules: Array<{
    type: string;
    label: string;
    value: string;
  }>;
  seen: boolean;
};

function uniqueNumbers(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}
function normaliseText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getDistanceBucket(distance: unknown) {
  const value = Number(distance);

  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 1000) return "800–999m";
  if (value <= 1200) return "1000–1200m";
  if (value <= 1400) return "1201–1400m";
  if (value <= 1600) return "1401–1600m";
  if (value <= 1800) return "1601–1800m";
  if (value <= 2200) return "1801–2200m";

  return "2201m+";
}

function getConditionBucket(condition: unknown) {
  const value = normaliseText(condition);

  if (value.startsWith("good")) return "Good";
  if (value.startsWith("soft")) return "Soft";
  if (value.startsWith("heavy")) return "Heavy";
  if (value.startsWith("synthetic")) return "Synthetic";

  return null;
}

function matchesNamedRule(
  selectedValues: string[] | null | undefined,
  actualValue: unknown,
) {
  if (!selectedValues?.length) return true;

  const actual = normaliseText(actualValue);

  return selectedValues.some(
    (value) => normaliseText(value) === actual,
  );
}
function getEffectiveBarrier(runner: any, raceRunners: any[]) {
  const originalBarrier = Number(runner?.barrier);

  if (!Number.isFinite(originalBarrier) || originalBarrier <= 0) {
    return null;
  }

  const scratchingsInside = raceRunners.filter((item) => {
    if (item?.scratched !== true) return false;

    const itemBarrier = Number(item?.barrier);

    return (
      Number.isFinite(itemBarrier) &&
      itemBarrier > 0 &&
      itemBarrier < originalBarrier
    );
  }).length;

  return Math.max(1, originalBarrier - scratchingsInside);
}

export type VaultMatchedAlert = {
  alert: VaultAlert;
  runner: any;
  race: any;
  meeting: any;
  horse: any;
  effectiveBarrier: number | null;
  matchedRules: Array<{
    type: string;
    label: string;
    value: string;
  }>;
};

export function findVaultLiveMatches({
  alerts,
  liveData,
}: {
  alerts: VaultAlert[];
  liveData: VaultLiveData;
}): VaultMatchedAlert[] {
  const enabledHorseAlerts = alerts.filter(
    (alert) =>
      alert.enabled === true &&
      alert.alert_type === "horse" &&
      Number(alert.horse_id) > 0,
  );

  const meetingMap = new Map(
    liveData.currentMeetings.map((meeting) => [
      Number(meeting.id),
      meeting,
    ]),
  );

  const raceMap = new Map(
    liveData.currentRaces.map((race) => [
      Number(race.id),
      race,
    ]),
  );

  const horseMap = new Map(
    liveData.horses.map((horse) => [
      Number(horse.id),
      horse,
    ]),
  );

  const validDates = new Set([
    liveData.dayDates.today,
    liveData.dayDates.tomorrow,
  ]);

  const publishedRaceIds = new Set(
    liveData.currentRaces
      .filter((race) => {
        if (race.status !== "published") {
          return false;
        }

        const meeting = meetingMap.get(
          Number(race.meeting_id),
        );

        return (
          meeting &&
          validDates.has(
            String(meeting.meeting_date),
          )
        );
      })
      .map((race) => Number(race.id)),
  );

  const runnersByRaceId = new Map<
    number,
    any[]
  >();

  liveData.currentRunners.forEach(
    (runner) => {
      const raceId = Number(
        runner.race_id,
      );

      const existing =
        runnersByRaceId.get(raceId) || [];

      existing.push(runner);

      runnersByRaceId.set(
        raceId,
        existing,
      );
    },
  );

  const liveMatches: VaultMatchedAlert[] =
    [];

  enabledHorseAlerts.forEach((alert) => {
    liveData.currentRunners.forEach(
      (runner) => {
        if (runner.scratched === true) {
          return;
        }

        if (
          !publishedRaceIds.has(
            Number(runner.race_id),
          )
        ) {
          return;
        }

        if (
          Number(runner.horse_id) !==
          Number(alert.horse_id)
        ) {
          return;
        }

        const race = raceMap.get(
          Number(runner.race_id),
        );

        if (!race) {
          return;
        }

        const meeting = meetingMap.get(
          Number(race.meeting_id),
        );

        if (!meeting) {
          return;
        }

        const horse =
          horseMap.get(
            Number(runner.horse_id),
          ) || null;

        const raceRunners =
          runnersByRaceId.get(
            Number(runner.race_id),
          ) || [];

        const effectiveBarrier =
          getEffectiveBarrier(
            runner,
            raceRunners,
          );

        const distanceBucket =
          getDistanceBucket(
            race.distance_m,
          );

        const conditionBucket =
          getConditionBucket(
            meeting.track_condition,
          );

        if (
          !matchesNamedRule(
            alert.track_names,
            meeting.meeting_name,
          )
        ) {
          return;
        }

        if (
          !matchesNamedRule(
            alert.jockey_names,
            runner.jockey_name,
          )
        ) {
          return;
        }

        if (
          !matchesNamedRule(
            alert.trainer_names,
            runner.trainer_name,
          )
        ) {
          return;
        }

        if (
          alert.distance_buckets?.length &&
          (
            !distanceBucket ||
            !alert.distance_buckets.includes(
              distanceBucket,
            )
          )
        ) {
          return;
        }

        if (
          alert.track_conditions?.length &&
          (
            !conditionBucket ||
            !alert.track_conditions.includes(
              conditionBucket,
            )
          )
        ) {
          return;
        }

        if (
          alert.min_effective_barrier !==
            null &&
          alert.min_effective_barrier !==
            undefined &&
          (
            effectiveBarrier === null ||
            effectiveBarrier <
              Number(
                alert.min_effective_barrier,
              )
          )
        ) {
          return;
        }

        if (
          alert.max_effective_barrier !==
            null &&
          alert.max_effective_barrier !==
            undefined &&
          (
            effectiveBarrier === null ||
            effectiveBarrier >
              Number(
                alert.max_effective_barrier,
              )
          )
        ) {
          return;
        }

        const matchedRules = [
          {
            type: "horse",
            label: "Horse",
            value:
              horse?.horse_name ||
              alert.target_name ||
              "Saved horse",
          },
        ];

        if (alert.track_names?.length) {
          matchedRules.push({
            type: "track",
            label: "Track",
            value:
              meeting.meeting_name,
          });
        }

        if (
          alert.distance_buckets?.length &&
          distanceBucket
        ) {
          matchedRules.push({
            type: "distance",
            label: "Distance",
            value: distanceBucket,
          });
        }

        if (
          alert.track_conditions?.length &&
          conditionBucket
        ) {
          matchedRules.push({
            type: "condition",
            label: "Condition",
            value: conditionBucket,
          });
        }

        if (alert.jockey_names?.length) {
          matchedRules.push({
            type: "jockey",
            label: "Jockey",
            value:
              runner.jockey_name ||
              "Unknown",
          });
        }

        if (
          alert.trainer_names?.length
        ) {
          matchedRules.push({
            type: "trainer",
            label: "Trainer",
            value:
              runner.trainer_name ||
              "Unknown",
          });
        }

        if (
          alert.min_effective_barrier !==
            null ||
          alert.max_effective_barrier !==
            null
        ) {
          matchedRules.push({
            type: "effective_barrier",
            label: "Effective barrier",
            value: String(
              effectiveBarrier,
            ),
          });
        }

        liveMatches.push({
          alert,
          runner,
          race,
          meeting,
          horse,
          effectiveBarrier,
          matchedRules,
        });
      },
    );
  });

  return liveMatches;
}

export async function syncVaultNotifications({
  userId,
  liveData,
  performSync = true,
}: {
  userId: string;
  liveData: VaultLiveData;
  performSync?: boolean;
}) {
  const supabase = await createClient();

  const { data: alertsData, error: alertsError } = await supabase
    .from("vault_alerts")
.select(
  "id, user_id, alert_name, alert_type, horse_id, target_name, enabled, jockey_names, trainer_names, track_names, distance_buckets, track_conditions, min_effective_barrier, max_effective_barrier",
)
    .eq("user_id", userId);

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const alerts = (alertsData || []) as VaultAlert[];

  const alertIds = uniqueNumbers(
    alerts.map((alert) => alert.id),
  );

  /*
   * Shared authoritative Vault matcher.
   *
   * syncVaultNotifications and future admin-side
   * Race Day processing must use exactly the same
   * matching rules so subscriber notifications can
   * never disagree with The Vault itself.
   */
  /*
   * Subscriber-facing pages may use this function in
   * read-only mode.
   *
   * When performSync is false we deliberately DO NOT:
   * - evaluate Vault rules;
   * - create/update Vault matches;
   * - delete stale Vault matches.
   *
   * The page simply reads the matches already created
   * by the authoritative admin/event-side workflow.
   */
  const liveMatches =
    performSync
      ? findVaultLiveMatches({
          alerts,
          liveData,
        })
      : [];

  /*
   * These lookup maps are still required below for:
   * - safe stale-match cleanup;
   * - rebuilding the subscriber-facing Vault match
   *   objects from stored vault_notifications.
   */
  const meetingMap = new Map(
    liveData.currentMeetings.map((meeting) => [
      Number(meeting.id),
      meeting,
    ]),
  );

  const raceMap = new Map(
    liveData.currentRaces.map((race) => [
      Number(race.id),
      race,
    ]),
  );

  const horseMap = new Map(
    liveData.horses.map((horse) => [
      Number(horse.id),
      horse,
    ]),
  );

  const validDates = new Set([
    liveData.dayDates.today,
    liveData.dayDates.tomorrow,
  ]);

  const runnersByRaceId = new Map<
    number,
    any[]
  >();

  liveData.currentRunners.forEach(
    (runner) => {
      const raceId = Number(
        runner.race_id,
      );

      const existing =
        runnersByRaceId.get(raceId) || [];

      existing.push(runner);

      runnersByRaceId.set(
        raceId,
        existing,
      );
    },
  );


  const now = new Date().toISOString();

  const upsertRows = liveMatches.map((match) => ({
    alert_id: match.alert.id,
    race_id: match.race.id,
    race_runner_id: match.runner.id,
    horse_id: match.runner.horse_id,
    meeting_date: match.meeting.meeting_date,
    matched_rules: match.matchedRules,
    last_matched_at: now,
    updated_at: now,
  }));

  if (performSync && upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("vault_notifications")
      .upsert(upsertRows, {
        onConflict: "alert_id,race_runner_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

const { data: existingNotifications, error: existingError } =
  alertIds.length
    ? await supabase
        .from("vault_notifications")
        .select(
          "id, alert_id, race_id, race_runner_id, meeting_date",
        )
        .in("alert_id", alertIds)
    : {
        data: [],
        error: null,
      };

  if (existingError) {
    throw new Error(existingError.message);
  }

  const liveMatchKeys = new Set(
    liveMatches.map(
      (match) =>
        `${Number(match.alert.id)}:${Number(match.runner.id)}`,
    ),
  );

  const staleNotificationIds = (existingNotifications || [])
    .filter((notification) => {
      const key = `${Number(notification.alert_id)}:${Number(
        notification.race_runner_id,
      )}`;

      /*
       * If this notification still matches the live race program,
       * it is not stale.
       */
      if (liveMatchKeys.has(key)) {
        return false;
      }

      const race = raceMap.get(
        Number(notification.race_id),
      );

      /*
       * Never delete a stored Vault match simply because its race
       * has been resulted/closed or has moved out of the current
       * live race program.
       *
       * These stored notifications are the lightweight historical
       * record used by Subscriber Live Picks.
       */
      if (!race) {
        return false;
      }

      const meeting = meetingMap.get(
        Number(race.meeting_id),
      );

      if (!meeting) {
        return false;
      }

      const isCurrentLiveRace =
        race.status === "published" &&
        validDates.has(
          String(meeting.meeting_date),
        );

      /*
       * Only clean up a notification when the race is STILL live
       * and the horse no longer satisfies the subscriber's Vault
       * rules — for example after a scratching, jockey change,
       * condition change or another legitimate pre-race update.
       *
       * Once the race is no longer live, preserve the match.
       */
      return isCurrentLiveRace;
    })
    .map((notification) => Number(notification.id))
    .filter(Boolean);

  if (
    performSync &&
    staleNotificationIds.length > 0
  ) {
    const { error: deleteError } = await supabase
      .from("vault_notifications")
      .delete()
      .in("id", staleNotificationIds);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (!alertIds.length) {
    return {
      liveMatchCount: 0,
      matches: [] as VaultLiveMatch[],
    };
  }

  const { data: notificationRows, error: notificationError } =
    await supabase
      .from("vault_notifications")
      .select(
        "id, alert_id, race_id, race_runner_id, horse_id, meeting_date, matched_rules, seen",
      )
      .in("alert_id", alertIds)
      .order("meeting_date", { ascending: true })
      .order("first_matched_at", { ascending: true });

  if (notificationError) {
    throw new Error(notificationError.message);
  }

  const alertMap = new Map(
    alerts.map((alert) => [Number(alert.id), alert]),
  );

  const matches = (notificationRows || [])
    .map((notification): VaultLiveMatch | null => {
      const alert = alertMap.get(Number(notification.alert_id));
      const runner = liveData.currentRunners.find(
        (item) =>
          Number(item.id) ===
          Number(notification.race_runner_id),
      );

      const race = raceMap.get(Number(notification.race_id));

      if (!alert || !runner || !race) {
        return null;
      }

      const meeting = meetingMap.get(Number(race.meeting_id));
      const horse = horseMap.get(Number(runner.horse_id));

      if (!meeting) return null;

      const raceRunners =
        runnersByRaceId.get(Number(race.id)) || [];

      return {
        notificationId: Number(notification.id),
        alertId: Number(alert.id),
        alertName: alert.alert_name,
        raceId: Number(race.id),
        raceRunnerId: Number(runner.id),
        horseId: Number(runner.horse_id),
        horseName:
          horse?.horse_name ||
          alert.target_name ||
          "Saved horse",
        runnerNumber:
          runner.runner_number !== null &&
          runner.runner_number !== undefined
            ? Number(runner.runner_number)
            : null,
        meetingName:
          meeting.meeting_name || "Meeting",
        meetingDate: String(meeting.meeting_date),
        raceNumber: Number(race.race_number || 0),
        raceName: race.race_name || "Race",
        distanceM:
          race.distance_m !== null &&
          race.distance_m !== undefined
            ? Number(race.distance_m)
            : null,
        trackCondition:
          meeting.track_condition || null,
        jockeyName: runner.jockey_name || null,
        trainerName: runner.trainer_name || null,
        barrier:
          runner.barrier !== null &&
          runner.barrier !== undefined
            ? Number(runner.barrier)
            : null,
        effectiveBarrier: getEffectiveBarrier(
          runner,
          raceRunners,
        ),
        matchedRules: Array.isArray(notification.matched_rules)
          ? notification.matched_rules
          : [],
        seen: notification.seen === true,
      };
    })
    .filter(
      (match): match is VaultLiveMatch =>
        match !== null,
    );

  return {
    liveMatchCount: matches.length,
    matches,
  };
}
