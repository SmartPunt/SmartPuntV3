import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import ResultedTipsBoard from "@/components/resulted-tips-board";

export default async function Page() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();

  const tipsQuery = await supabase
    .from("suggested_tips")
    .select("*")
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const meetingsQuery = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  const racesQuery = await supabase
    .from("races")
    .select("*")
    .order("updated_at", { ascending: false });

  const runnersQuery = await supabase
    .from("race_runners")
    .select("*")
    .order("updated_at", { ascending: false });

  const horsesQuery = await supabase
    .from("horses")
    .select("*")
    .order("horse_name", { ascending: true });

  const tips = tipsQuery.data || [];
  const meetings = meetingsQuery.data || [];
  const races = racesQuery.data || [];
  const runners = runnersQuery.data || [];
  const horses = horsesQuery.data || [];

  return (
    <ResultedTipsBoard
      title="Fortune on 5 resulted tips"
      subtitle="Every settled tip in one place, with linked field detail where SmartPunt has it."
      currentUser={profile}
      tips={tips}
      meetings={meetings}
      races={races}
      runners={runners}
      horses={horses}
      backHref={profile.role === "admin" ? "/" : "/"}
      backLabel={profile.role === "admin" ? "Back to Admin" : "Back to Dashboard"}
      emptyTitle="No resulted tips yet."
      emptyText="Once live tips are settled, they’ll land here."
    />
  );
}
