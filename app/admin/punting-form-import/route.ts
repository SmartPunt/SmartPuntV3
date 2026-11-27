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
      body.mode !== "validate" ||
      typeof body.meetingId !== "string" ||
      !/^[1-9]\d{0,17}$/.test(body.meetingId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only single-meeting validation is enabled",
        },
        { status: 400 }
      );
    }

    // Permanent writes are deliberately disabled.
    const result = await processPuntingFormMeeting(
      body.meetingId,
      true,
      actorId
    );

    return NextResponse.json(
      {
        ...result,
        automation_mode: "VALIDATION_ONLY",
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
      "Automation validation failed",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Automation validation failed",
      },
      { status: 500 }
    );
  }
}
