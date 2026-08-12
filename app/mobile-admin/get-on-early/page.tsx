import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MobileAdminGetOnEarly from "@/components/mobile-admin-get-on-early";

export const dynamic = "force-dynamic";

export default async function MobileAdminGetOnEarlyPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

if (
    profile.status !== "active" ||
    profile.role !== "admin"
  ) {
    redirect("/mobile-admin");
  }

  const supabase = await createClient();

  const {
    data: getOnEarlyItems,
    error: getOnEarlyError,
  } = await supabase
    .from("long_term_bets")
    .select(
      "id, horse, meeting, race_number, race_date, bet_type, odds, created_at",
    )
    .order("race_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (getOnEarlyError) {
    throw new Error(
      getOnEarlyError.message,
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,#030303_0%,#09090b_50%,#020617_100%)] px-3 py-4 text-white">
      <div className="mx-auto max-w-[460px]">
        <div className="mb-4">
          <Link
            href="/mobile-admin"
            className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-sky-200"
          >
            ← Mobile Admin
          </Link>
        </div>

<MobileAdminGetOnEarly
  getOnEarlyItems={
    getOnEarlyItems || []
  }
/>
      </div>
    </div>
  );
}
