import Link from "next/link";
import { redirect } from "next/navigation";
import AppEntryLoader from "@/components/app-entry-loader";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VaultAlert = {
  id: number;
  alert_name: string;
  alert_type: string;
  target_name: string;
  horse_id: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type VaultNotification = {
  id: number;
  alert_id: number;
  race_id: number;
  race_runner_id: number;
  horse_id: number | null;
  meeting_date: string;
  matched_rules: unknown;
  seen: boolean;
  clicked: boolean;
  first_matched_at: string;
  last_matched_at: string;
};

function StatCard({
  eyebrow,
  value,
  label,
  icon,
}: {
  eyebrow: string;
  value: number;
  label: string;
  icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(0,0,0,0.9),rgba(24,24,27,0.86))] p-4 shadow-xl shadow-black/30">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
            {eyebrow}
          </p>

          <span className="text-lg">{icon}</span>
        </div>

        <p className="mt-3 text-4xl font-black leading-none tracking-tight text-white">
          {value}
        </p>

        <p className="mt-2 min-h-[2rem] text-xs font-semibold leading-4 text-zinc-400">
          {label}
        </p>
      </div>
    </div>
  );
}

export default async function TheVaultPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/");
  }

  if (profile.role === "staff_admin") {
    redirect("/current-races");
  }

  if (profile.role !== "user") {
    redirect("/");
  }

  const supabase = await createClient();

  const [alertsQuery, notificationsQuery] = await Promise.all([
    supabase
      .from("vault_alerts")
      .select(
        "id, alert_name, alert_type, target_name, horse_id, enabled, created_at, updated_at",
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("vault_notifications")
      .select(
        "id, alert_id, race_id, race_runner_id, horse_id, meeting_date, matched_rules, seen, clicked, first_matched_at, last_matched_at",
      )
      .eq("seen", false)
      .order("meeting_date", { ascending: true })
      .order("first_matched_at", { ascending: false }),
  ]);

  if (alertsQuery.error) {
    throw new Error(
      alertsQuery.error.message || "Could not load Vault alerts.",
    );
  }

  if (notificationsQuery.error) {
    throw new Error(
      notificationsQuery.error.message ||
        "Could not load Vault notifications.",
    );
  }

  const alerts = (alertsQuery.data || []) as VaultAlert[];
  const notifications =
    (notificationsQuery.data || []) as VaultNotification[];

  const enabledAlertCount = alerts.filter(
    (alert) => alert.enabled,
  ).length;

  return (
    <AppEntryLoader>
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(217,119,6,0.12),transparent_26%),linear-gradient(180deg,#030303_0%,#09090b_45%,#020617_100%)] text-white">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 lg:px-8">
          <header className="sticky top-2 z-20 rounded-[1.75rem] border border-amber-300/20 bg-black/82 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_28px_rgba(245,158,11,0.25)]">
                  <img
                    src="/smartpunt-icon-512.png"
                    alt="SmartPunt"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
                    SmartPunt
                  </p>

                  <h1 className="mt-0.5 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                    The Vault
                  </h1>
                </div>
              </div>

              <Link
                href="/subscriber-dashboard"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-white/10"
              >
                Dashboard
              </Link>
            </div>
          </header>

          <main className="mt-4 space-y-5 pb-8">
            <section className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.96),rgba(24,24,27,0.98),rgba(146,64,14,0.32))] shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
              <div className="relative p-5 sm:p-8">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-l from-amber-300/50 to-transparent" />

                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                      Personal Racing Intelligence
                    </span>

                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                      Vault Foundation Live
                    </span>
                  </div>

                  <h2 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
                    Your horses.
                    <br />
                    Your rules.
                    <br />
                    <span className="text-amber-300">Your edge.</span>
                  </h2>

                  <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-200 sm:text-base">
                    Save the horses that matter to you and build personalised
                    alerts for the exact racing situations you want to follow.
                  </p>

                  <div className="mt-6">
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black opacity-65 shadow-lg shadow-amber-500/20"
                    >
                      Add To Vault — Next Stage
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                eyebrow="Live Alerts"
                value={notifications.length}
                label="Unseen Vault matches"
                icon="🔔"
              />

              <StatCard
                eyebrow="Saved Alerts"
                value={alerts.length}
                label="Rules stored in your Vault"
                icon="🔐"
              />

              <div className="col-span-2 sm:col-span-1">
                <StatCard
                  eyebrow="Active"
                  value={enabledAlertCount}
                  label="Currently watching races"
                  icon="⚡"
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    Vault Matches
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Current Notifications
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    Horses and opportunities currently matching your Vault
                    rules.
                  </p>
                </div>

                <span className="flex h-11 min-w-11 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-black text-amber-200">
                  {notifications.length}
                </span>
              </div>

              <div className="mt-5">
                {notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <Link
                        key={notification.id}
                        href={`/smartpunt-calculator-live-picks?raceId=${notification.race_id}`}
                        className="block rounded-[1.5rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-4 transition hover:border-amber-300/45 hover:bg-white/[0.08]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                              Vault Match
                            </p>

                            <h3 className="mt-2 text-lg font-black text-white">
                              Race notification
                            </h3>

                            <p className="mt-1 text-sm text-zinc-400">
                              Meeting date: {notification.meeting_date}
                            </p>
                          </div>

                          <span className="text-2xl">🔔</span>
                        </div>

                        <p className="mt-4 border-t border-white/10 pt-3 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                          Open Race →
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-7 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl">
                      🔔
                    </div>

                    <h3 className="mt-4 text-lg font-black text-white">
                      No Vault matches yet
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      Once you add horses to The Vault, matching current and
                      upcoming races will appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-black/82 p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    My Vault
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Saved Alerts
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    Your saved horses and personalised racing rules.
                  </p>
                </div>

                <span className="flex h-11 min-w-11 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-black text-amber-200">
                  {alerts.length}
                </span>
              </div>

              <div className="mt-5">
                {alerts.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {alerts.map((alert) => (
                      <article
                        key={alert.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                              {alert.alert_type}
                            </p>

                            <h3 className="mt-2 truncate text-xl font-black text-white">
                              {alert.target_name}
                            </h3>

                            <p className="mt-1 truncate text-sm text-zinc-400">
                              {alert.alert_name}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              alert.enabled
                                ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                                : "border-white/10 bg-white/5 text-zinc-400"
                            }`}
                          >
                            {alert.enabled ? "Active" : "Paused"}
                          </span>
                        </div>

                        <div className="mt-4 border-t border-white/10 pt-3">
                          <p className="text-xs font-semibold text-zinc-500">
                            Vault editing arrives in the next stage.
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-7 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl">
                      🔐
                    </div>

                    <h3 className="mt-4 text-lg font-black text-white">
                      Your Vault is empty
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      The next stage adds horse search and lets subscribers save
                      their first personalised Vault alert.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(0,0,0,0.92),rgba(24,24,27,0.95))] p-5 shadow-2xl shadow-black/30">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">
                SmartPunt Vault
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                The foundation is ready
              </h2>

              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Horse alerts come first. Track, distance, condition, jockey,
                trainer, barrier and SmartPunt intelligence filters will build
                on top of the same Vault foundation.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/subscriber-dashboard"
                  className="rounded-2xl border border-amber-300/30 px-4 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-300/10"
                >
                  Back To Dashboard
                </Link>

                <Link
                  href="/smartpunt-calculator-live-picks"
                  className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Live Picks
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </AppEntryLoader>
  );
}
