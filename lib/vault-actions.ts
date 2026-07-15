"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type VaultHorseSearchResult = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
};

export type VaultActionResult = {
  success: boolean;
  error: string | null;
  message?: string;
};
export type VaultEditableAlert = {
  id: number;
  alert_name: string;
  alert_type: string;
  target_name: string;
  horse_id: number | null;
  enabled: boolean;
  jockey_names: string[];
  trainer_names: string[];
  track_names: string[];
  distance_buckets: string[];
  track_conditions: string[];
  min_effective_barrier: number | null;
  max_effective_barrier: number | null;
};
export type VaultPickerType = "track" | "jockey" | "trainer";

export type VaultPickerResult = {
  value: string;
  isCurrent: boolean;
};
async function requireVaultSubscriber() {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    profile.role !== "user" ||
    profile.status !== "active"
  ) {
    throw new Error("Unauthorized");
  }

  return profile;
}

function cleanSearchTerm(value: string) {
  return String(value || "")
    .trim()
    .replace(/[%_]/g, "")
    .slice(0, 80);
}
function cleanStringArray(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

function cleanOptionalBarrier(value: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 1 ||
    numberValue > 30
  ) {
    return null;
  }

  return numberValue;
}
function getPerthDate(offsetDays = 0) {
  const perthParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(
    perthParts.find((part) => part.type === "year")?.value,
  );
  const month = Number(
    perthParts.find((part) => part.type === "month")?.value,
  );
  const day = Number(
    perthParts.find((part) => part.type === "day")?.value,
  );

  const calendarDate = new Date(
    Date.UTC(year, month - 1, day + offsetDays, 12),
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(calendarDate);
}

function normalisePickerValue(value: unknown) {
  return String(value || "").trim();
}

function uniquePickerValues(values: unknown[]) {
  const seen = new Set<string>();
  const results: string[] = [];

  values.forEach((value) => {
    const cleaned = normalisePickerValue(value);
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) return;

    seen.add(key);
    results.push(cleaned);
  });

  return results;
}

function rankPickerResults({
  values,
  currentValues,
  searchTerm,
}: {
  values: string[];
  currentValues: Set<string>;
  searchTerm: string;
}) {
  const search = searchTerm.toLowerCase();

  return [...values].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const aExact = aLower === search ? 1 : 0;
    const bExact = bLower === search ? 1 : 0;

    if (aExact !== bExact) {
      return bExact - aExact;
    }

    const aStarts = aLower.startsWith(search) ? 1 : 0;
    const bStarts = bLower.startsWith(search) ? 1 : 0;

    if (aStarts !== bStarts) {
      return bStarts - aStarts;
    }

    const aCurrent = currentValues.has(aLower) ? 1 : 0;
    const bCurrent = currentValues.has(bLower) ? 1 : 0;

    if (aCurrent !== bCurrent) {
      return bCurrent - aCurrent;
    }

    return a.localeCompare(b);
  });
}
export async function searchVaultHorsesAction(
  searchTerm: string,
): Promise<VaultHorseSearchResult[]> {
  await requireVaultSubscriber();

  const cleanedSearch = cleanSearchTerm(searchTerm);

  if (cleanedSearch.length < 2) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("horses")
    .select("id, horse_name, normalised_name, sex, age")
    .ilike("horse_name", `%${cleanedSearch}%`)
    .order("horse_name", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(error.message || "Could not search horses.");
  }

  return (data || []).map((horse) => ({
    id: Number(horse.id),
    horse_name: String(horse.horse_name || ""),
    normalised_name: String(horse.normalised_name || ""),
    sex: horse.sex ? String(horse.sex) : null,
    age:
      horse.age !== null &&
      horse.age !== undefined &&
      Number.isFinite(Number(horse.age))
        ? Number(horse.age)
        : null,
  }));
}

