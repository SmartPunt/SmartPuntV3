"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

async function requireAdmin() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new Error("Unauthorized");
  }

  return profile;
}

function getServiceRoleHeaders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration in environment variables.");
  }

  return {
    supabaseUrl,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type}`);
    return Number(value);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function zonedDateTimeToUtcIso(
  raceDate: string,
  raceTime: string,
  timeZone: string,
): string | null {
  if (!raceDate || !raceTime || !timeZone) return null;

  const [year, month, day] = raceDate.split("-").map(Number);
  const [hour, minute] = raceTime.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcGuess = desiredLocalAsUtc;

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utcGuess), timeZone);
    const zonedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    const diff = desiredLocalAsUtc - zonedAsUtc;
    utcGuess += diff;

    if (diff === 0) break;
  }

  return new Date(utcGuess).toISOString();
}

async function sendSuggestedTipNotifications({
  race,
  horse,
  type,
  confidence,
  note,
  commentary,
}: {
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string;
  commentary: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.SMARTPUNT_APP_URL || "";

  if (!resendApiKey || !fromEmail) return;

  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "user")
    .eq("status", "active");

  const recipients = (profiles || [])
    .map((p: any) => String(p.email || "").trim())
    .filter(Boolean);

  if (!recipients.length) return;

  const subject = `🔥 ${horse} – ${race}`;
  const preview = commentary?.trim() || `${horse} has been tipped.`;

  const html = (email: string) => `
    <style>
      @media only screen and (max-width: 600px) {
        .fo5-logo {
          height: 540px !important;
        }
      }
    </style>

    <div style="background:#0a0a0a;padding:30px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#111111;border-radius:20px;overflow:hidden;border:1px solid rgba(251,191,36,0.15);">

        <div style="padding:24px;text-align:center;border-bottom:1px solid rgba(251,191,36,0.10);">
          ${
            appUrl
              ? `<img src="${appUrl}/header-logo.png" class="fo5-logo" style="height:180px;width:auto;display:block;margin:0 auto;" />`
              : ""
          }
        </div>

        <div style="padding:24px;color:#ffffff;">
          <div style="color:#a1a1aa;font-size:13px;">${race}</div>

          <div style="font-size:28px;font-weight:700;margin-top:4px;">
            ${horse}
          </div>

          <div style="margin-top:16px;">
            <span style="background:#052e16;color:#86efac;padding:6px 10px;border-radius:999px;font-size:12px;margin-right:6px;">
              ${type}
            </span>
            <span style="background:#082f49;color:#7dd3fc;padding:6px 10px;border-radius:999px;font-size:12px;">
              ${confidence}
            </span>
          </div>

          <div style="margin-top:20px;background:#18181b;border-radius:16px;padding:18px;">
            ${preview}
          </div>

          ${
            appUrl
              ? `<div style="margin-top:24px;">
                  <a href="${appUrl}" style="background:#000;color:#fbbf24;padding:12px 18px;border-radius:12px;text-decoration:none;">
                    View Full Tips
                  </a>
                </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      recipients.map((email) => ({
        from: fromEmail,
        to: [email],
        subject,
        html: html(email),
      })),
    ),
  });
}
