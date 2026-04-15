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

async function getActiveSubscriberEmails() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "user")
    .eq("status", "active");

  return (data || []).map((p: any) => p.email).filter(Boolean);
}

async function sendBatchEmails(emails: any[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emails),
  });
}

/* ===================================================== */
/* ✅ UPDATED FUNCTION */
/* ===================================================== */

export async function toggleRacePublishAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const raceId = Number(formData.get("race_id"));
    const nextStatus = String(formData.get("next_status"));

    const { error } = await supabase
      .from("races")
      .update({
        status: nextStatus,
        published_at: nextStatus === "published" ? new Date().toISOString() : null,
      })
      .eq("id", raceId);

    if (error) return { success: false, error: error.message };

    // 🚀 EMAIL TRIGGER
    if (nextStatus === "published") {
      try {
        const recipients = await getActiveSubscriberEmails();

        await sendBatchEmails(
          recipients.map((email) => ({
            from: process.env.RESEND_FROM_EMAIL!,
            to: [email],
            subject: "📣 New Race Field — SmartPunt",
            html: `
              <div style="padding:20px;font-family:Arial;">
                <h2>New Race Published</h2>
                <p>A new race field is now live.</p>
                <a href="${process.env.SMARTPUNT_APP_URL}/published-races">
                  View Race Fields
                </a>
              </div>
            `,
          })),
        );
      } catch (err) {
        console.error("Email error:", err);
      }
    }

    revalidatePath("/admin/race-builder");
    revalidatePath("/");
    revalidatePath("/published-races");

    return { success: true, error: null };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed",
    };
  }
}
