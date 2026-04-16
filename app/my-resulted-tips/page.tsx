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

  const activeTipIdsQuery = await supabase
    .from("user_active_tips")
    .select("tip_id")
    .eq("user_id", profile.id);

  const activeTipIds = (activeTipIdsQuery.data || []).map((row: any) => row.tip_id);

  let tips: any[] = [];

  if (activeTipIds.length > 0) {
    const tipsQuery = await supabase
      .from("suggested_tips")
      .select("*")
      .in("id", activeTipIds)
      .not("settled_at", "is", null)
      .order("settled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    tips = tipsQuery.data || [];
  }

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

  const meetings = meetingsQuery.data || [];
  const races = racesQuery.data || [];
  const runners = runnersQuery.data || [];
  const horses = horsesQuery.data || [];

  return (
    <ResultedTipsBoard
      title="My resulted tips"
      subtitle="Your settled plays, now showing linked runner detail where available."
      currentUser={profile}
      tips={tips}
      meetings={meetings}
      races={races}
      runners={runners}
      horses={horses}
      backHref="/"
      backLabel="Back to Dashboard"
      emptyTitle="No resulted active tips yet."
      emptyText="Once one of your marked active tips is settled, it’ll show here."
    />
  );
}
