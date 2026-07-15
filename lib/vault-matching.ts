import { createClient } from "@/lib/supabase/server";

type VaultAlert = {
  id: number;
  user_id: string;
  alert_name: string;
  alert_type: string;
  horse_id: number | null;
  target_name: string;
  enabled: boolean;
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

export async function syncVaultNotifications({
  userId,
  liveData,
}: {
  userId: string;
  liveData: VaultLiveData;
}) {
  const supabase = await createClient();

  const { data: alertsData, error: alertsError } = await supabase
    .from("vault_alerts")
    .select(
      "id, user_id, alert_name, alert_type, horse_id, target_name, enabled",
    )
    .eq("user_id", userId);

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const alerts = (alertsData || []) as VaultAlert[];
  const enabledHorseAlerts = alerts.filter(
    (alert) =>
      alert.enabled === true &&
      alert.alert_type === "horse" &&
      Number(alert.horse_id) > 0,
  );

  const alertIds = uniqueNumbers(alerts.map((alert) => alert.id));

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
        if (race.status !== "published") return false;

        const meeting = meetingMap.get(Number(race.meeting_id));

        return meeting && validDates.has(String(meeting.meeting_date));
      })
      .map((race) => Number(race.id)),
  );

  const runnersByRaceId = new Map<number, any[]>();

  liveData.currentRunners.forEach((runner) => {
    const raceId = Number(runner.race_id);
    const existing = runnersByRaceId.get(raceId) || [];

    existing.push(runner);
    runnersByRaceId.set(raceId, existing);
  });

  const liveMatches: Array<{
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
  }> = [];

  enabledHorseAlerts.forEach((alert) => {
    liveData.currentRunners.forEach((runner) => {
      if (runner.scratched === true) return;
      if (!publishedRaceIds.has(Number(runner.race_id))) return;
      if (Number(runner.horse_id) !== Number(alert.horse_id)) return;

      const race = raceMap.get(Number(runner.race_id));
      if (!race) return;

      const meeting = meetingMap.get(Number(race.meeting_id));
      if (!meeting) return;

      const horse = horseMap.get(Number(runner.horse_id)) || null;
      const raceRunners =
        runnersByRaceId.get(Number(runner.race_id)) || [];

      liveMatches.push({
        alert,
        runner,
        race,
        meeting,
        horse,
        effectiveBarrier: getEffectiveBarrier(
          runner,
          raceRunners,
        ),
        matchedRules: [
          {
            type: "horse",
            label: "Horse in your Vault",
            value:
              horse?.horse_name ||
              alert.target_name ||
              "Saved horse",
          },
        ],
      });
    });
  });

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

  if (upsertRows.length > 0) {
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
    await supabase
      .from("vault_notifications")
      .select("id, alert_id, race_runner_id");

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

      return !liveMatchKeys.has(key);
    })
    .map((notification) => Number(notification.id))
    .filter(Boolean);

  if (staleNotificationIds.length > 0) {
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