export async function addHorseToVaultAction({
  horseId,
  alertName,
}: {
  horseId: number;
  alertName?: string;
}): Promise<VaultActionResult> {
  try {
    const profile = await requireVaultSubscriber();
    const supabase = await createClient();

    const numericHorseId = Number(horseId);

    if (!numericHorseId || !Number.isFinite(numericHorseId)) {
      return {
        success: false,
        error: "Choose a valid horse.",
      };
    }

    const { data: horse, error: horseError } = await supabase
      .from("horses")
      .select("id, horse_name")
      .eq("id", numericHorseId)
      .maybeSingle();

    if (horseError) {
      return {
        success: false,
        error: horseError.message,
      };
    }

    if (!horse) {
      return {
        success: false,
        error: "That horse could not be found.",
      };
    }

    const { data: existingAlert, error: duplicateError } =
      await supabase
        .from("vault_alerts")
        .select("id, enabled")
        .eq("user_id", profile.id)
        .eq("alert_type", "horse")
        .eq("horse_id", numericHorseId)
        .maybeSingle();

    if (duplicateError) {
      return {
        success: false,
        error: duplicateError.message,
      };
    }

    if (existingAlert) {
      if (existingAlert.enabled === false) {
        const { error: enableError } = await supabase
          .from("vault_alerts")
          .update({
            enabled: true,
          })
          .eq("id", existingAlert.id)
          .eq("user_id", profile.id);

        if (enableError) {
          return {
            success: false,
            error: enableError.message,
          };
        }

        revalidatePath("/the-vault");
        revalidatePath("/subscriber-dashboard");

        return {
          success: true,
          error: null,
          message: `${horse.horse_name} has been returned to your Vault.`,
        };
      }

      return {
        success: false,
        error: `${horse.horse_name} is already in your Vault.`,
      };
    }

    const cleanedAlertName =
      String(alertName || "").trim().slice(0, 120) ||
      `${horse.horse_name} Alert`;

    const { error: insertError } = await supabase
      .from("vault_alerts")
      .insert({
        user_id: profile.id,
        alert_name: cleanedAlertName,
        alert_type: "horse",
        horse_id: numericHorseId,
        target_name: horse.horse_name,
        enabled: true,
      });

    if (insertError) {
      return {
        success: false,
        error: insertError.message,
      };
    }

    revalidatePath("/the-vault");
    revalidatePath("/subscriber-dashboard");

    return {
      success: true,
      error: null,
      message: `${horse.horse_name} has been added to your Vault.`,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not add this horse to your Vault.",
    };
  }
}
export async function updateVaultAlertRulesAction({
  alertId,
  alertName,
  trackNames,
  jockeyNames,
  trainerNames,
  distanceBuckets,
  trackConditions,
  minEffectiveBarrier,
  maxEffectiveBarrier,
}: {
  alertId: number;
  alertName: string;
  trackNames: string[];
  jockeyNames: string[];
  trainerNames: string[];
  distanceBuckets: string[];
  trackConditions: string[];
  minEffectiveBarrier: number | null;
  maxEffectiveBarrier: number | null;
}): Promise<VaultActionResult> {
  try {
    const profile = await requireVaultSubscriber();
    const supabase = await createClient();

    const numericAlertId = Number(alertId);
    const cleanedMinimum = cleanOptionalBarrier(
      minEffectiveBarrier,
    );
    const cleanedMaximum = cleanOptionalBarrier(
      maxEffectiveBarrier,
    );

    if (!numericAlertId || !Number.isFinite(numericAlertId)) {
      return {
        success: false,
        error: "Invalid Vault alert.",
      };
    }

    if (
      cleanedMinimum !== null &&
      cleanedMaximum !== null &&
      cleanedMinimum > cleanedMaximum
    ) {
      return {
        success: false,
        error:
          "Minimum effective barrier cannot exceed the maximum.",
      };
    }

    const { error } = await supabase
      .from("vault_alerts")
      .update({
        alert_name:
          String(alertName || "").trim().slice(0, 120) ||
          "Vault Alert",
        track_names: cleanStringArray(trackNames),
        jockey_names: cleanStringArray(jockeyNames),
        trainer_names: cleanStringArray(trainerNames),
        distance_buckets: cleanStringArray(distanceBuckets),
        track_conditions: cleanStringArray(trackConditions),
        min_effective_barrier: cleanedMinimum,
        max_effective_barrier: cleanedMaximum,
      })
      .eq("id", numericAlertId)
      .eq("user_id", profile.id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath("/the-vault");
    revalidatePath("/subscriber-dashboard");

    return {
      success: true,
      error: null,
      message: "Vault rules saved.",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save Vault rules.",
    };
  }
}

export async function toggleVaultAlertAction({
  alertId,
  enabled,
}: {
  alertId: number;
  enabled: boolean;
}): Promise<VaultActionResult> {
  try {
    const profile = await requireVaultSubscriber();
    const supabase = await createClient();

    const numericAlertId = Number(alertId);

    if (!numericAlertId || !Number.isFinite(numericAlertId)) {
      return {
        success: false,
        error: "Invalid Vault alert.",
      };
    }

    const { error } = await supabase
      .from("vault_alerts")
      .update({ enabled })
      .eq("id", numericAlertId)
      .eq("user_id", profile.id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath("/the-vault");
    revalidatePath("/subscriber-dashboard");

    return {
      success: true,
      error: null,
      message: enabled
        ? "Vault alert resumed."
        : "Vault alert paused.",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update Vault alert.",
    };
  }
}

export async function deleteVaultAlertAction({
  alertId,
}: {
  alertId: number;
}): Promise<VaultActionResult> {
  try {
    const profile = await requireVaultSubscriber();
    const supabase = await createClient();

    const numericAlertId = Number(alertId);

    if (!numericAlertId || !Number.isFinite(numericAlertId)) {
      return {
        success: false,
        error: "Invalid Vault alert.",
      };
    }

    const { error } = await supabase
      .from("vault_alerts")
      .delete()
      .eq("id", numericAlertId)
      .eq("user_id", profile.id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath("/the-vault");
    revalidatePath("/subscriber-dashboard");

    return {
      success: true,
      error: null,
      message: "Vault alert deleted.",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not delete Vault alert.",
    };
  }
}
export async function searchVaultPickerOptionsAction({
  pickerType,
  searchTerm,
}: {
  pickerType: VaultPickerType;
  searchTerm: string;
}): Promise<VaultPickerResult[]> {
  await requireVaultSubscriber();

  const cleanedSearch = cleanSearchTerm(searchTerm);

  if (cleanedSearch.length < 2) {
    return [];
  }

  const supabase = await createClient();

  const today = getPerthDate(0);
  const tomorrow = getPerthDate(1);

  if (pickerType === "track") {
    const [historyQuery, currentQuery] = await Promise.all([
      supabase
        .from("meetings")
        .select("meeting_name, meeting_date")
        .ilike("meeting_name", `%${cleanedSearch}%`)
        .order("meeting_date", { ascending: false })
        .limit(250),

      supabase
        .from("meetings")
        .select("meeting_name")
        .in("meeting_date", [today, tomorrow])
        .ilike("meeting_name", `%${cleanedSearch}%`)
        .limit(100),
    ]);

    if (historyQuery.error) {
      throw new Error(
        historyQuery.error.message ||
          "Could not search tracks.",
      );
    }

    if (currentQuery.error) {
      throw new Error(
        currentQuery.error.message ||
          "Could not search current tracks.",
      );
    }

    const currentValues = new Set(
      uniquePickerValues(
        (currentQuery.data || []).map(
          (row) => row.meeting_name,
        ),
      ).map((value) => value.toLowerCase()),
    );

    const values = uniquePickerValues(
      (historyQuery.data || []).map(
        (row) => row.meeting_name,
      ),
    );

    return rankPickerResults({
      values,
      currentValues,
      searchTerm: cleanedSearch,
    })
      .slice(0, 20)
      .map((value) => ({
        value,
        isCurrent: currentValues.has(value.toLowerCase()),
      }));
  }

  const column =
    pickerType === "jockey"
      ? "jockey_name"
      : "trainer_name";

  const { data: historyRows, error: historyError } =
    await supabase
      .from("race_runners")
      .select(`${column}, updated_at`)
      .ilike(column, `%${cleanedSearch}%`)
      .not(column, "is", null)
      .order("updated_at", { ascending: false })
      .limit(500);

  if (historyError) {
    throw new Error(
      historyError.message ||
        `Could not search ${pickerType}s.`,
    );
  }

  const { data: currentMeetings, error: meetingError } =
    await supabase
      .from("meetings")
      .select("id")
      .in("meeting_date", [today, tomorrow]);

  if (meetingError) {
    throw new Error(meetingError.message);
  }

  const meetingIds = (currentMeetings || [])
    .map((meeting) => Number(meeting.id))
    .filter(Boolean);

  let currentValues = new Set<string>();

  if (meetingIds.length > 0) {
    const { data: currentRaces, error: raceError } =
      await supabase
        .from("races")
        .select("id")
        .eq("status", "published")
        .in("meeting_id", meetingIds);

    if (raceError) {
      throw new Error(raceError.message);
    }

    const raceIds = (currentRaces || [])
      .map((race) => Number(race.id))
      .filter(Boolean);

    if (raceIds.length > 0) {
      const { data: currentRows, error: currentError } =
        await supabase
          .from("race_runners")
          .select(column)
          .in("race_id", raceIds)
          .ilike(column, `%${cleanedSearch}%`)
          .not(column, "is", null)
          .limit(300);

      if (currentError) {
        throw new Error(currentError.message);
      }

      const typedCurrentRows = (currentRows || []) as unknown as Array<
        Record<string, unknown>
      >;

      currentValues = new Set(
        uniquePickerValues(
          typedCurrentRows.map((row) => row[column]),
        ).map((value) => value.toLowerCase()),
      );
    }
  }

  const typedHistoryRows = (historyRows || []) as unknown as Array<
    Record<string, unknown>
  >;

  const values = uniquePickerValues(
    typedHistoryRows.map((row) => row[column]),
  );
  return rankPickerResults({
    values,
    currentValues,
    searchTerm: cleanedSearch,
  })
    .slice(0, 20)
    .map((value) => ({
      value,
      isCurrent: currentValues.has(value.toLowerCase()),
    }));
}
