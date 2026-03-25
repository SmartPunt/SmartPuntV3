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

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function upsertSuggestedTip(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const payload = {
    race: String(formData.get("race") ?? ""),
    horse: String(formData.get("horse") ?? ""),
    type: String(formData.get("type") ?? "Win"),
    confidence: String(formData.get("confidence") ?? "High"),
    note: String(formData.get("note") ?? ""),
    commentary: String(formData.get("commentary") ?? ""),
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("suggested_tips").update(payload).eq("id", Number(id))
    : supabase.from("suggested_tips").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteSuggestedTipAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("suggested_tips").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
