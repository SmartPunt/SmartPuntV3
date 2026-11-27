"use server";

import { getCurrentProfile, isRacingOpsAdmin } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { v2Rows } from "@/lib/v2-explorer";
import { translateMeeting } from "./translate";
import { attachEvidence } from "./evidence";

export async function validatePuntingFormMeeting(
  meetingId: string
) {
  return processPuntingFormMeeting(meetingId, true);
}

export async function importPuntingFormMeeting(
  meetingId: string
) {
  return processPuntingFormMeeting(meetingId, false);
}

async function processPuntingFormMeeting(
  meetingId: string,
  validateOnly: boolean
) {
  try {
    const profile = await getCurrentProfile();

if (!profile || !isRacingOpsAdmin(profile)) {
  throw new Error("Unauthorised");
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
  meeting_name: preview.meeting.meeting_name,
  meeting_date: preview.meeting.meeting_date,
  track_condition: condition,
  actor_id: profile.id,
};

    const racePayload = preview.races.map((race) => ({
      number: race.race.race_number,
      name: race.race.race_name,
      distance: race.race.distance_m,
      entries: race.runners_json_preview.map((runner) => ({
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
    }));

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

const { data, error } = await supabase.rpc(
  "smartpunt_import_draft_meeting",
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
    console.error("Punting Form validation failed", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Meeting validation failed",
    };
  }
}
