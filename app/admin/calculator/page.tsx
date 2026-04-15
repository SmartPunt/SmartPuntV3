import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AdminCalculator from "@/components/admin-calculator";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: races } = await supabase
    .from("races")
    .select("*")
    .order("meeting_id", { ascending: false })
    .order("race_number", { ascending: true });

  const { data: runners } = await supabase
    .from("race_runners")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: horses } = await supabase
    .from("horses")
    .select("*")
    .order("horse_name", { ascending: true });

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  return (
    <AdminCalculator
      races={races || []}
      runners={runners || []}
      horses={horses || []}
      meetings={meetings || []}
    />
  );
}
