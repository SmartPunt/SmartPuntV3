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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function getAlertLabel(type: string, confidence: string) {
  const normalType = String(type || "").toLowerCase();
  const normalConfidence = String(confidence || "").toLowerCase();

  if (normalType === "win" && normalConfidence === "high") return "BEST BET";
  if (normalType === "win") return "TOP PLAY";
  if (normalType === "place") return "SAFE PLAY";
  if (normalType === "all up") return "MULTI WATCH";
  return "SMARTPUNT ALERT";
}

function getSuggestedPlayLine(type: string, confidence: string, note: string) {
  const safeType = type || "Win";
  const safeConfidence = confidence || "High";
  const trimmedNote = String(note || "").trim();

  if (trimmedNote) {
    return `${safeType} bet • ${safeConfidence} confidence • ${trimmedNote}`;
  }

  return `${safeType} bet • ${safeConfidence} confidence`;
}

function formatRaceTimeDisplay(raceStartAt?: string | null, raceTimezone?: string | null) {
  if (!raceStartAt) return null;

  try {
    const date = new Date(raceStartAt);
    if (Number.isNaN(date.getTime())) return null;

    const timeZone = raceTimezone || "Australia/Perth";

    return new Intl.DateTimeFormat("en-AU", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

function formatCountdownLabel(raceStartAt?: string | null) {
  if (!raceStartAt) return null;

  const raceTime = new Date(raceStartAt).getTime();
  if (Number.isNaN(raceTime)) return null;

  const now = Date.now();
  const diffMs = raceTime - now;

  if (diffMs <= 0) return "Jumping soon";

  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 60) return `Jump in ${diffMinutes} min`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours < 24) {
    return minutes > 0 ? `Jump in ${hours}h ${minutes}m` : `Jump in ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours > 0) {
    return `Jump in ${days}d ${remainingHours}h`;
  }

  return `Jump in ${days}d`;
}

function normaliseHorseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function renderPill(text: string, background: string, color: string, border = "none") {
  return `
    <span style="
      display:inline-block;
      background:${background};
      color:${color};
      padding:8px 12px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      line-height:1;
      margin-right:6px;
      margin-bottom:6px;
      border:${border};
      mso-line-height-rule:exactly;
      text-decoration:none;
      white-space:nowrap;
    ">
      ${text}
    </span>
  `;
}

function renderEmailCard(title: string, bodyHtml: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;background:#151515;border:1px solid rgba(255,255,255,0.06);border-radius:20px;">
      <tr>
        <td style="padding:18px;">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;font-weight:800;line-height:1.4;mso-line-height-rule:exactly;">
            ${title}
          </div>
          <div style="font-size:16px;line-height:1.75;color:#f4f4f5;margin-top:10px;mso-line-height-rule:exactly;">
            ${bodyHtml}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function renderEmailShell({
  appUrl,
  introPill,
  eyebrow,
  heading,
  subheading,
  heroBadgesHtml = "",
  primaryCardTitle,
  primaryCardBody,
  primaryPillsHtml = "",
  secondaryCardTitle,
  secondaryCardBody,
  ctaHref,
  ctaLabel,
  footerNote,
  email,
}: {
  appUrl: string;
  introPill: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  heroBadgesHtml?: string;
  primaryCardTitle: string;
  primaryCardBody: string;
  primaryPillsHtml?: string;
  secondaryCardTitle: string;
  secondaryCardBody: string;
  ctaHref?: string;
  ctaLabel?: string;
  footerNote: string;
  email: string;
}) {
  const logoHtml = appUrl
    ? `
      <tr>
        <td style="background:#000000;line-height:0;font-size:0;">
          <img
            src="${appUrl}/header-logo.png"
            alt="SmartPunt"
            style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;"
          />
        </td>
      </tr>
    `
    : "";

  const ctaHtml =
    ctaHref && ctaLabel
      ? `
      <tr>
        <td style="padding:20px 22px 0 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="center" bgcolor="#f59e0b" style="border-radius:16px;border:1px solid rgba(245,158,11,0.60);">
                <a
                  href="${ctaHref}"
                  style="
                    display:block;
                    width:100%;
                    box-sizing:border-box;
                    color:#111111;
                    text-decoration:none;
                    text-align:center;
                    padding:16px 18px;
                    border-radius:16px;
                    font-size:16px;
                    font-weight:900;
                    letter-spacing:0.02em;
                    line-height:1.2;
                    mso-line-height-rule:exactly;
                  "
                >
                  ${ctaLabel}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;background:#050505;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;border-collapse:collapse;border-spacing:0;background:#0b0b0b;border:1px solid rgba(251,191,36,0.18);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);mso-table-lspace:0pt;mso-table-rspace:0pt;">
                ${logoHtml}

                <tr>
                  <td style="padding:18px 22px 0 22px;background:#0b0b0b;">
                    ${renderPill(introPill, "#f59e0b", "#111111")}
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 22px 10px 22px;background:#111111;">
                    <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;font-weight:800;line-height:1.4;mso-line-height-rule:exactly;">
                      ${eyebrow}
                    </div>

                    <div style="font-size:34px;line-height:1.08;font-weight:900;color:#ffffff;margin-top:10px;mso-line-height-rule:exactly;">
                      ${heading}
                    </div>

                    <div style="font-size:15px;line-height:1.5;color:#d4d4d8;margin-top:10px;mso-line-height-rule:exactly;">
                      ${subheading}
                    </div>

                    ${
                      heroBadgesHtml
                        ? `<div style="margin-top:18px;line-height:1.8;mso-line-height-rule:exactly;">${heroBadgesHtml}</div>`
                        : ""
                    }
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 22px 0 22px;background:#0b0b0b;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;background:#171717;border:1px solid rgba(251,191,36,0.16);border-radius:20px;">
                      <tr>
                        <td style="padding:18px 18px 16px 18px;">
                          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;font-weight:800;line-height:1.4;mso-line-height-rule:exactly;">
                            ${primaryCardTitle}
                          </div>
                          <div style="font-size:18px;line-height:1.5;color:#ffffff;font-weight:800;margin-top:10px;mso-line-height-rule:exactly;">
                            ${primaryCardBody}
                          </div>
                          ${
                            primaryPillsHtml
                              ? `<div style="margin-top:14px;line-height:1.8;mso-line-height-rule:exactly;">${primaryPillsHtml}</div>`
                              : ""
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 22px 0 22px;background:#0b0b0b;">
                    ${renderEmailCard(secondaryCardTitle, secondaryCardBody)}
                  </td>
                </tr>

                ${ctaHtml}

                <tr>
                  <td style="padding:18px 22px 0 22px;background:#0b0b0b;font-size:13px;line-height:1.7;color:#a1a1aa;mso-line-height-rule:exactly;">
                    ${footerNote}
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 22px 22px 22px;background:#0b0b0b;font-size:11px;line-height:1.6;color:#6b7280;mso-line-height-rule:exactly;">
                    Sent to ${escapeHtml(email)}.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
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

async function sendSuggestedTipNotifications({
  race,
  horse,
  type,
  confidence,
  note,
  commentary,
  raceStartAt,
  raceTimezone,
}: {
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string;
  commentary: string;
  raceStartAt?: string | null;
  raceTimezone?: string | null;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.SMARTPUNT_APP_URL || "";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || !fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const safeRace = escapeHtml(race || "");
  const safeHorse = escapeHtml(horse || "");
  const safeType = escapeHtml(type || "Win");
  const safeConfidence = escapeHtml(confidence || "High");
  const safeNote = escapeHtml(note || "");
  const safeCommentary = String(commentary || "").trim();
  const preview = safeCommentary || `${horse} has been tipped.`;

  const alertLabel = getAlertLabel(type, confidence);
  const suggestedPlayLine = escapeHtml(getSuggestedPlayLine(type, confidence, note));
  const countdownLabel = formatCountdownLabel(raceStartAt);
  const formattedRaceTime = formatRaceTimeDisplay(raceStartAt, raceTimezone);

  const subjectPrefix =
    alertLabel === "BEST BET"
      ? "🔥 BEST BET"
      : alertLabel === "SAFE PLAY"
        ? "🛡️ SAFE PLAY"
        : alertLabel === "MULTI WATCH"
          ? "🎯 MULTI WATCH"
          : "🔥 SMARTPUNT ALERT";

  const subject = `${subjectPrefix} — ${horse} (${race})`;

  const heroBadges = [
    countdownLabel
      ? renderPill(`⏱ ${escapeHtml(countdownLabel)}`, "#1f2937", "#fde68a", "1px solid rgba(251,191,36,0.18)")
      : "",
    formattedRaceTime
      ? renderPill(`📍 ${escapeHtml(formattedRaceTime)}`, "#111827", "#cbd5e1", "1px solid rgba(255,255,255,0.08)")
      : "",
  ].join("");

  const playPills = [
    renderPill(safeType, "#052e16", "#86efac"),
    renderPill(`${safeConfidence} confidence`, "#082f49", "#7dd3fc"),
    safeNote ? renderPill(safeNote, "#451a03", "#fcd34d") : "",
  ].join("");

  const html = (email: string) =>
    renderEmailShell({
      appUrl,
      introPill: "New SmartPunt Drop",
      eyebrow: escapeHtml(alertLabel),
      heading: `🔥 ${safeHorse}`,
      subheading: safeRace,
      heroBadgesHtml: heroBadges,
      primaryCardTitle: "Suggested Play",
      primaryCardBody: suggestedPlayLine,
      primaryPillsHtml: playPills,
      secondaryCardTitle: "Tipster’s Tag",
      secondaryCardBody: nl2br(preview),
      ctaHref: appUrl || undefined,
      ctaLabel: appUrl ? "👉 Open SmartPunt" : undefined,
      footerNote:
        "You’re getting this because you’re inside SmartPunt. Stay sharp — the next edge lands fast.",
      email,
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
  meeting,
  raceNumber,
  raceStartAt,
  raceTimezone,
}: {
  title: string;
  horse: string;
  betType: string;
  odds: string;
  commentary: string;
  meeting?: string | null;
  raceNumber?: number | null;
  raceStartAt?: string | null;
  raceTimezone?: string | null;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.SMARTPUNT_APP_URL || "";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || !fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const safeTitle = escapeHtml(title || "Get On Early");
  const safeHorse = escapeHtml(horse || "");
  const safeBetType = escapeHtml(betType || "Win");
  const safeOdds = escapeHtml(odds || "TBC");
  const safeCommentary = String(commentary || "").trim();

  const raceMetaParts: string[] = [];
  if (meeting) raceMetaParts.push(escapeHtml(meeting));
  if (raceNumber) raceMetaParts.push(`R${raceNumber}`);
  const formattedRaceTime = formatRaceTimeDisplay(raceStartAt, raceTimezone);
  if (formattedRaceTime) raceMetaParts.push(escapeHtml(formattedRaceTime));
  const raceMeta = raceMetaParts.join(" · ");

  const subject = `🔥 GET ON EARLY — ${horse}${odds ? ` (${odds})` : ""}`;

  const playPills = [
    renderPill(safeBetType, "#451a03", "#fcd34d"),
    renderPill(`Taken: ${safeOdds}`, "#111827", "#e5e7eb"),
    renderPill("Price may not last", "#7c2d12", "#fdba74"),
  ].join("");

  const html = (email: string) =>
    renderEmailShell({
      appUrl,
      introPill: "VIP Early Alert",
      eyebrow: "GET ON EARLY 🔥",
      heading: safeHorse,
      subheading: raceMeta ? `${safeTitle} · ${raceMeta}` : safeTitle,
      primaryCardTitle: "Why act now",
      primaryCardBody: "SmartPunt wants this taken before the market catches up.",
      primaryPillsHtml: playPills,
      secondaryCardTitle: "Tipster’s angle",
      secondaryCardBody: nl2br(
        safeCommentary ||
          "SmartPunt has marked this as an early-value play worth locking in before the market firms.",
      ),
      ctaHref: appUrl ? `${appUrl}/long-term-bets` : undefined,
      ctaLabel: appUrl ? "👉 Open Get On Early" : undefined,
      footerNote:
        "This is a premium early-position alert. If the market trims, you’ll be glad you were on early.",
      email,
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
  const appUrl = process.env.SMARTPUNT_APP_URL || "";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || !fromEmail) return;

  const recipients = await getActiveSubscriberEmails();
  if (!recipients.length) return;

  const safeMeeting = escapeHtml(meetingName || "Race Meeting");
  const safeRaceName = escapeHtml(raceName || `Race ${raceNumber}`);
  const safeDistance = distanceM ? `${distanceM}m` : "Distance TBC";

  const subject = `📣 New Race Field — ${meetingName} R${raceNumber}`;

  const html = (email: string) =>
    renderEmailShell({
      appUrl,
      introPill: "New Race Field",
      eyebrow: "PUBLISHED RACE",
      heading: safeMeeting,
      subheading: `R${raceNumber} ${safeRaceName} · ${escapeHtml(safeDistance)}`,
      primaryCardTitle: "What’s live now",
      primaryCardBody:
        "A new published race field is now available inside SmartPunt. Jump in to view the runners.",
      secondaryCardTitle: "Race update",
      secondaryCardBody:
        "The field has been loaded and is ready to view inside SmartPunt.",
      ctaHref: appUrl ? `${appUrl}/published-races` : undefined,
      ctaLabel: appUrl ? "👉 View Published Races" : undefined,
      footerNote: "New race fields are ready for review inside SmartPunt.",
      email,
    });

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

  await sendBatchEmails(emails);
}

export async function createSubscriberUserAction(
  _: { error: string | null; success: string | null },
  formData: FormData,
) {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !email || !password) {
    return { error: "Full name, email, and password are required.", success: null };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", success: null };
  }

  const { supabaseUrl, headers } = getServiceRoleHeaders();

  const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
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
        email,
        full_name: fullName,
        role: "user",
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
  return {
    error: null,
    success: `Subscriber created successfully for ${email}.`,
  };
}

export async function signInAction(
  _: { error: string | null },
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

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

  const finishingPositionRaw = String(formData.get("finishing_position") ?? "").trim();
  const successfulRaw = String(formData.get("successful") ?? "").trim();

  const successful =
    successfulRaw === "true" ? true : successfulRaw === "false" ? false : null;

  const payload = {
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
          raceStartAt: data.race_start_at || payload.race_start_at,
          raceTimezone: data.race_timezone || payload.race_timezone,
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
          meeting: data.meeting || payload.meeting,
          raceNumber: data.race_number ?? payload.race_number,
          raceStartAt: data.race_start_at || payload.race_start_at,
          raceTimezone: data.race_timezone || payload.race_timezone,
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
  revalidatePath("/long-term-bets");
}

export async function createMeetingAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
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
    await requireAdmin();
    const supabase = await createClient();

    const meetingId = Number(formData.get("meeting_id"));

    if (!meetingId) {
      return { success: false, error: "Meeting is required." };
    }

    const { error } = await supabase.from("meetings").delete().eq("id", meetingId);

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
      error: error instanceof Error ? error.message : "Failed to delete meeting.",
    };
  }
}

export async function createRaceAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
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
    await requireAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const nextStatus = String(formData.get("next_status") ?? "").trim();

    if (!raceId || !nextStatus) {
      return { success: false, error: "Race and status are required." };
    }

    if (!["draft", "published", "closed"].includes(nextStatus)) {
      return { success: false, error: "Invalid race status." };
    }

    const { data: raceData, error: raceLookupError } = await supabase
      .from("races")
      .select("*")
      .eq("id", raceId)
      .maybeSingle();

    if (raceLookupError) {
      return { success: false, error: raceLookupError.message };
    }

    const meeting =
      raceData?.meeting_id
        ? (
            await supabase
              .from("meetings")
              .select("*")
              .eq("id", raceData.meeting_id)
              .maybeSingle()
          ).data
        : null;

    const payload = {
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("races").update(payload).eq("id", raceId);

    if (error) {
      return { success: false, error: error.message };
    }

    if (nextStatus === "published" && raceData) {
      try {
        await sendPublishedRaceNotification({
          meetingName: meeting?.meeting_name || "Race Meeting",
          raceName: raceData.race_name || `Race ${raceData.race_number}`,
          raceNumber: raceData.race_number || 0,
          distanceM: raceData.distance_m ?? null,
        });
      } catch (notificationError) {
        console.error(notificationError);
      }
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/");
    revalidatePath("/published-races");
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
    await requireAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const { error } = await supabase.from("races").delete().eq("id", raceId);

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
      error: error instanceof Error ? error.message : "Failed to delete race.",
    };
  }
}

export async function createRaceRunnerAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
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
      form_last_6: formLast6 || null,
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
    await requireAdmin();
    const supabase = await createClient();

    const runnerId = Number(formData.get("runner_id"));

    if (!runnerId) {
      return { success: false, error: "Runner is required." };
    }

    const { error } = await supabase.from("race_runners").delete().eq("id", runnerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
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
    await requireAdmin();
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
        form_last_6: formLast6 || null,
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
    await requireAdmin();
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
    await requireAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));

    if (!raceId) {
      return { success: false, error: "Race is required." };
    }

    const { data: raceRunners, error: runnersError } = await supabase
      .from("race_runners")
      .select("id, scratched")
      .eq("race_id", raceId);

    if (runnersError) {
      return { success: false, error: runnersError.message };
    }

    const scratchedMap = new Map<number, boolean>();
    for (const runner of raceRunners || []) {
      scratchedMap.set(Number(runner.id), Boolean((runner as any).scratched));
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

      const startingPriceRaw = String(
        formData.get(`starting_price_${runnerId}`) ?? "",
      ).trim();

      const startingPrice = startingPriceRaw ? Number(startingPriceRaw) : null;

      const hasFinish =
        finishingPosition !== null && !Number.isNaN(finishingPosition);

      updates.push({
        id: runnerId,
        finishing_position: hasFinish ? finishingPosition : null,
        starting_price:
          startingPrice !== null && !Number.isNaN(startingPrice) ? startingPrice : null,
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

    revalidatePath("/admin/race-builder");
    revalidatePath("/current-races");
    revalidatePath("/race-archive");
    revalidatePath("/admin/horses");

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to settle race.",
    };
  }
}
