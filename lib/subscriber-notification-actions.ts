"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markSubscriberNotificationReadAction(
  notificationId: number,
) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return {
      success: false,
      error: "You must be signed in.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("subscriber_notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  if (error) {
    console.error(
      "Could not mark subscriber notification as read:",
      error,
    );

    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath("/subscriber-dashboard");

  return {
    success: true,
  };
}

export async function markAllSubscriberNotificationsReadAction() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return {
      success: false,
      error: "You must be signed in.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("subscriber_notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  if (error) {
    console.error(
      "Could not mark all subscriber notifications as read:",
      error,
    );

    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath("/subscriber-dashboard");

  return {
    success: true,
  };
}
