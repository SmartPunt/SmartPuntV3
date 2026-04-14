import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge, Panel } from "@/components/ui";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function Page({
  params,
}: {
  params: Promise<{ horseId: string }>;
}) {
  const { horseId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/");
  }

  const horseIdNumber = Number(horseId);

  if (!horseIdNumber) {
    notFound();
  }

  const supabase = await createClient();

  const { data: horse, error: horseError } = await supabase
    .from("horses")
    .select("*")
    .eq("id", horseIdNumber)
    .maybeSingle();

  if (horseError || !horse) {
    notFound();
  }

  const { data: allRunners } = await supabase
    .from("race_runners")
    .select("*")
    .eq("horse_id", horseIdNumber)
    .order("created_at", { ascending: false });

  const { data: races } = await supabase
    .from("races")
    .select("*")
    .order("meeting_id", { ascending: false })
    .order("race_number", { ascending: true });

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });

  const runners = allRunners || [];
  const raceList = races || [];
  const meetingList = meetings || [];

  const latestRunner = runners[0] || null;

  const uniqueJockeys = Array.from(
    new Set(
      runners
        .map((runner: any) => runner.jockey_name)
        .filter(Boolean),
    ),
  );

  const uniqueTrainers = Array.from(
    new Set(
      runners
        .map((runner: any) => runner.trainer_name)
        .filter(Boolean),
    ),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 lg:min-h-[280px] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <Badge tone="amber">Horse Profile</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Saved Horses
                </Link>
                <Link
                  href="/admin/race-builder"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Builder
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  {horse.horse_name}
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Saved horse profile built from SmartPunt runner history.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {profile.full_name || profile.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{runners.length} runner records</Badge>
                <Badge tone="blue">{uniqueJockeys.length} jockeys used</Badge>
                <Badge tone="amber">{uniqueTrainers.length} trainers used</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Horse Name</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{horse.horse_name}</p>
                <Badge tone="amber">Saved</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">First Added</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{formatDate(horse.created_at)}</p>
                <Badge tone="blue">Library</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Jockey</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.jockey_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-4 text-zinc-950">
              <p className="text-sm text-zinc-500">Latest Trainer</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-semibold">{latestRunner?.trainer_name || "—"}</p>
                <Badge tone="slate">Current</Badge>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h2 className="text-xl font-semibold">Horse summary</h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Normalised name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {horse.normalised_name || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Total runner records
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {runners.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Jockeys used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueJockeys.length > 0 ? (
                      uniqueJockeys.map((jockey) => (
                        <Badge key={jockey} tone="blue">
                          {jockey}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Trainers used
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueTrainers.length > 0 ? (
                      uniqueTrainers.map((trainer) => (
                        <Badge key={trainer} tone="amber">
                          {trainer}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Runner history</h2>
                  <p className="text-sm text-zinc-500">
                    This is the saved in-app history for this horse from Race Builder.
                  </p>
                </div>
                <Badge tone="green">{runners.length} records</Badge>
              </div>

              <div className="mt-5 space-y-4">
                {runners.length > 0 ? (
                  runners.map((runner: any) => {
                    const race = raceList.find((item: any) => item.id === runner.race_id);
                    const meeting = race
                      ? meetingList.find((item: any) => item.id === race.meeting_id)
                      : null;

                    return (
                      <div
                        key={runner.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">
                              {meeting
                                ? `${meeting.meeting_name} · ${meeting.meeting_date}`
                                : "Unknown meeting"}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                              {race
                                ? `R${race.race_number} ${race.race_name}`
                                : "Unknown race"}
                            </h3>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {race?.status ? (
                              <Badge tone={race.status === "published" ? "green" : race.status === "closed" ? "rose" : "amber"}>
                                {race.status}
                              </Badge>
                            ) : null}
                            {race?.distance_m ? (
                              <Badge tone="blue">{race.distance_m}m</Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Jockey
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {runner.jockey_name || "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Trainer
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {runner.trainer_name || "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Barrier
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {runner.barrier ?? "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Market
                            </p>
                            <p className="mt-2 text-sm font-semibold text-zinc-900">
                              {runner.market_price !== null ? `$${runner.market_price}` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Last 3 starts snapshot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-900">
                            {runner.form_last_3 || "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-amber-200/30 bg-white p-5 text-sm text-zinc-500">
                    No runner history saved for this horse yet.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
