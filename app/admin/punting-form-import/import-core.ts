import "server-only";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { v2Rows } from "@/lib/v2-explorer";
import { translateMeeting } from "./translate";
import { attachEvidence } from "./evidence";

export async function processPuntingFormMeeting(
  meetingId: string,
  validateOnly: boolean,
  actorId: string,
  automated = false,
  scheduled = false
) {
  try {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actorId
      )
    ) {
      throw new Error("Invalid import actor");
    }

    if (!/^\d{1,18}$/.test(meetingId)) {
      throw new Error("Invalid meeting ID");
    }

    const meetings = await v2Rows("meetings", {
      filters: { meeting_id: meetingId },
      limit: 2,
    });

    if (meetings.length !== 1) {
      throw new Error("Meeting identity mismatch");
    }

    if (automated) {
      const meeting = meetings[0];

      const raw =
        typeof meeting.raw_record === "string"
          ? JSON.parse(meeting.raw_record)
          : meeting.raw_record;

      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw)
      ) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Missing meeting metadata"
        );
      }

      const metadata = raw as Record<string, unknown>;

      if (meeting.country !== "AUS") {
        throw new Error(
          "AUTOMATION_INELIGIBLE: International meeting"
        );
      }

      if (metadata.tabMeeting !== true) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Non-TAB or unverified meeting"
        );
      }

      if (metadata.isBarrierTrial !== false) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Barrier trial or unverified race type"
        );
      }

      if (metadata.isJumps !== false) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Jumps or unverified race type"
        );
      }

      const meetingDate =
        meeting.meeting_date instanceof Date
          ? meeting.meeting_date.toISOString().slice(0, 10)
          : String(meeting.meeting_date).slice(0, 10);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Invalid meeting date"
        );
      }

      const todayPerth = new Intl.DateTimeFormat(
        "sv-SE",
        {
          timeZone: "Australia/Perth",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).format(new Date());

      const horizon = new Date(
        `${todayPerth}T00:00:00Z`
      );

      horizon.setUTCDate(horizon.getUTCDate() + 4);

      const latestDate = horizon
        .toISOString()
        .slice(0, 10);

      if (meetingDate < "2026-11-29") {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Before automation cutover"
        );
      }

      if (meetingDate <= todayPerth) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Same-day or past meeting"
        );
      }

      if (meetingDate > latestDate) {
        throw new Error(
          "AUTOMATION_INELIGIBLE: Outside upcoming racing window"
        );
      }
    }

    const races = await v2Rows("races", {
      filters: { meeting_id: meetingId },
      order: "race_number.asc",
      limit: 51,
    });

    if (!races.length || races.length > 50) {
      throw new Error("Invalid race count");
    }

    const runners = [];

    for (const race of races) {
      const entries = await v2Rows("runners", {
        filters: { race_id: String(race.race_id) },
        order: "tab_number.asc",
        limit: 100,
      });

      if (!entries.length || entries.length >= 100) {
        throw new Error("Invalid runner count");
      }

      runners.push(...entries);
    }

    const base = translateMeeting(
      meetings[0],
      races,
      runners
    );

    const [scratchings, conditions] = await Promise.all(
      ["scratchings", "conditions"].map((endpoint) =>
        v2Rows("api_response_snapshots", {
          select: "endpoint,meeting_id,saved_at_utc,raw_response",
          filters: { endpoint },
          order: "saved_at_utc.desc,id.desc",
          limit: 1,
        })
      )
    );

    const preview = attachEvidence(
      base,
      scratchings[0],
      conditions[0]
    );

    if (
      !preview.meeting.scratchings_collected_utc ||
      !preview.meeting.conditions_collected_utc
    ) {
      throw new Error("Missing conditions or scratchings evidence");
    }

    if (preview.blockers.length > base.blockers.length) {
      throw new Error(
        preview.blockers.slice(base.blockers.length).join("; ")
      );
    }

    const condition = String(
      preview.meeting.track_condition ?? ""
    ).split(" ")[0];

    if (!["Good", "Soft", "Heavy", "Synthetic"].includes(condition)) {
      throw new Error("Unsupported or missing track condition");
    }

const now = Date.now();

if (!validateOnly) {
  const maxEvidenceAgeMs = 24 * 60 * 60 * 1000;

  for (const timestamp of [
    preview.meeting.scratchings_collected_utc,
    preview.meeting.conditions_collected_utc,
  ]) {
    const collected = Date.parse(String(timestamp));
    const age = now - collected;

    if (
      !Number.isFinite(collected) ||
      age < 0 ||
      age > maxEvidenceAgeMs
    ) {
      throw new Error(
        "Stored evidence is older than 24 hours or invalid. Refresh V2 evidence before importing."
      );
    }
  }
}

