import Link from "next/link";
import { redirect } from "next/navigation";
import AppEntryLoader from "@/components/app-entry-loader";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import VaultHorseSearch from "@/components/vault-horse-search";
import VaultSavedAlertsPanel from "@/components/vault-saved-alerts-panel";
import type { VaultEditableAlert } from "@/lib/vault-actions";
import { loadSubscriberLivePicksData } from "@/lib/subscriber-live-picks-data";
import {
  syncVaultNotifications,
  type VaultLiveMatch,
} from "@/lib/vault-matching";

export const dynamic = "force-dynamic";

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

if (
  profile.status !== "active" ||
  !["user", "admin", "staff_admin"].includes(profile.role)
) {
  redirect("/");
}

const supabase = await createClient();

const livePicksData = await loadSubscriberLivePicksData({
  userId: profile.id,
  includeScoringHistory: false,
  includeJockeyProfiles: false,
  includeCalculatorTips: false,
  includeCalculatorPredictions: false,
  includeOfficialTips: false,
  includeActiveUserBets: false,
});

const vaultState = await syncVaultNotifications({
  userId: profile.id,
  liveData: {
    dayDates: {
      today: livePicksData.dayDates.today,
      tomorrow: livePicksData.dayDates.tomorrow,
    },
    currentMeetings: livePicksData.currentMeetings,
    currentRaces: livePicksData.currentRaces,
    currentRunners: livePicksData.currentRunners,
    horses: livePicksData.horses,
  },
});

const { data: alertsData, error: alertsError } =
  await supabase
    .from("vault_alerts")
.select(
  "id, alert_name, alert_type, target_name, horse_id, enabled, jockey_names, trainer_names, track_names, distance_buckets, track_conditions, min_effective_barrier, max_effective_barrier",
)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

if (alertsError) {
  throw new Error(
    alertsError.message || "Could not load Vault alerts.",
  );
}

const alerts = (alertsData || []) as VaultEditableAlert[];

const liveRaceIds = new Set(
  livePicksData.currentRaces
    .filter((race) => {
      if (race.status !== "published") {
        return false;
      }

      const meeting =
        livePicksData.currentMeetings.find(
          (item) =>
            Number(item.id) ===
            Number(race.meeting_id),
        );

      return (
        meeting?.meeting_date ===
        livePicksData.dayDates.today
      );
    })
    .map((race) => Number(race.id)),
);

const notifications = (
  vaultState.matches as VaultLiveMatch[]
).filter((match) =>
  liveRaceIds.has(Number(match.raceId)),
);

const enabledAlertCount = alerts.filter(
  (alert) => alert.enabled,
).length;

  return (
<AppEntryLoader
  vaultIntro
  minimumDisplayMs={2500}
>
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
  <Link
    href="#add-to-vault"
    className="inline-flex rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110"
  >
    Add To Vault
  </Link>
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

<VaultHorseSearch />

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
  key={notification.notificationId}
  href={`/smartpunt-calculator-live-picks?raceId=${notification.raceId}`}
  className="block rounded-[1.5rem] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-4 transition hover:border-amber-300/45 hover:bg-white/[0.08]"
>
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
        Vault Match
      </p>

      <div className="mt-2 flex items-center gap-2">
        {notification.runnerNumber ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 text-xs font-black text-black">
            {notification.runnerNumber}
          </span>
        ) : null}

        <h3 className="truncate text-xl font-black text-white">
          {notification.horseName}
        </h3>
      </div>

      <p className="mt-2 text-sm font-bold text-amber-100">
        {notification.meetingName} R
        {notification.raceNumber}
      </p>

      <p className="mt-1 text-sm text-zinc-400">
        {notification.raceName}
        {notification.distanceM
          ? ` · ${notification.distanceM}m`
          : ""}
        {notification.trackCondition
          ? ` · ${notification.trackCondition}`
          : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {notification.jockeyName ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300">
            J: {notification.jockeyName}
          </span>
        ) : null}

        {notification.barrier ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300">
            Barrier {notification.barrier}
          </span>
        ) : null}

        {notification.effectiveBarrier ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">
            Effective {notification.effectiveBarrier}
          </span>
        ) : null}
      </div>
    </div>

    <span className="shrink-0 text-2xl">🔔</span>
  </div>

  <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
      Matched
    </p>

    {notification.matchedRules.map(
      (rule, index) => (
        <p
          key={`${rule.type}-${index}`}
          className="mt-1 text-xs font-semibold text-zinc-300"
        >
          ✓ {rule.label}: {rule.value}
        </p>
      ),
    )}
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

              <VaultSavedAlertsPanel alerts={alerts} />

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
