import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const startedAt = Date.now();

  console.log("[SmartPunt Auth Debug] getCurrentProfile START");

  const clientStartedAt = Date.now();
  const supabase = await createClient();

  console.log("[SmartPunt Auth Debug] createClient DONE", {
    durationMs: Date.now() - clientStartedAt,
    totalDurationMs: Date.now() - startedAt,
  });

  const authStartedAt = Date.now();

  console.log("[SmartPunt Auth Debug] auth.getUser START", {
    totalDurationMs: Date.now() - startedAt,
  });

  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  console.log("[SmartPunt Auth Debug] auth.getUser DONE", {
    durationMs: Date.now() - authStartedAt,
    totalDurationMs: Date.now() - startedAt,
    hasUser: Boolean(auth.user),
    hasError: Boolean(authError),
    errorMessage: authError?.message ?? null,
  });

  if (!auth.user) {
    console.log("[SmartPunt Auth Debug] NO USER - returning null", {
      totalDurationMs: Date.now() - startedAt,
    });

    return null;
  }

  const profileStartedAt = Date.now();

  console.log("[SmartPunt Auth Debug] profiles query START", {
    totalDurationMs: Date.now() - startedAt,
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", auth.user.id)
    .single();

  console.log("[SmartPunt Auth Debug] profiles query DONE", {
    durationMs: Date.now() - profileStartedAt,
    totalDurationMs: Date.now() - startedAt,
    hasProfile: Boolean(profile),
    hasError: Boolean(profileError),
    errorMessage: profileError?.message ?? null,
  });

  console.log("[SmartPunt Auth Debug] getCurrentProfile COMPLETE", {
    totalDurationMs: Date.now() - startedAt,
  });

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
