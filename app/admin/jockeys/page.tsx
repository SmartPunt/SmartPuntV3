import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminJockeyProfiles from "@/components/admin-jockey-profiles";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");

  const supabase = await createClient();

  const { data: jockeyProfiles, error } = await supabase
    .from("jockey_profiles")
    .select("*")
    .order("jockey_name", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-2xl font-bold">Jockey Profiles</h1>
        <p className="mt-4 text-red-300">{error.message}</p>
        <Link href="/" className="mt-6 inline-block text-amber-300">
          Back to Admin
        </Link>
      </div>
    );
  }

  return <AdminJockeyProfiles initialProfiles={jockeyProfiles || []} />;
}
