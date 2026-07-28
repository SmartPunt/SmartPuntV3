import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

function AdminLink({
  href,
  eyebrow,
  title,
  description,
  icon,
  featured = false,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-[1.75rem] border p-5 shadow-xl shadow-black/35 transition active:scale-[0.99] ${
        featured
          ? "border-amber-300/40 bg-[linear-gradient(135deg,rgba(245,158,11,0.24),rgba(24,24,27,0.98),rgba(0,0,0,0.96))]"
          : "border-white/10 bg-[linear-gradient(145deg,rgba(24,24,27,0.96),rgba(0,0,0,0.96))]"
      }`}
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl transition group-hover:bg-amber-300/20" />

      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl ${
            featured
              ? "border-amber-200/35 bg-amber-300/15"
              : "border-white/10 bg-white/5"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {description}
          </p>
        </div>

        <span className="shrink-0 text-xl font-black text-amber-300">
          ›
        </span>
      </div>
    </Link>
  );
}

export default async function MobileAdminPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.status !== "active" ||
    !["admin", "staff_admin"].includes(profile.role)
  ) {
    redirect("/");
  }

  const displayName =
    profile.full_name ||
    profile.email ||
    "SmartPunt Admin";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.22),transparent_30%),linear-gradient(180deg,#030303_0%,#09090b_50%,#020617_100%)] px-3 py-4 text-white">
      <div className="mx-auto max-w-[460px]">
        <header className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(0,0,0,0.97),rgba(24,24,27,0.98),rgba(146,64,14,0.32))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_28px_rgba(245,158,11,0.28)]">
              <img
                src="/smartpunt-icon-512.png"
                alt="SmartPunt"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
                SmartPunt
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                Mobile Admin
              </h1>
            </div>
          </div>

          <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">
            Welcome, {displayName}
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Fast race-day tools designed for publishing and managing
            The Maverick&apos;s selections from your phone.
          </p>

<div className="mt-5 grid grid-cols-2 gap-2">
  <Link
    href="/subscriber-dashboard"
    className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-300/15"
  >
    Subscriber Dashboard
  </Link>

  <Link
    href="/the-vault"
    className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/10"
  >
    The Vault
  </Link>

<Link
  href="/"
  className="flex-1 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-300/15"
>
  Desktop Admin
</Link>
</div>
        </header>

        <main className="mt-4 space-y-3 pb-10">
          <AdminLink
            href="/current-races"
            eyebrow="Race Day"
            title="Today’s Races"
            description="Open today’s meetings and move quickly through the active race program."
            icon="🏇"
            featured
          />

<AdminLink
  href="/mobile-admin/tips"
  eyebrow="The Maverick"
  title="Publish a Tip"
  description="Choose today or tomorrow, select a meeting, race and runner, then publish directly from your phone."
  icon="⭐"
  featured
/>

          <AdminLink
            href="/admin/maverick-report"
            eyebrow="Performance"
            title="Maverick Report"
            description="Review strike rate, profit, ROI, confidence and tip-angle performance."
            icon="📈"
          />

          <AdminLink
            href="/smartpunt-calculator-live-picks"
            eyebrow="Subscriber View"
            title="Live Picks"
            description="See the same live racing information available to SmartPunt subscribers."
            icon="📱"
          />

<section className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-400/[0.07] p-5">
  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
    Mobile Workflow Live
  </p>

  <h2 className="mt-2 text-lg font-black text-white">
    Phone Tip Publishing
  </h2>

  <p className="mt-2 text-sm leading-6 text-zinc-400">
    The Maverick can now move from meeting to race to runner,
    enter official odds and publish directly from the mobile admin.
  </p>
</section>
        </main>
      </div>
    </div>
  );
}
