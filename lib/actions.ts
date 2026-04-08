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
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.SMARTPUNT_APP_URL || "";

  if (!resendApiKey || !fromEmail) return;

  const supabase = await createClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "user")
    .eq("status", "active");

  if (profilesError) {
    throw new Error(`Failed to load subscriber emails: ${profilesError.message}`);
  }

  const recipients = (profiles || [])
    .map((profile: any) => String(profile.email || "").trim())
    .filter(Boolean);

  if (!recipients.length) return;

  const safeRace = escapeHtml(race || "");
  const safeHorse = escapeHtml(horse || "");
  const safeType = escapeHtml(type || "Win");
  const safeConfidence = escapeHtml(confidence || "High");
  const safeNote = escapeHtml(note || "");
  const safeCommentary = String(commentary || "").trim();
  const preview = safeCommentary || `${horse} has been tipped.`;

  const alertLabel = getAlertLabel(type, confidence);
  const safeAlertLabel = escapeHtml(alertLabel);
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

  const html = (email: string) => `
    <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
      <div style="padding:24px 12px;background:#050505;">
        <div style="max-width:640px;margin:0 auto;background:#0b0b0b;border:1px solid rgba(251,191,36,0.18);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);">

          <div style="background:#000000;line-height:0;">
            ${
              appUrl
                ? `<img
                    src="${appUrl}/header-logo.png"
                    alt="SmartPunt"
                    style="display:block;width:100%;height:auto;margin:0;padding:0;border:0;"
                  />`
                : ""
            }
          </div>

          <div style="padding:18px 22px 0 22px;background:linear-gradient(180deg,#0b0b0b 0%,#111111 100%);">
            <div style="display:inline-block;background:#f59e0b;color:#111111;padding:7px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">
              New SmartPunt Drop
            </div>
          </div>

          <div style="padding:18px 22px 10px 22px;background:linear-gradient(180deg,#111111 0%,#0b0b0b 100%);">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;font-weight:800;">
              ${safeAlertLabel}
            </div>

            <div style="font-size:34px;line-height:1.08;font-weight:900;color:#ffffff;margin-top:10px;">
              🔥 ${safeHorse}
            </div>

            <div style="font-size:15px;line-height:1.5;color:#d4d4d8;margin-top:10px;">
              ${safeRace}
            </div>

            ${
              countdownLabel || formattedRaceTime
                ? `<div style="margin-top:18px;">
                    ${
                      countdownLabel
                        ? `<span style="display:inline-block;background:#1f2937;color:#fde68a;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:800;margin-right:8px;margin-bottom:8px;border:1px solid rgba(251,191,36,0.18);">
                            ⏱ ${escapeHtml(countdownLabel)}
                          </span>`
                        : ""
                    }
                    ${
                      formattedRaceTime
                        ? `<span style="display:inline-block;background:#111827;color:#cbd5e1;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-right:8px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);">
                            📍 ${escapeHtml(formattedRaceTime)}
                          </span>`
                        : ""
                    }
                  </div>`
                : ""
            }
          </div>

          <div style="padding:0 22px 22px 22px;background:#0b0b0b;">
            <div style="background:linear-gradient(180deg,#171717 0%,#101010 100%);border:1px solid rgba(251,191,36,0.16);border-radius:20px;padding:18px 18px 16px 18px;">
              <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;font-weight:800;">
                Suggested Play
              </div>
              <div style="font-size:18px;line-height:1.5;color:#ffffff;font-weight:800;margin-top:10px;">
                ${suggestedPlayLine}
              </div>

              <div style="margin-top:14px;">
                <span style="display:inline-block;background:#052e16;color:#86efac;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:800;margin-right:6px;margin-bottom:6px;">
                  ${safeType}
                </span>
                <span style="display:inline-block;background:#082f49;color:#7dd3fc;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:800;margin-right:6px;margin-bottom:6px;">
                  ${safeConfidence} confidence
                </span>
                ${
                  safeNote
                    ? `<span style="display:inline-block;background:#451a03;color:#fcd34d;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:800;margin-bottom:6px;">
                        ${safeNote}
                      </span>`
                    : ""
                }
              </div>
            </div>

            <div style="margin-top:16px;background:#151515;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:18px;">
              <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;font-weight:800;">
                Mickey’s Call
              </div>
              <div style="font-size:16px;line-height:1.75;color:#f4f4f5;margin-top:10px;">
                ${nl2br(preview)}
              </div>
            </div>

            ${
              appUrl
                ? `<div style="margin-top:20px;">
                    <a
                      href="${appUrl}"
                      style="display:block;width:100%;box-sizing:border-box;background:#f59e0b;color:#111111;text-decoration:none;text-align:center;padding:16px 18px;border-radius:16px;font-size:16px;font-weight:900;letter-spacing:0.02em;border:1px solid rgba(245,158,11,0.60);"
                    >
                      👉 Open SmartPunt
                    </a>
                  </div>`
                : ""
            }

            <div style="margin-top:18px;font-size:13px;line-height:1.7;color:#a1a1aa;">
              You’re getting this because you’re inside SmartPunt. Stay sharp — the next edge lands fast.
            </div>

            <div style="margin-top:10px;font-size:11px;line-height:1.6;color:#6b7280;">
              Sent to ${escapeHtml(email)}.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const emails = recipients.map((email) => ({
    from: fromEmail,
    to: [email],
    subject,
    html: html(email),
  }));

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

  const payload = {
    title: String(formData.get("title") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    bet_type: String(formData.get("bet_type") ?? "Win"),
    odds: String(formData.get("odds") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("long_term_bets").update(payload).eq("id", Number(id))
    : supabase.from("long_term_bets").insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function deleteLongTermBetAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("long_term_bets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}
