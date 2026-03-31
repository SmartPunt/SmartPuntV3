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
    serviceRoleKey,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
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

  if (!resendApiKey || !fromEmail) {
    console.warn("Notification skipped: missing Resend environment variables.");
    return;
  }

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

  const subject = `New SmartPunt Tip: ${race} - ${horse}`;
  const preview = commentary?.trim() || `${horse} has been added as a new SmartPunt tip.`;

  const html = (email: string) => `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #111827;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="padding: 24px; background: linear-gradient(135deg, #171717, #3f3f46, #ca8a04); color: white;">
          <div style="font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 0.8;">SmartPunt</div>
          <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.2;">New Tip Just Dropped</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Premium racing club alert</p>
        </div>

        <div style="padding: 24px;">
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
            ${preview}
          </p>

          ${
            appUrl
              ? `<div style="margin-top: 24px;">
                  <a href="${appUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#fbbf24;text-decoration:none;font-weight:700;">
                    View in SmartPunt
                  </a>
                 </div>`
              : ""
          }

          <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
            Sent to ${email} because you’re an active SmartPunt subscriber.
          </p>
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

export async function upsertSuggestedTip(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isNew = !id;
  const sendNotification = String(formData.get("send_notification") ?? "") === "true";

  const raceDate = String(formData.get("race_date") ?? "");
  const raceTime = String(formData.get("race_time") ?? "");
  const raceTimezone = String(formData.get("race_timezone") ?? "Australia/Perth");

  let raceStartAt: string | null = null;

  if (raceDate && raceTime) {
    const naive = `${raceDate}T${raceTime}:00`;
    raceStartAt = `${naive}${getTimezoneOffsetSuffix(raceTimezone)}`;
  }

  const payload = {
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    type: String(formData.get("type") ?? "Win"),
    confidence: String(formData.get("confidence") ?? "High"),
    note: String(formData.get("note") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    race_start_at: raceStartAt,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("suggested_tips")
      .update(payload)
      .eq("id", Number(id));

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { data, error } = await supabase
      .from("suggested_tips")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

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
}

function getTimezoneOffsetSuffix(timezone: string) {
  const offsets: Record<string, string> = {
    "Australia/Perth": "+08:00",
    "Australia/Adelaide": "+09:30",
    "Australia/Darwin": "+09:30",
    "Australia/Brisbane": "+10:00",
    "Australia/Sydney": "+10:00",
    "Australia/Melbourne": "+10:00",
    "Australia/Hobart": "+10:00",
  };

  return offsets[timezone] || "+08:00";
}

export async function deleteSuggestedTipAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("suggested_tips")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
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

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function deleteWatchItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

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

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function deleteLongTermBetAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("long_term_bets")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
