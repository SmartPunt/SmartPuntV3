import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", auth.user.id)
    .single();

  return profile;
}

export function isFullAdmin(profile: any) {
  return !!profile && profile.role === "admin" && profile.status === "active";
}

export function isRacingOpsAdmin(profile: any) {
  return (
    !!profile &&
    (profile.role === "admin" || profile.role === "staff_admin") &&
    profile.status === "active"
  );
}
