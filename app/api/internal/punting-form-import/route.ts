import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

import {
  processPuntingFormMeeting,
} from "@/app/admin/punting-form-import/import-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret =
    process.env.SMARTPUNT_V1_AUTOMATION_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const supplied =
    request.headers.get("authorization") ?? "";

  const expected = `Bearer ${secret}`;

  const suppliedHash = createHash("sha256")
    .update(supplied)
    .digest();

  const expectedHash = createHash("sha256")
    .update(expected)
    .digest();

  return timingSafeEqual(
    suppliedHash,
    expectedHash
  );
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorised",
      },
      { status: 401 }
    );
  }

  const actorId =
    process.env.SMARTPUNT_V1_AUTOMATION_ACTOR_ID;

  if (!actorId) {
    return NextResponse.json(
      {
        success: false,
        error: "Automation actor not configured",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !["validate", "import"].includes(body.mode) ||
      typeof body.meetingId !== "string" ||
      !/^[1-9]\d{0,17}$/.test(body.meetingId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid automation request",
        },
        { status: 400 }
      );
    }

    const validateOnly = body.mode === "validate";

    if (!validateOnly) {
      const allowedMeetingId =
        process.env.SMARTPUNT_V1_ALLOWED_IMPORT_MEETING_ID;

      if (
        !allowedMeetingId ||
        allowedMeetingId !== body.meetingId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Permanent automated import is not authorised for this meeting",
          },
          { status: 400 }
        );
      }

      if (
        body.confirmation !==
        "CREATE_DRAFT_RACES_ONLY"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Permanent import confirmation missing",
          },
          { status: 400 }
        );
      }
    }

    const result = await processPuntingFormMeeting(
      body.meetingId,
      validateOnly,
      actorId
    );

    return NextResponse.json(
      {
        ...result,
        automation_mode: validateOnly
          ? "VALIDATION_ONLY"
          : "CONTROLLED_DRAFT_IMPORT",
        provider_meeting_id: body.meetingId,
      },
      {
        status: result.success ? 200 : 422,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Automation request failed",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Automation request failed",
      },
      { status: 500 }
    );
  }
}
