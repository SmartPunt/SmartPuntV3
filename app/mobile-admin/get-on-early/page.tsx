import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
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

        <MobileAdminGetOnEarly />
      </div>
    </div>
  );
}
