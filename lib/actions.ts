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

  const subject = `🔥 ${horse} – ${race}`;
  const preview = commentary?.trim() || `${horse} has been tipped.`;

  const html = (email: string) => `
    <div style="background:#0a0a0a;padding:30px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#111111;border-radius:20px;overflow:hidden;border:1px solid rgba(251,191,36,0.15);">

        <!-- HEADER -->
        <div style="padding:24px;text-align:center;border-bottom:1px solid rgba(251,191,36,0.10);background:linear-gradient(180deg,#111111 0%,#171717 100%);">
          ${
            appUrl
              ? `<img src="${appUrl}/header-logo.png" alt="Fortune on 5" style="height:60px;width:auto;margin:0 auto 10px;display:block;" />`
              : ""
          }
          <div style="color:#fbbf24;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;">
            Fortune on 5
          </div>
          <div style="color:#d4d4d8;font-size:13px;margin-top:8px;">
            Premium racing club alert
          </div>
        </div>

        <!-- TIP -->
        <div style="padding:24px;color:#ffffff;">
          <div style="color:#a1a1aa;font-size:13px;">${race}</div>

          <div style="font-size:28px;font-weight:700;line-height:1.2;margin-top:4px;color:#ffffff;">
            ${horse}
          </div>

          <!-- BADGES -->
          <div style="margin-top:16px;">
            <span style="display:inline-block;background:#052e16;color:#86efac;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px;margin-bottom:6px;">
              ${type}
            </span>
            <span style="display:inline-block;background:#082f49;color:#7dd3fc;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px;margin-bottom:6px;">
              ${confidence} confidence
            </span>
            ${
              note
                ? `<span style="display:inline-block;background:#451a03;color:#fcd34d;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:6px;">
                    ${note}
                  </span>`
                : ""
            }
          </div>

          <!-- COMMENTARY -->
          <div style="margin-top:20px;background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px;">
            <div style="font-size:15px;line-height:1.7;color:#e4e4e7;">
              ${preview}
            </div>
          </div>

          <!-- CTA -->
          ${
            appUrl
              ? `<div style="margin-top:24px;">
                  <a href="${appUrl}" style="display:inline-block;background:#000000;color:#fbbf24;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;border:1px solid rgba(251,191,36,0.30);">
                    View Full Tips
                  </a>
                </div>`
              : ""
          }

          <!-- FOOTER -->
          <div style="margin-top:24px;font-size:11px;color:#71717a;">
            Sent to ${email} because you’re an active SmartPunt subscriber.
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

// rest unchanged...

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
