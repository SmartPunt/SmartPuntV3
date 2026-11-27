"use server";

import {
  getCurrentProfile,
  isRacingOpsAdmin,
} from "@/lib/auth";

import {
  processPuntingFormMeeting,
} from "./import-core";

async function runAuthorisedImport(
  meetingId: string,
  validateOnly: boolean
) {
  try {
    const profile = await getCurrentProfile();

    if (!profile || !isRacingOpsAdmin(profile)) {
      return {
        success: false,
        error: "Unauthorised",
      };
    }

    return await processPuntingFormMeeting(
      meetingId,
      validateOnly,
      profile.id
    );
  } catch (error) {
    console.error(
      "Punting Form authorisation failed",
      error
    );

    return {
      success: false,
      error: "Unable to authorise import",
    };
  }
}

export async function validatePuntingFormMeeting(
  meetingId: string
) {
  return runAuthorisedImport(meetingId, true);
}

export async function importPuntingFormMeeting(
  meetingId: string
) {
  return runAuthorisedImport(meetingId, false);
}
