"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type ActionResult = {
  success: boolean;
  error: string | null;
};

async function requireAdmin() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new Error("Unauthorized");
  }

  return profile;
}

async function requireRacingAdmin() {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !["admin", "staff_admin"].includes(profile.role) ||
    profile.status !== "active"
  ) {
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

async function serviceRoleFetch(path: string, init?: RequestInit) {
  const { supabaseUrl, headers } = getServiceRoleHeaders();

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Service role request failed for ${path}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

async function serviceRoleSelect(path: string) {
  return serviceRoleFetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}

async function serviceRolePatch(path: string, body: Record<string, unknown>) {
  await serviceRoleFetch(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function serviceRoleDelete(path: string) {
  await serviceRoleFetch(path, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
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

function normaliseHorseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function normaliseImportedForm(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^0-9xX]/g, "")
    .split("")
    .reverse()
    .slice(0, 6)
    .join("");
}

function updateFormStringWithResult(
  existingForm: string | null,
  finishingPosition: number,
) {
  const cleanedExisting = String(existingForm || "")
    .trim()
    .replace(/[^0-9]/g, "");

  const current = cleanedExisting.split("").filter(Boolean);

  const updated = [String(finishingPosition), ...current];

  return updated.slice(0, 6).join("");
}
function updateStatRecordWithResult(
  existingRecord: string | null,
  finishingPosition: number,
) {
  const cleaned = String(existingRecord || "").trim();
  const match = cleaned.match(/^(\d+):(\d+),(\d+),(\d+)$/);

  const runs = match ? Number(match[1]) : 0;
  const wins = match ? Number(match[2]) : 0;
  const seconds = match ? Number(match[3]) : 0;
  const thirds = match ? Number(match[4]) : 0;

  const nextRuns = runs + 1;
  const nextWins = wins + (finishingPosition === 1 ? 1 : 0);
  const nextSeconds = seconds + (finishingPosition === 2 ? 1 : 0);
  const nextThirds = thirds + (finishingPosition === 3 ? 1 : 0);

  return `${nextRuns}:${nextWins},${nextSeconds},${nextThirds}`;
}

function normaliseText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInFilter(values: number[]) {
  return `in.(${values.join(",")})`;
}

function getBaseAppUrl() {
  return String(process.env.SMARTPUNT_APP_URL || "").trim().replace(/\/+$/, "");
}

function getHeaderLogoUrl() {
  const appUrl = getBaseAppUrl();
  return appUrl ? `${appUrl}/header-logo.png` : "";
}

function buildEmailHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const logoUrl = getHeaderLogoUrl();

  return `
    <div style="padding: 18px 20px 14px; background: linear-gradient(135deg, #171717, #3f3f46, #ca8a04); color: white;">
      ${
        logoUrl
          ? `
            <div style="margin: 0 0 14px; text-align: center;">
              <img
                src="${logoUrl}"
                alt="SmartPunt"
                style="display: block; width: 100%; max-width: 600px; height: auto; margin: 0 auto;"
              />
            </div>
          `
          : ""
      }
      <div style="font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 0.8;">
        ${eyebrow}
      </div>
      <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.2;">
        ${title}
      </h1>
      ${
        subtitle
          ? `<p style="margin: 10px 0 0; opacity: 0.9;">${subtitle}</p>`
          : ""
      }
    </div>
  `;
}

function buildEmailShell({
  headerHtml,
  bodyHtml,
}: {
  headerHtml: string;
  bodyHtml: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #111827;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
        ${headerHtml}
        <div style="padding: 24px;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

function buildViewInSmartPuntButton() {
  const appUrl = getBaseAppUrl();

  if (!appUrl) return "";

  return `
    <div style="margin-top: 24px;">
      <a href="${appUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#fbbf24;text-decoration:none;font-weight:700;">
        View in SmartPunt
      </a>
    </div>
  `;
}

async function getActiveSubscriberEmails() {
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "user")
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to load subscriber emails: ${error.message}`);
  }

  return (profiles || [])
    .map((profile: any) => String(profile.email || "").trim())
    .filter(Boolean);
}

async function sendBatchEmails(
  emails: Array<{
    from: string;
    to: string[];
    subject: string;
    html: string;
  }>,
) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !emails.length) return;

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send notification emails: ${errorText}`);
    }
  }
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
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `New SmartPunt Tip: ${race} - ${horse}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "New Tip Just Dropped",
        subtitle: "Premium racing club alert",
      }),
      bodyHtml: `
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${race}</p>
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${horse}</h2>

        <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfccb;color:#166534;font-size:12px;font-weight:700;">${type}</span>
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:700;">${confidence} confidence</span>
          ${
            note
              ? `<span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">${note}</span>`
              : ""
          }
        </div>

        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.7; color: #374151;">
          ${commentary || `${horse} has been added as a new SmartPunt tip.`}
        </p>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

async function sendGetOnEarlyNotifications({
  title,
  horse,
  betType,
  odds,
  commentary,
}: {
  title: string;
  horse: string;
  betType: string;
  odds: string;
  commentary: string;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `Get On Early: ${horse} ${odds ? `(${odds})` : ""}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "Get On Early",
      }),
      bodyHtml: `
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${title}</p>
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${horse}</h2>

        <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfccb;color:#166534;font-size:12px;font-weight:700;">${betType}</span>
          ${
            odds
              ? `<span style="display:inline-block;padding:8px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">${odds}</span>`
              : ""
          }
        </div>

        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.7; color: #374151;">
          ${commentary || `${horse} has been added as an early-value play.`}
        </p>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

async function sendPublishedRaceNotification({
  meetingName,
  raceName,
  raceNumber,
  distanceM,
}: {
  meetingName: string;
  raceName: string;
  raceNumber: number;
  distanceM: number | null;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const subject = `Published Race: ${meetingName} R${raceNumber}`;
  const raceLabel = `${meetingName} R${raceNumber} ${raceName} ${distanceM ? `- ${distanceM}m` : ""}`;

  const html = (email: string) =>
    buildEmailShell({
      headerHtml: buildEmailHeader({
        eyebrow: "SmartPunt",
        title: "New Published Race",
      }),
      bodyHtml: `
        <h2 style="margin: 6px 0 0; font-size: 28px; color: #111827;">${raceLabel}</h2>

        ${buildViewInSmartPuntButton()}

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Sent to ${email} because you’re an active SmartPunt subscriber.
        </p>
      `,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

async function clearSuggestedTipLinksForRaceIds(raceIds: number[]) {
  if (!raceIds.length) return;

  await serviceRolePatch(
    `suggested_tips?race_id=${buildInFilter(raceIds)}`,
    {
      meeting_id: null,
      race_id: null,
      horse_id: null,
      race_runner_id: null,
      updated_at: new Date().toISOString(),
    },
  );
}

async function clearSuggestedTipLinksForRunnerIds(runnerIds: number[]) {
  if (!runnerIds.length) return;

  await serviceRolePatch(
    `suggested_tips?race_runner_id=${buildInFilter(runnerIds)}`,
    {
      race_runner_id: null,
      updated_at: new Date().toISOString(),
    },
  );
}
// SmartPunt horse master form seed active

async function autoFinaliseMatchingSuggestedTipsForRace(raceId: number) {
  const supabase = await createClient();

  const { data: raceData, error: raceError } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .maybeSingle();

  if (raceError || !raceData) {
    throw new Error(raceError?.message || "Race not found for tip settlement.");
  }

  const { data: meetingData, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", raceData.meeting_id)
    .maybeSingle();

  if (meetingError) {
    throw new Error(meetingError.message);
  }

  const { data: runnerRows, error: runnerError } = await supabase
    .from("race_runners")
    .select("*")
    .eq("race_id", raceId);

  if (runnerError) {
    throw new Error(runnerError.message);
  }

  const activeRunnerRows = (runnerRows || []).filter((runner: any) => !runner.scratched);
  const runnerIds = activeRunnerRows.map((runner: any) => Number(runner.id));
  const horseIds = activeRunnerRows.map((runner: any) => Number(runner.horse_id)).filter(Boolean);

  const horseMap = new Map<number, any>();
  if (horseIds.length > 0) {
    const { data: horseRows, error: horseError } = await supabase
      .from("horses")
      .select("id, horse_name, normalised_name")
      .in("id", horseIds);

    if (horseError) {
      throw new Error(horseError.message);
    }

    for (const horse of horseRows || []) {
      horseMap.set(Number(horse.id), horse);
    }
  }

  const { data: suggestedTips, error: tipsError } = await supabase
    .from("suggested_tips")
    .select("*")
    .is("settled_at", null);

  if (tipsError) {
    throw new Error(tipsError.message);
  }

  const meetingName = String(meetingData?.meeting_name || "");
  const raceName = String(raceData.race_name || "");
  const raceNumber = Number(raceData.race_number || 0);

  const normalisedMeetingName = normaliseText(meetingName);
  const normalisedRaceName = normaliseText(raceName);
  const raceMarkers = [`r${raceNumber}`, `race ${raceNumber}`, `race${raceNumber}`].map(
    normaliseText,
  );

  const updates: Array<{
    id: number;
    finishing_position: number | null;
    successful: boolean | null;
    settled_at: string;
  }> = [];

  for (const tip of suggestedTips || []) {
    const tipType = String(tip.type || "").toLowerCase().trim();
    if (!["win", "place"].includes(tipType)) continue;

    let matchedRunner: any | null = null;

    if (tip.race_runner_id && runnerIds.includes(Number(tip.race_runner_id))) {
      matchedRunner =
        activeRunnerRows.find((runner: any) => Number(runner.id) === Number(tip.race_runner_id)) ||
        null;
    }

    if (!matchedRunner) {
      const tipHorse = normaliseHorseName(String(tip.horse || ""));
      const tipRace = normaliseText(String(tip.race || ""));

      if (!tipHorse || !tipRace) continue;

      matchedRunner =
        activeRunnerRows.find((runner: any) => {
          const horse = horseMap.get(Number(runner.horse_id));
          const horseName = horse?.normalised_name
            ? String(horse.normalised_name)
            : normaliseHorseName(String(horse?.horse_name || ""));
          return horseName === tipHorse;
        }) || null;

      if (!matchedRunner) continue;

      const raceTextMatchesMeeting =
        !!normalisedMeetingName && tipRace.includes(normalisedMeetingName);
      const raceTextMatchesNumber = raceMarkers.some(
        (marker) => marker && tipRace.includes(marker),
      );
      const raceTextMatchesRaceName =
        !!normalisedRaceName && tipRace.includes(normalisedRaceName);

      if (!raceTextMatchesMeeting || (!raceTextMatchesNumber && !raceTextMatchesRaceName)) {
        continue;
      }
    }

    const finishingPosition =
      matchedRunner.finishing_position !== null &&
      matchedRunner.finishing_position !== undefined &&
      !Number.isNaN(Number(matchedRunner.finishing_position))
        ? Number(matchedRunner.finishing_position)
        : null;

    let successful: boolean | null = null;

    if (tipType === "win") {
      successful = finishingPosition === 1;
    } else if (tipType === "place") {
      successful = finishingPosition !== null ? finishingPosition <= 3 : false;
    }

    updates.push({
      id: Number(tip.id),
      finishing_position: finishingPosition,
      successful,
      settled_at: new Date().toISOString(),
    });
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("suggested_tips")
      .update({
        finishing_position: update.finishing_position,
        successful: update.successful,
        settled_at: update.settled_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function createSubscriberUserAction(
  _: { error: string | null; success: string | null },
  formData: FormData,
) {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "user").trim();
  const emailInput = String(formData.get("email") ?? "").trim().toLowerCase();
  const usernameInput = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !password) {
    return { error: "Full name and password are required.", success: null };
  }

  if (!["user", "admin", "staff_admin"].includes(role)) {
    return { error: "Invalid role selected.", success: null };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", success: null };
  }

  const isSubscriber = role === "user";

  if (isSubscriber && !emailInput) {
    return { error: "Subscribers must have an email address.", success: null };
  }

  if (!isSubscriber && !usernameInput) {
    return { error: "Full Admin and Race Builder users must have a username.", success: null };
  }

  const username =
    usernameInput ||
    null;

  if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return {
      error:
        "Username must be 3 to 30 characters and use only letters, numbers, dots, underscores, or hyphens.",
      success: null,
    };
  }

  const authEmail = isSubscriber
    ? emailInput
    : `${username}@smartpunt.local`;

  const profileEmail = isSubscriber ? emailInput : authEmail;

  const { supabaseUrl, headers } = getServiceRoleHeaders();

  if (username) {
    const existingUsernameRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}`,
      {
        method: "GET",
        headers: {
          ...headers,
          Accept: "application/json",
        },
      },
    );

    const existingUsernameData = await existingUsernameRes.json();

    if (!existingUsernameRes.ok) {
      return {
        error:
          existingUsernameData?.message ||
          existingUsernameData?.msg ||
          "Failed to validate username.",
        success: null,
      };
    }

    if (Array.isArray(existingUsernameData) && existingUsernameData.length > 0) {
      return {
        error: "That username is already in use.",
        success: null,
      };
    }
  }

  const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username: username || null,
        role,
      },
    }),
  });

  const createUserData = await createUserRes.json();

  if (!createUserRes.ok) {
    return {
      error: createUserData?.msg || createUserData?.message || "Failed to create auth user.",
      success: null,
    };
  }

  const userId = createUserData?.id || createUserData?.user?.id;

  if (!userId) {
    return {
      error: "Auth user was created but no user ID was returned.",
      success: null,
    };
  }

  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([
      {
        id: userId,
        email: profileEmail,
        username,
        full_name: fullName,
        role,
        status: "active",
      },
    ]),
  });

  if (!profileRes.ok) {
    const profileErrorText = await profileRes.text();
    return {
      error: `Auth user created, but profile creation failed: ${profileErrorText}`,
      success: null,
    };
  }

  revalidatePath("/");

  const roleLabel =
    role === "admin"
      ? "Full Admin"
      : role === "staff_admin"
        ? "Race Builder"
        : "Subscriber";

  const loginLabel = isSubscriber ? profileEmail : username;

  return {
    error: null,
    success: `${roleLabel} created successfully for ${loginLabel}.`,
  };
}
export async function signInAction(
  _: { error: string | null },
  formData: FormData,
) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!identifier || !password) {
    return { error: "Username/email and password are required." };
  }

  const supabase = await createClient();
  let resolvedEmail = identifier.toLowerCase();

  if (!identifier.includes("@")) {
    try {
      const username = identifier.toLowerCase();
      const encodedUsername = encodeURIComponent(username);

      const profileRows = (await serviceRoleSelect(
        `profiles?select=email&username=eq.${encodedUsername}&limit=1`,
      )) as Array<{ email: string }> | null;

      const profile = profileRows?.[0] || null;

      if (!profile?.email) {
        return { error: "Username not found." };
      }

      resolvedEmail = String(profile.email).toLowerCase();
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to look up username.",
      };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { cookies } = await import("next/headers");
  (await cookies()).set("smartpunt_play_intro", "true", {
    path: "/",
    maxAge: 60,
    httpOnly: false,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { error: null };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function markTipActiveAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Unauthorized");

  const tipId = Number(formData.get("tip_id"));
  const supabase = await createClient();

  const { error } = await supabase.from("user_active_tips").upsert(
    {
      user_id: profile.id,
      tip_id: tipId,
    },
    { onConflict: "user_id,tip_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/my-resulted-tips");
}

export async function removeTipActiveAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Unauthorized");

  const tipId = Number(formData.get("tip_id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_active_tips")
    .delete()
    .eq("user_id", profile.id)
    .eq("tip_id", tipId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/my-resulted-tips");
}

export async function upsertSuggestedTip(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isNew = !id;
  const sendNotification = String(formData.get("send_notification") ?? "") === "true";

  const raceDate = String(formData.get("race_date") ?? "");
  const raceTime = String(formData.get("race_time") ?? "");
  const raceTimezone = String(formData.get("race_timezone") ?? "Australia/Perth");
  const raceStartAt = zonedDateTimeToUtcIso(raceDate, raceTime, raceTimezone);

  const meetingIdRaw = String(formData.get("meeting_id") ?? "").trim();
  const raceIdRaw = String(formData.get("race_id") ?? "").trim();
  const horseIdRaw = String(formData.get("horse_id") ?? "").trim();
  const raceRunnerIdRaw = String(formData.get("race_runner_id") ?? "").trim();

  const finishingPositionRaw = String(formData.get("finishing_position") ?? "").trim();
  const successfulRaw = String(formData.get("successful") ?? "").trim();

  const successful =
    successfulRaw === "true" ? true : successfulRaw === "false" ? false : null;

  const payload = {
    meeting_id: meetingIdRaw ? Number(meetingIdRaw) : null,
    race_id: raceIdRaw ? Number(raceIdRaw) : null,
    horse_id: horseIdRaw ? Number(horseIdRaw) : null,
    race_runner_id: raceRunnerIdRaw ? Number(raceRunnerIdRaw) : null,
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    type: String(formData.get("type") ?? "Win"),
    confidence: String(formData.get("confidence") ?? "High"),
    note: String(formData.get("note") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    result_comment: String(formData.get("result_comment") ?? ""),
    race_start_at: raceStartAt,
    race_timezone: raceTimezone,
    finishing_position: finishingPositionRaw ? Number(finishingPositionRaw) : null,
    successful,
    settled_at: typeof successful === "boolean" ? new Date().toISOString() : null,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("suggested_tips")
      .update(payload)
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("suggested_tips")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (isNew && sendNotification && data) {
      try {
        await sendSuggestedTipNotifications({
          race: data.race || payload.race,
          horse: data.horse || payload.horse,
          type: data.type || payload.type,
          confidence: data.confidence || payload.confidence,
          note: data.note || payload.note,
          commentary: data.commentary || payload.commentary,
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/resulted-tips");
  revalidatePath("/my-resulted-tips");
}

export async function deleteSuggestedTipAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("suggested_tips").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/resulted-tips");
  revalidatePath("/my-resulted-tips");
}

export async function upsertWatchItem(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const payload = {
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    label: String(formData.get("label") ?? "Horse to Watch"),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("watchlist_items").update(payload).eq("id", Number(id))
    : supabase.from("watchlist_items").insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function deleteWatchItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function upsertLongTermBet(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isNew = !id;

  const raceDate = String(formData.get("race_date") ?? "");
  const raceTime = String(formData.get("race_time") ?? "");
  const raceTimezone = String(formData.get("race_timezone") ?? "Australia/Perth");
  const raceStartAt = zonedDateTimeToUtcIso(raceDate, raceTime, raceTimezone);

  const raceNumberRaw = String(formData.get("race_number") ?? "").trim();
  const raceNumber = raceNumberRaw ? Number(raceNumberRaw) : null;

  const payload = {
    title: String(formData.get("title") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    meeting: String(formData.get("meeting") ?? "").trim() || null,
    race_number:
      raceNumber !== null && !Number.isNaN(raceNumber) ? raceNumber : null,
    race_start_at: raceStartAt,
    race_timezone: raceTimezone || null,
    bet_type: String(formData.get("bet_type") ?? "Win"),
    odds: String(formData.get("odds") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("long_term_bets")
      .update(payload)
      .eq("id", Number(id));

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("long_term_bets")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (isNew && data) {
      try {
        await sendGetOnEarlyNotifications({
          title: data.title || payload.title,
          horse: data.horse || payload.horse,
          betType: data.bet_type || payload.bet_type,
          odds: data.odds || payload.odds,
          commentary: data.commentary || payload.commentary,
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/long-term-bets");
}

export async function deleteLongTermBetAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("long_term_bets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function createMeetingAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const meetingName = String(formData.get("meeting_name") ?? "").trim();
    const meetingDate = String(formData.get("meeting_date") ?? "").trim();
    const trackCondition = String(formData.get("track_condition") ?? "").trim();

    if (!meetingName || !meetingDate) {
      return { success: false, error: "Meeting name and date are required." };
    }

    const { error } = await supabase.from("meetings").insert({
      meeting_name: meetingName,
      meeting_date: meetingDate,
      track_condition: trackCondition || null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create meeting.",
    };
  }
}

export async function deleteMeetingAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const meetingId = Number(formData.get("meeting_id"));

    if (!meetingId) {
      return { success: false, error: "Meeting is required." };
    }

    const races = (await serviceRoleSelect(
      `races?meeting_id=eq.${meetingId}&select=id`,
    )) as Array<{ id: number }> | null;

    const raceIds = (races || []).map((race) => Number(race.id)).filter(Boolean);

    if (raceIds.length > 0) {
      const runners = (await serviceRoleSelect(
        `race_runners?race_id=${buildInFilter(raceIds)}&select=id`,
      )) as Array<{ id: number }> | null;

      const runnerIds = (runners || []).map((runner) => Number(runner.id)).filter(Boolean);

      await clearSuggestedTipLinksForRaceIds(raceIds);
      await clearSuggestedTipLinksForRunnerIds(runnerIds);

      await serviceRoleDelete(`race_runners?race_id=${buildInFilter(raceIds)}`);
      await serviceRoleDelete(`races?id=${buildInFilter(raceIds)}`);
    }

    await serviceRoleDelete(`meetings?id=eq.${meetingId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete meeting.",
    };
  }
}

export async function createRaceAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const meetingId = Number(formData.get("meeting_id"));
    const raceNumber = Number(formData.get("race_number"));
    const raceNameRaw = String(formData.get("race_name") ?? "").trim();
    const distanceRaw = String(formData.get("distance_m") ?? "").trim();

    if (!meetingId || !raceNumber) {
      return { success: false, error: "Meeting and race number are required." };
    }

    const distanceValue = distanceRaw ? Number(distanceRaw) : null;
    const raceName = raceNameRaw || `Race ${raceNumber}`;

    const { error } = await supabase.from("races").insert({
      meeting_id: meetingId,
      race_number: raceNumber,
      race_name: raceName,
      distance_m: Number.isNaN(distanceValue as number) ? null : distanceValue,
      status: "draft",
      published_at: null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "That race number already exists for this meeting." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create race.",
    };
  }
}

export async function toggleRacePublishAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const nextStatus = String(formData.get("next_status") ?? "").trim();

    if (!raceId || !nextStatus) {
      return { success: false, error: "Race and status are required." };
    }

    if (!["draft", "published", "closed"].includes(nextStatus)) {
      return { success: false, error: "Invalid race status." };
    }

    const payload = {
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("races").update(payload).eq("id", raceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update race status.",
    };
  }
}

export async function deleteRaceAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const runners = (await serviceRoleSelect(
      `race_runners?race_id=eq.${raceId}&select=id`,
    )) as Array<{ id: number }> | null;

    const runnerIds = (runners || []).map((runner) => Number(runner.id)).filter(Boolean);

    await clearSuggestedTipLinksForRaceIds([raceId]);
    await clearSuggestedTipLinksForRunnerIds(runnerIds);

    await serviceRoleDelete(`race_runners?race_id=eq.${raceId}`);
    await serviceRoleDelete(`races?id=eq.${raceId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete race.",
    };
  }
}

export async function createRaceRunnerAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const selectedHorseIdRaw = String(formData.get("selected_horse_id") ?? "").trim();
    const horseNameRaw = String(formData.get("horse_name") ?? "").trim();
    const jockeyName = String(formData.get("jockey_name") ?? "").trim();
    const trainerName = String(formData.get("trainer_name") ?? "").trim();
    const barrierRaw = String(formData.get("barrier") ?? "").trim();
    const marketPriceRaw = String(formData.get("market_price") ?? "").trim();
    const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
    const isApprenticeRaw = String(formData.get("is_apprentice") ?? "").trim();
    const apprenticeClaimRaw = String(formData.get("apprentice_claim_kg") ?? "").trim();
    const formLast6 = String(formData.get("form_last_6") ?? "").trim();
    const trackFormLast6 = String(formData.get("track_form_last_6") ?? "").trim();
    const distanceFormLast6 = String(formData.get("distance_form_last_6") ?? "").trim();

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    if (!selectedHorseIdRaw && !horseNameRaw) {
      return { success: false, error: "Select or enter a horse first." };
    }

    let horseId = selectedHorseIdRaw ? Number(selectedHorseIdRaw) : 0;

    if (!horseId) {
      const normalisedName = normaliseHorseName(horseNameRaw);

      if (!normalisedName) {
        return { success: false, error: "Horse name is required." };
      }

      const { data: existingHorse, error: existingHorseError } = await supabase
        .from("horses")
        .select("id, horse_name")
        .eq("normalised_name", normalisedName)
        .maybeSingle();

      if (existingHorseError) {
        return { success: false, error: existingHorseError.message };
      }

      if (existingHorse?.id) {
        horseId = existingHorse.id;
      } else {
        const { data: insertedHorse, error: insertHorseError } = await supabase
.from("horses")
.insert({
  horse_name: horseNameRaw.replace(/\s+/g, " ").trim(),
  normalised_name: normalisedName,

form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
track_form_last_6: trackFormLast6 || null,
distance_form_last_6: distanceFormLast6 || null,

  updated_at: new Date().toISOString(),
})
          .select("id")
          .single();

        if (insertHorseError) {
          if (insertHorseError.code === "23505") {
            const { data: retryHorse, error: retryHorseError } = await supabase
              .from("horses")
              .select("id")
              .eq("normalised_name", normalisedName)
              .maybeSingle();

            if (retryHorseError || !retryHorse?.id) {
              return {
                success: false,
                error: retryHorseError?.message || "Unable to match existing horse.",
              };
            }

            horseId = retryHorse.id;
          } else {
            return { success: false, error: insertHorseError.message };
          }
        } else {
          horseId = insertedHorse.id;
        }
      }
    }

    const barrierValue = barrierRaw ? Number(barrierRaw) : null;
    const marketPriceValue = marketPriceRaw ? Number(marketPriceRaw) : null;
    const weightKgValue = weightKgRaw ? Number(weightKgRaw) : null;
    const isApprentice =
      isApprenticeRaw === "true"
        ? true
        : isApprenticeRaw === "false"
          ? false
          : null;
    const apprenticeClaimValue = apprenticeClaimRaw ? Number(apprenticeClaimRaw) : null;

    const { error } = await supabase.from("race_runners").insert({
      race_id: raceId,
      horse_id: horseId,
      jockey_name: jockeyName || null,
      trainer_name: trainerName || null,
      barrier: barrierValue && !Number.isNaN(barrierValue) ? barrierValue : null,
      market_price:
        marketPriceValue !== null && !Number.isNaN(marketPriceValue) ? marketPriceValue : null,
      weight_kg:
        weightKgValue !== null && !Number.isNaN(weightKgValue) ? weightKgValue : null,
      is_apprentice: isApprentice,
      apprentice_claim_kg:
        apprenticeClaimValue !== null && !Number.isNaN(apprenticeClaimValue)
          ? apprenticeClaimValue
          : null,
form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
track_form_last_6: trackFormLast6 || null,
distance_form_last_6: distanceFormLast6 || null,
      scratched: false,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "That horse is already loaded into this race." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/admin/horses");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create runner.",
    };
  }
}

export async function deleteRaceRunnerAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();

    const runnerId = Number(formData.get("runner_id"));

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    await clearSuggestedTipLinksForRunnerIds([runnerId]);
    await serviceRoleDelete(`race_runners?id=eq.${runnerId}`);

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete runner.",
    };
  }
}

export async function updateRaceRunnerDetailsAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const runnerId = Number(formData.get("runner_id"));

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    const jockeyName = String(formData.get("jockey_name") ?? "").trim();
    const trainerName = String(formData.get("trainer_name") ?? "").trim();
    const barrierRaw = String(formData.get("barrier") ?? "").trim();
    const marketPriceRaw = String(formData.get("market_price") ?? "").trim();
    const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
    const isApprenticeRaw = String(formData.get("is_apprentice") ?? "").trim();
    const apprenticeClaimRaw = String(formData.get("apprentice_claim_kg") ?? "").trim();
    const formLast6 = String(formData.get("form_last_6") ?? "").trim();
    const trackFormLast6 = String(formData.get("track_form_last_6") ?? "").trim();
    const distanceFormLast6 = String(formData.get("distance_form_last_6") ?? "").trim();

    const barrierValue = barrierRaw ? Number(barrierRaw) : null;
    const marketPriceValue = marketPriceRaw ? Number(marketPriceRaw) : null;
    const weightKgValue = weightKgRaw ? Number(weightKgRaw) : null;
    const apprenticeClaimValue = apprenticeClaimRaw ? Number(apprenticeClaimRaw) : null;

    const isApprentice =
      isApprenticeRaw === "true"
        ? true
        : isApprenticeRaw === "false"
          ? false
          : null;

    const { error } = await supabase
      .from("race_runners")
      .update({
        jockey_name: jockeyName || null,
        trainer_name: trainerName || null,
        barrier: barrierValue !== null && !Number.isNaN(barrierValue) ? barrierValue : null,
        market_price:
          marketPriceValue !== null && !Number.isNaN(marketPriceValue) ? marketPriceValue : null,
        weight_kg:
          weightKgValue !== null && !Number.isNaN(weightKgValue) ? weightKgValue : null,
        is_apprentice: isApprentice,
        apprentice_claim_kg:
          apprenticeClaimValue !== null && !Number.isNaN(apprenticeClaimValue)
            ? apprenticeClaimValue
            : null,
form_last_6: formLast6 ? normaliseImportedForm(formLast6) : null,
        track_form_last_6: trackFormLast6 || null,
        distance_form_last_6: distanceFormLast6 || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runnerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/admin/race-builder");
    revalidatePath("/race-archive");
    revalidatePath("/admin/horses");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update runner details.",
    };
  }
}

export async function toggleRaceRunnerScratchAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const runnerId = Number(formData.get("runner_id"));
    const scratchedRaw = String(formData.get("scratched") ?? "").trim();

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    const scratched = scratchedRaw === "true";

    const { error } = await supabase
      .from("race_runners")
      .update({
        scratched,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runnerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update scratch status.",
    };
  }
}

export async function settleRaceRunnersAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRacingAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const { data: raceRunners, error: runnersError } = await supabase
      .from("race_runners")
.select("id, horse_id, scratched, form_last_6, track_form_last_6, distance_form_last_6")
      .eq("race_id", raceId);

    if (runnersError) {
      return { success: false, error: runnersError.message };
    }

    const scratchedMap = new Map<number, boolean>();
    for (const runner of raceRunners || []) {
      scratchedMap.set(Number((runner as any).id), Boolean((runner as any).scratched));
    }

    const updates: Array<{
      id: number;
      finishing_position: number | null;
      starting_price: number | null;
      won: boolean | null;
      placed: boolean | null;
      settled_at: string | null;
      updated_at: string;
    }> = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("finishing_position_")) continue;

      const runnerId = Number(key.replace("finishing_position_", ""));
      const finishingPositionRaw = String(value ?? "").trim();

      if (!runnerId) continue;

      const isScratched = scratchedMap.get(runnerId) === true;

      if (isScratched) {
        updates.push({
          id: runnerId,
          finishing_position: null,
          starting_price: null,
          won: false,
          placed: false,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      const finishingPosition = finishingPositionRaw ? Number(finishingPositionRaw) : null;
      const startingPriceRaw = String(formData.get(`starting_price_${runnerId}`) ?? "").trim();
      const startingPrice = startingPriceRaw ? Number(startingPriceRaw) : null;

      const hasFinish =
        finishingPosition !== null && !Number.isNaN(finishingPosition);

      updates.push({
        id: runnerId,
        finishing_position: hasFinish ? finishingPosition : null,
        starting_price:
          startingPrice !== null && !Number.isNaN(startingPrice)
            ? startingPrice
            : null,
        won: hasFinish ? finishingPosition === 1 : false,
        placed: hasFinish ? finishingPosition <= 3 : false,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    for (const update of updates) {
      const { error } = await supabase
        .from("race_runners")
        .update({
          finishing_position: update.finishing_position,
          starting_price: update.starting_price,
          won: update.won,
          placed: update.placed,
          settled_at: update.settled_at,
          updated_at: update.updated_at,
        })
        .eq("id", update.id);

      if (error) {
        return { success: false, error: error.message };
      }
    }
for (const update of updates) {
  if (
    update.finishing_position === null ||
    update.finishing_position === undefined ||
    update.finishing_position <= 0
  ) {
    continue;
  }

  const matchingRunner = (raceRunners || []).find(
    (runner) => Number((runner as any).id) === Number(update.id),
  );

  if (!matchingRunner) {
    continue;
  }

  const horseId = Number((matchingRunner as any).horse_id);

  if (!horseId) {
    continue;
  }

  const { data: horseRow, error: horseFetchError } = await supabase
    .from("horses")
.select("id, form_last_6, track_form_last_6, distance_form_last_6")
    .eq("id", horseId)
    .single();

  if (horseFetchError) {
    return { success: false, error: horseFetchError.message };
  }

const existingHorseForm =
  horseRow?.form_last_6 ||
  normaliseImportedForm(String((matchingRunner as any).form_last_6 || ""));

const existingTrackForm =
  horseRow?.track_form_last_6 ||
  String((matchingRunner as any).track_form_last_6 || "");

const existingDistanceForm =
  horseRow?.distance_form_last_6 ||
  String((matchingRunner as any).distance_form_last_6 || "");

const nextForm = updateFormStringWithResult(
  existingHorseForm || null,
  Number(update.finishing_position),
);

const nextTrackForm = updateStatRecordWithResult(
  existingTrackForm || null,
  Number(update.finishing_position),
);

const nextDistanceForm = updateStatRecordWithResult(
  existingDistanceForm || null,
  Number(update.finishing_position),
);

  const { error: horseUpdateError } = await supabase
    .from("horses")
.update({
  form_last_6: nextForm,
  track_form_last_6: nextTrackForm,
  distance_form_last_6: nextDistanceForm,
  updated_at: new Date().toISOString(),
})
    .eq("id", horseId);

  if (horseUpdateError) {
    return { success: false, error: horseUpdateError.message };
  }
}
    const { error: raceError } = await supabase
      .from("races")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", raceId);

    if (raceError) {
      return { success: false, error: raceError.message };
    }

    try {
      await autoFinaliseMatchingSuggestedTipsForRace(raceId);
    } catch (tipSettlementError) {
      return {
        success: false,
        error:
          tipSettlementError instanceof Error
            ? `Race settled, but tip auto-finalisation failed: ${tipSettlementError.message}`
            : "Race settled, but tip auto-finalisation failed.",
      };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/admin/horses");
    revalidatePath("/resulted-tips");
    revalidatePath("/my-resulted-tips");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to settle race.",
    };
  }
}
