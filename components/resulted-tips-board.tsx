"use client";

import Link from "next/link";
import { Badge, Panel, TipPill } from "@/components/ui";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Runner = {
  id: number;
  race_id: number;
  horse_id: number;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  market_price: number | null;
  weight_kg: number | null;
  is_apprentice: boolean | null;
  apprentice_claim_kg: number | null;
  form_last_6: string | null;
  track_form_last_6: string | null;
  distance_form_last_6: string | null;
  scratched?: boolean | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_at: string;
  updated_at: string;
};

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
};

type SuggestedTip = {
  id: number;
  meeting_id: number | null;
  race_id: number | null;
  horse_id: number | null;
  race_runner_id: number | null;
  race: string;
  horse: string;
  type: string;
  confidence: string;
  note: string | null;
  commentary: string | null;
  result_comment: string | null;
  race_start_at: string | null;
  race_timezone: string | null;
  finishing_position: number | null;
  successful: boolean | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
};

function formatRaceDateTime(value?: string | null, timezone?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone || "Australia/Perth",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

function formatSettledAt(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTipCardStyle(type: string, successful: boolean | null) {
  if (successful === true) return "border-emerald-300/50 bg-emerald-50";
  if (successful === false) return "border-rose-300/50 bg-rose-50";

  if (type === "Win") return "border-emerald-300/40 bg-emerald-50";
  if (type === "Place") return "border-sky-300/40 bg-sky-50";
  if (type === "All Up") return "border-pink-300/40 bg-pink-50";
  return "border-zinc-200 bg-white";
}

function formatLinkedRaceLabel(race: Race | null, meeting: Meeting | null) {
  if (!race) return null;
  return `${meeting?.meeting_name || "Meeting"} R${race.race_number} ${race.race_name}`;
}

export default function ResultedTipsBoard({
  title,
  subtitle,
  currentUser,
  tips,
  meetings,
  races,
  runners,
  horses,
  backHref,
  backLabel,
  emptyTitle,
  emptyText,
}: {
  title: string;
  subtitle: string;
  currentUser: any;
  tips: SuggestedTip[];
  meetings: Meeting[];
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  backHref: string;
  backLabel: string;
  emptyTitle: string;
  emptyText: string;
}) {
  const sortedTips = [...tips].sort((a, b) => {
    const aTime = a.settled_at ? new Date(a.settled_at).getTime() : 0;
    const bTime = b.settled_at ? new Date(b.settled_at).getTime() : 0;
    return bTime - aTime;
  });

  const meetingMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const raceMap = new Map(races.map((race) => [race.id, race]));
  const runnerMap = new Map(runners.map((runner) => [runner.id, runner]));
  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));

  function getLinkedRunner(tip: SuggestedTip) {
    if (!tip.race_runner_id) return null;
    return runnerMap.get(tip.race_runner_id) || null;
  }

  function getLinkedRace(tip: SuggestedTip) {
    if (!tip.race_id) return null;
    return raceMap.get(tip.race_id) || null;
  }

  function getLinkedMeeting(tip: SuggestedTip) {
    if (!tip.meeting_id) return null;
    return meetingMap.get(tip.meeting_id) || null;
  }

  function getLinkedHorse(tip: SuggestedTip) {
    if (!tip.horse_id) return null;
    return horseMap.get(tip.horse_id) || null;
  }

  function renderLinkedRaceBadges(tip: SuggestedTip) {
    const runner = getLinkedRunner(tip);
    const badges: React.ReactNode[] = [];

    if (!runner) return null;

    if (runner.barrier !== null && runner.barrier !== undefined) {
      badges.push(
        <Badge key="barrier" tone="blue">
          Barrier {runner.barrier}
        </Badge>,
      );
    }

    if (runner.starting_price !== null && runner.starting_price !== undefined) {
      badges.push(
        <Badge key="sp" tone="green">
          SP ${runner.starting_price}
        </Badge>,
      );
    } else if (runner.market_price !== null && runner.market_price !== undefined) {
      badges.push(
        <Badge key="price" tone="green">
          ${runner.market_price}
        </Badge>,
      );
    }

    if (runner.weight_kg !== null && runner.weight_kg !== undefined) {
      badges.push(
        <Badge key="weight" tone="amber">
          {runner.weight_kg}kg
        </Badge>,
      );
    }

    if (runner.form_last_6) {
      badges.push(
        <Badge key="form" tone="slate">
          {runner.form_last_6}
        </Badge>,
      );
    }

    if (runner.finishing_position !== null && runner.finishing_position !== undefined) {
      badges.push(
        <Badge
          key="fin"
          tone={
            runner.finishing_position === 1
              ? "green"
              : runner.finishing_position <= 3
                ? "blue"
                : "rose"
          }
        >
          Fin {runner.finishing_position}
        </Badge>,
      );
    }

    return badges.length ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null;
  }

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
              <Badge tone="amber">Resulted Tips</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href={backHref}
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  {backLabel}
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">{subtitle}</p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">{sortedTips.filter((tip) => tip.successful === true).length} winners</Badge>
                <Badge tone="rose">{sortedTips.filter((tip) => tip.successful === false).length} misses</Badge>
                <Badge tone="blue">{sortedTips.filter((tip) => tip.race_runner_id).length} linked runners</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Settled board</h2>
                  <p className="text-sm text-zinc-500">
                    Full settled view with linked field detail where available.
                  </p>
                </div>
                <Badge tone="amber">{sortedTips.length}</Badge>
              </div>

              {sortedTips.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {sortedTips.map((tip) => {
                    const linkedRunner = getLinkedRunner(tip);
                    const linkedRace = getLinkedRace(tip);
                    const linkedMeeting = getLinkedMeeting(tip);
                    const linkedHorse = getLinkedHorse(tip);
                    const linkedRaceLabel = formatLinkedRaceLabel(linkedRace, linkedMeeting);
                    const raceDateTime = formatRaceDateTime(tip.race_start_at, tip.race_timezone);
                    const settledAt = formatSettledAt(tip.settled_at);

                    return (
                      <div
                        key={tip.id}
                        className={`rounded-[28px] border p-5 shadow-sm ${getTipCardStyle(
                          tip.type,
                          tip.successful,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">{tip.race}</p>
                            <h3 className="mt-1 text-xl font-bold text-zinc-950">
                              {tip.horse}
                            </h3>

                            {linkedRaceLabel ? (
                              <p className="mt-2 text-sm font-medium text-zinc-700">
                                Linked field: {linkedRaceLabel}
                              </p>
                            ) : null}

                            {linkedHorse?.sex || linkedHorse?.age ? (
                              <p className="mt-1 text-sm text-zinc-500">
                                {[linkedHorse.sex, linkedHorse.age ? `${linkedHorse.age}yo` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>

                          <TipPill type={tip.type} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {tip.confidence ? <Badge tone="blue">{tip.confidence}</Badge> : null}
                          {tip.note ? <Badge tone="amber">{tip.note}</Badge> : null}
                          {raceDateTime ? <Badge tone="slate">{raceDateTime}</Badge> : null}
                          {tip.finishing_position !== null && tip.finishing_position !== undefined ? (
                            <Badge
                              tone={
                                tip.finishing_position === 1
                                  ? "green"
                                  : tip.finishing_position <= 3
                                    ? "blue"
                                    : "rose"
                              }
                            >
                              Fin {tip.finishing_position}
                            </Badge>
                          ) : null}
                          {tip.successful === true ? <Badge tone="green">Successful</Badge> : null}
                          {tip.successful === false ? <Badge tone="rose">Unsuccessful</Badge> : null}
                          {tip.race_runner_id ? <Badge tone="blue">Linked runner</Badge> : null}
                        </div>

                        {renderLinkedRaceBadges(tip)}

                        {tip.commentary ? (
                          <p className="mt-4 text-sm leading-7 text-zinc-700">{tip.commentary}</p>
                        ) : null}

                        {tip.result_comment ? (
                          <div className="mt-4 rounded-2xl bg-zinc-950/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Post-race analysis
                            </p>
                            <p className="mt-2 text-sm leading-7 text-zinc-700">
                              {tip.result_comment}
                            </p>
                          </div>
                        ) : null}

                        {linkedRunner?.trainer_name || linkedRunner?.jockey_name || settledAt ? (
                          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/70 p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                  Jockey
                                </p>
                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                  {linkedRunner?.jockey_name || "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                  Trainer
                                </p>
                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                  {linkedRunner?.trainer_name || "—"}
                                </p>
                              </div>
                            </div>

                            {settledAt ? (
                              <div className="mt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                  Settled
                                </p>
                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                  {settledAt}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-lg font-semibold text-zinc-900">{emptyTitle}</p>
                  <p className="mt-2 text-sm text-zinc-500">{emptyText}</p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