const meetingPayload = {
  pf_meeting_id: preview.meeting.provider_meeting_id,
  meeting_name: preview.meeting.meeting_name,
  meeting_date: preview.meeting.meeting_date,
  track_condition: condition,
  actor_id: actorId,
};

    const racePayload = preview.races.map((race) => {
      const ordinaryIds = new Map(
        race.provenance.map((entry) => [
          Number(entry.runner_number),
          String(entry.provider_runner_id),
        ])
      );

      const emergencyIds = new Map(
        race.emergency_provenance.map((entry) => [
          Number(entry.runner_number),
          String(entry.provider_runner_id),
        ])
      );

      const getProviderId = (
        identities: Map<number, string>,
        runnerNumber: number
      ) => {
        const id = identities.get(Number(runnerNumber));

        if (!id || !/^[1-9]\d{0,17}$/.test(id)) {
          throw new Error(
            `Missing provider identity for race ${
              race.race.race_number
            }, runner ${runnerNumber}`
          );
        }

        return id;
      };

      return {
        pf_race_id: race.race.provider_race_id,
        number: race.race.race_number,
        name: race.race.race_name,
        distance: race.race.distance_m,

        entries: race.runners_json_preview.map((runner) => ({
          pf_runner_id: getProviderId(
            ordinaryIds,
            runner.runner_number
          ),
          name: runner.horse_name,
          number: runner.runner_number,
          barrier: Number(runner.barrier),
          weight: Number(runner.weight_kg),
          claim: Number(runner.apprentice_claim_kg),
          apprentice: Boolean(runner.is_apprentice),
          jockey: runner.jockey_name,
          trainer: runner.trainer_name,
          form: runner.form_last_6,
          track: runner.track_form_last_6,
          distance: runner.distance_form_last_6,
          good: runner.good_track_record,
          soft: runner.soft_track_record,
          heavy: runner.heavy_track_record,
          synthetic: runner.synthetic_track_record,
          prize:
            runner.prize_money === ""
              ? null
              : Number(runner.prize_money),
          scratched:
            runner.scratching_status_preview ===
            "SCRATCHED (snapshot)",
          emergency: false,
        })),

        emergencies: race.emergency_runners_preview.map(
          (runner) => ({
            pf_runner_id: getProviderId(
              emergencyIds,
              runner.runner_number
            ),
            name: runner.horse_name,
            number: runner.runner_number,
            scratched:
              runner.scratching_status_preview ===
              "SCRATCHED (snapshot)",
            emergency: true,
          })
        ),
      };
    });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("V1 backend database connection not configured");
}

if (
  new URL(url).hostname !==
  "fmjzbtnvusbzmdwxzxlu.supabase.co"
) {
  throw new Error("Unexpected V1 database destination");
}

const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

if (scheduled && !validateOnly) {
  const {
    data: checked,
    error: checkError,
  } = await supabase.rpc(
    "smartpunt_import_mapped_meeting",
    {
      p_meeting: meetingPayload,
      p_races: racePayload,
      p_validate_only: true,
    }
  );

  if (checkError) {
    throw new Error(checkError.message);
  }

  if (
    !checked ||
    checked.mode !== "VALIDATION_ONLY" ||
    checked.mapping_mode !== "VALIDATION_ONLY" ||
    checked.records_created !== 0 ||
    checked.meeting_id !== null ||
    checked.existing_races !== 0 ||
    checked.missing_races !== racePayload.length ||
    checked.proposed_new_runners !==
      racePayload.reduce(
        (total, race) => total + race.entries.length,
        0
      )
  ) {
    throw new Error(
      "Scheduled creation refused: meeting is not a completely new validated meeting"
    );
  }
}

const { data, error } = await supabase.rpc(
  "smartpunt_import_mapped_meeting",
  {
    p_meeting: meetingPayload,
    p_races: racePayload,
    p_validate_only: validateOnly,
  }
);

    if (error) {
      throw new Error(error.message);
    }

if (!validateOnly) {
  revalidatePath("/admin/race-builder");
  revalidatePath("/admin/calculator");
  revalidatePath("/admin/punting-form-import");
}

return {
  success: true,
  result: data,
};
  } catch (error) {
console.error("Punting Form import processing failed", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Meeting validation failed",
    };
  }
}
