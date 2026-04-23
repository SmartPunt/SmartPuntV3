"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import {
  settleRaceRunnersAction,
  toggleRacePublishAction,
  toggleRaceRunnerScratchAction,
  updateRaceRunnerDetailsAction,
} from "@/lib/actions";

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
  created_at: string;
  updated_at: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
  track_condition: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
  distance_m: number | null;
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_by: string | null;
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
  form_last_3?: string | null;
  scratched?: boolean | null;
  finishing_position?: number | null;
  starting_price?: number | null;
  won?: boolean | null;
  placed?: boolean | null;
  settled_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RunnerEditState = {
  jockey_name: string;
  trainer_name: string;
  barrier: string;
  market_price: string;
  weight_kg: string;
  is_apprentice: string;
  apprentice_claim_kg: string;
  form_last_6: string;
  track_form_last_6: string;
  distance_form_last_6: string;
};

type ParsedResultRow = {
  horse_name: string;
  finishing_position: number;
};

function formatHorseMeta(horse: Horse | null) {
  if (!horse) return "";
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

function formatMeetingDate(value: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getRaceResultTone(raceRunners: Runner[]) {
  const activeRunners = raceRunners.filter((runner) => !runner.scratched);
  const settledCount = activeRunners.filter(
    (runner) =>
      runner.finishing_position !== null &&
      runner.finishing_position !== undefined &&
      runner.starting_price !== null &&
      runner.starting_price !== undefined,
  ).length;

  if (activeRunners.length === 0) return "amber";
  if (settledCount === 0) return "amber";
  if (settledCount === activeRunners.length) return "green";
  return "blue";
}

function buildRunnerEditState(runner: Runner): RunnerEditState {
  return {
    jockey_name: runner.jockey_name || "",
    trainer_name: runner.trainer_name || "",
    barrier:
      runner.barrier !== null && runner.barrier !== undefined ? String(runner.barrier) : "",
    market_price:
      runner.market_price !== null && runner.market_price !== undefined
        ? String(runner.market_price)
        : "",
    weight_kg:
      runner.weight_kg !== null && runner.weight_kg !== undefined ? String(runner.weight_kg) : "",
    is_apprentice: runner.is_apprentice ? "true" : "false",
    apprentice_claim_kg:
      runner.apprentice_claim_kg !== null && runner.apprentice_claim_kg !== undefined
        ? String(runner.apprentice_claim_kg)
        : "",
    form_last_6: runner.form_last_6 || "",
    track_form_last_6: runner.track_form_last_6 || "",
    distance_form_last_6: runner.distance_form_last_6 || "",
  };
}

function normaliseHorseName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+\(em[0-9]+\)\s*$/i, "")
    .replace(/\s+\(([a-z]{2,3})\)\s*$/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseResultImportText(raw: string): ParsedResultRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ParsedResultRow[] = [];

  function isNoiseLine(line: string) {
    const lower = line.toLowerCase();

    if (
      /^(results?|dividends?|exotics?|quinella|exacta|trifecta|first four|daily double|running double|scratchings?|stewards|margins?|time|official|photo|protest)/i.test(
        lower,
      )
    ) {
      return true;
    }

    if (/^(jockey|trainer|weight|barrier|sp|place|tote|fixed|form|career|prize|colour|track|distance|gear changes)\b/i.test(lower)) {
      return true;
    }

    if (/^\d+(st|nd|rd|th)$/i.test(line)) return false;

    if (/^\d+(\.\d+)?$/.test(line)) return true;
    if (/^\$?\d+(\.\d+)?$/.test(line)) return true;
    if (/^[0-9xX\-]{2,}$/.test(line)) return true;
    if (/^[A-Z]{2,5}\s+\d+$/i.test(line)) return true;

    return false;
  }

  function looksLikeHorseName(line: string) {
    if (!line) return false;
    if (isNoiseLine(line)) return false;

    const cleaned = line
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+\([0-9]+\)\s*$/, "")
      .replace(/\s+\(EM[0-9]+\)\s*$/i, "")
      .trim();

    if (!cleaned) return false;
    if (/^\d/.test(cleaned)) return false;

    const words = cleaned
      .replace(/\s+\(([A-Z]{2,3})\)\s*$/i, "")
      .split(/\s+/)
      .filter(Boolean);

    if (words.length < 1 || words.length > 6) return false;

    return words.every((word) => /^[A-Za-z'’.\-]+$/.test(word));
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const placingMatch = line.match(/^(\d+)(st|nd|rd|th)$/i);
    if (!placingMatch) continue;

    const finishing_position = Number(placingMatch[1]);
    let horse_name = "";

    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      const candidate = lines[j];

      if (!looksLikeHorseName(candidate)) continue;

      horse_name = candidate
        .replace(/^\d+\.\s*/, "")
        .replace(/\s+\([0-9]+\)\s*$/, "")
        .replace(/\s+\(EM[0-9]+\)\s*$/i, "")
        .trim();

      break;
    }

    if (horse_name) {
      rows.push({
        horse_name,
        finishing_position,
      });
    }
  }

  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = normaliseHorseName(row.horse_name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function CurrentRacesPage({
  currentUser,
  initialMeetings,
  initialRaces,
  initialHorses,
  initialRunners,
}: {
  currentUser: any;
  initialMeetings: Meeting[];
  initialRaces: Race[];
  initialHorses: Horse[];
  initialRunners: Runner[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isAdmin =
  currentUser?.role === "admin" || currentUser?.role === "staff_admin";

  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");

  const [raceResultState, setRaceResultState] = useState<
    Record<number, Record<number, { finishingPosition: string; startingPrice: string }>>
  >({});

  const [editingRunnerId, setEditingRunnerId] = useState<number | null>(null);
  const [runnerEditState, setRunnerEditState] = useState<Record<number, RunnerEditState>>({});

  const [resultImportTextByRace, setResultImportTextByRace] = useState<Record<number, string>>({});
  const [parsedResultsByRace, setParsedResultsByRace] = useState<Record<number, ParsedResultRow[]>>(
    {},
  );

  const currentRaces = useMemo(
    () => initialRaces.filter((race) => race.status === "published"),
    [initialRaces],
  );

  const groupedMeetings = useMemo(() => {
    return initialMeetings
      .map((meeting) => {
        const meetingRaces = currentRaces.filter((race) => race.meeting_id === meeting.id);
        return {
          ...meeting,
          races: meetingRaces,
        };
      })
      .filter((meeting) => meeting.races.length > 0);
  }, [currentRaces, initialMeetings]);

  function setSuccess(message: string) {
    setStatusTone("success");
    setStatusMessage(message);
  }

  function setError(message: string) {
    setStatusTone("error");
    setStatusMessage(message);
  }

  function runnersForRace(raceId: number) {
    return initialRunners.filter((runner) => runner.race_id === raceId);
  }

  function findHorse(horseId: number) {
    return initialHorses.find((horse) => horse.id === horseId) || null;
  }

  function findHorseName(horseId: number) {
    return findHorse(horseId)?.horse_name || "Unknown horse";
  }

  function getExistingFinishingPosition(runnerId: number) {
    const runner = initialRunners.find((item) => item.id === runnerId);
    if (!runner || runner.finishing_position === null || runner.finishing_position === undefined) {
      return "";
    }
    return String(runner.finishing_position);
  }

  function getExistingStartingPrice(runnerId: number) {
    const runner = initialRunners.find((item) => item.id === runnerId);
    if (!runner || runner.starting_price === null || runner.starting_price === undefined) {
      return "";
    }
    return String(runner.starting_price);
  }

  function getRaceResultValue(
    raceId: number,
    runnerId: number,
    field: "finishingPosition" | "startingPrice",
  ) {
    const saved = raceResultState[raceId]?.[runnerId]?.[field];
    if (saved !== undefined) return saved;

    return field === "finishingPosition"
      ? getExistingFinishingPosition(runnerId)
      : getExistingStartingPrice(runnerId);
  }

  function handleRaceResultChange(
    raceId: number,
    runnerId: number,
    field: "finishingPosition" | "startingPrice",
    value: string,
  ) {
    setRaceResultState((prev) => ({
      ...prev,
      [raceId]: {
        ...(prev[raceId] || {}),
        [runnerId]: {
          finishingPosition:
            field === "finishingPosition"
              ? value
              : prev[raceId]?.[runnerId]?.finishingPosition ||
                getExistingFinishingPosition(runnerId),
          startingPrice:
            field === "startingPrice"
              ? value
              : prev[raceId]?.[runnerId]?.startingPrice ||
                getExistingStartingPrice(runnerId),
        },
      },
    }));
  }

  function startEditingRunner(runner: Runner) {
    setEditingRunnerId(runner.id);
    setRunnerEditState((prev) => ({
      ...prev,
      [runner.id]: buildRunnerEditState(runner),
    }));
  }

  function cancelEditingRunner() {
    setEditingRunnerId(null);
  }

  function updateRunnerEditField(
    runnerId: number,
    field: keyof RunnerEditState,
    value: string,
  ) {
    setRunnerEditState((prev) => ({
      ...prev,
      [runnerId]: {
        ...(prev[runnerId] || {
          jockey_name: "",
          trainer_name: "",
          barrier: "",
          market_price: "",
          weight_kg: "",
          is_apprentice: "false",
          apprentice_claim_kg: "",
          form_last_6: "",
          track_form_last_6: "",
          distance_form_last_6: "",
        }),
        [field]: value,
      },
    }));
  }

  function handleSaveRunnerDetails(runnerId: number) {
    const values = runnerEditState[runnerId];
    if (!values) {
      setError("No runner changes found.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("runner_id", String(runnerId));
      formData.set("jockey_name", values.jockey_name);
      formData.set("trainer_name", values.trainer_name);
      formData.set("barrier", values.barrier);
      formData.set("market_price", values.market_price);
      formData.set("weight_kg", values.weight_kg);
      formData.set("is_apprentice", values.is_apprentice);
      formData.set("apprentice_claim_kg", values.apprentice_claim_kg);
      formData.set("form_last_6", values.form_last_6);
      formData.set("track_form_last_6", values.track_form_last_6);
      formData.set("distance_form_last_6", values.distance_form_last_6);

      const result = await updateRaceRunnerDetailsAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to update runner.");
        return;
      }

      setEditingRunnerId(null);
      setSuccess("Runner details updated.");
      router.refresh();
    });
  }

  function handleToggleScratch(runner: Runner) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("runner_id", String(runner.id));
      formData.set("scratched", runner.scratched ? "false" : "true");

      const result = await toggleRaceRunnerScratchAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to update scratch status.");
        return;
      }

      setSuccess(runner.scratched ? "Runner reinstated." : "Runner scratched.");
      router.refresh();
    });
  }

  function handleSaveResultsAndCloseRace(raceId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", String(raceId));

      const runners = initialRunners.filter((runner) => runner.race_id === raceId);

      runners.forEach((runner) => {
        formData.set(
          `finishing_position_${runner.id}`,
          getRaceResultValue(raceId, runner.id, "finishingPosition"),
        );
        formData.set(
          `starting_price_${runner.id}`,
          getRaceResultValue(raceId, runner.id, "startingPrice"),
        );
      });

      const settleResult = await settleRaceRunnersAction(formData);

      if (!settleResult.success) {
        setError(settleResult.error || "Failed to settle race.");
        return;
      }

      setSuccess("Race settled and moved to archive.");
      router.refresh();
    });
  }

  function handleMoveBackToBuilder(raceId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", String(raceId));
      formData.set("next_status", "draft");

      const result = await toggleRacePublishAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to move race back to builder.");
        return;
      }

      setSuccess("Race moved back to Race Builder.");
      router.refresh();
    });
  }

  function getSettledCount(raceId: number) {
    const activeRunners = runnersForRace(raceId).filter((runner) => !runner.scratched);

    return activeRunners.filter(
      (runner) =>
        getRaceResultValue(raceId, runner.id, "finishingPosition") !== "" &&
        getRaceResultValue(raceId, runner.id, "startingPrice") !== "",
    ).length;
  }

  function getActiveRunnerCount(raceId: number) {
    return runnersForRace(raceId).filter((runner) => !runner.scratched).length;
  }

  function handleParseResultsImport(raceId: number) {
    const raw = resultImportTextByRace[raceId] || "";
    const parsed = parseResultImportText(raw);

    if (!parsed.length) {
      setError("No results could be parsed from the pasted text.");
      return;
    }

    setParsedResultsByRace((prev) => ({
      ...prev,
      [raceId]: parsed,
    }));

    setSuccess(`Parsed ${parsed.length} result rows. Check the preview, then apply results.`);
  }

  function handleApplyParsedResults(raceId: number) {
    const parsed = parsedResultsByRace[raceId] || [];
    const raceRunners = runnersForRace(raceId);

    if (!parsed.length) {
      setError("No parsed results found for this race.");
      return;
    }

    const parsedMap = new Map<string, number>();
    parsed.forEach((row) => {
      parsedMap.set(normaliseHorseName(row.horse_name), row.finishing_position);
    });

    setRaceResultState((prev) => {
      const nextRaceState = { ...(prev[raceId] || {}) };

      raceRunners.forEach((runner) => {
        const horseName = findHorseName(runner.horse_id);
        const normalised = normaliseHorseName(horseName);
        const matchedPosition = parsedMap.get(normalised);

        if (matchedPosition !== undefined) {
          nextRaceState[runner.id] = {
            finishingPosition: String(matchedPosition),
            startingPrice:
              prev[raceId]?.[runner.id]?.startingPrice || getExistingStartingPrice(runner.id),
          };
        } else {
          nextRaceState[runner.id] = {
            finishingPosition: "",
            startingPrice: "",
          };
        }
      });

      return {
        ...prev,
        [raceId]: nextRaceState,
      };
    });

    setSuccess("Parsed results applied. Horses missing from the pasted list can now be scratched, then save results and close the race.");
  }

  function handleClearResultsImport(raceId: number) {
    setResultImportTextByRace((prev) => ({
      ...prev,
      [raceId]: "",
    }));
    setParsedResultsByRace((prev) => ({
      ...prev,
      [raceId]: [],
    }));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-black/80 p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Badge tone="green">Current Races</Badge>
              </div>

              <div className="mt-4">
                <p className="text-lg font-bold text-white">
                  {currentUser.full_name || currentUser.email}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {isAdmin ? "Admin race control room" : "Subscriber race board"}
                </p>
              </div>

<div className="mt-6 space-y-2">
  {isAdmin ? (
    <>
      <Link
        href="/admin/race-builder"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Race Builder
      </Link>
      <Link
        href="/race-archive"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Race Archive
      </Link>
      <Link
        href="/"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Back to Admin
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="block w-full rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
        >
          Log Out
        </button>
      </form>
    </>
  ) : (
    <>
      <Link
        href="/race-archive"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Race Archive
      </Link>
      <Link
        href="/"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Back to Dashboard
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="block w-full rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
        >
          Log Out
        </button>
      </form>
    </>
  )}
</div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Published races
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{currentRaces.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Meetings live
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{groupedMeetings.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Runners loaded
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {initialRunners.filter((runner) =>
                      currentRaces.some((race) => race.id === runner.race_id),
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
              <img
                src="/header-logo.png"
                alt="Fortune on 5"
                className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-95 sm:w-[420px] lg:w-[900px]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_30%,rgba(0,0,0,0.52)_100%)]" />

              <div className="relative z-10 flex min-h-[220px] flex-col justify-end p-4 lg:min-h-[280px] lg:p-8">
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
<div className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
      Fortune on 5 current races
    </h1>
    <p className="text-sm text-zinc-200 lg:text-base">
      {isAdmin
        ? "Manage published races here, make live runner changes, scratch horses, then result the full field."
        : "View published races here, track the full field, and follow the live board."}
    </p>
  </div>

  <div className="flex items-center gap-2">
    <Link
      href="/"
      className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
    >
      Back to Dashboard
    </Link>

    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
      >
        Log Out
      </button>
    </form>
  </div>
</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="green">Published races only</Badge>
                    <Badge tone={isAdmin ? "blue" : "amber"}>
                      {isAdmin ? "Admin only controls" : "Subscriber view only"}
                    </Badge>
                    <Badge tone="amber">{isAdmin ? "Live control room" : "Live race board"}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {statusMessage && isAdmin ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  statusTone === "success"
                    ? "border-emerald-300/20 bg-emerald-100 text-emerald-950"
                    : "border-red-300/20 bg-red-100 text-red-900"
                }`}
              >
                {statusMessage}
              </div>
            ) : null}

            <div>
              <Panel className="bg-white/95">
                <div className="space-y-5 p-6 text-zinc-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Current race board</h2>
                      <p className="text-sm text-zinc-500">
                        {isAdmin
                          ? "Update runners, scratch horses, then save the whole field and close the race."
                          : "View runners, current fields, and race-day form in one place."}
                      </p>
                    </div>
                    <Badge tone="green">{currentRaces.length} published</Badge>
                  </div>

                  {groupedMeetings.length > 0 ? (
                    <div className="space-y-6">
                      {groupedMeetings.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="rounded-[28px] border border-amber-200/30 bg-white p-5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-2xl font-bold tracking-tight text-zinc-950">
                                {meeting.meeting_name}
                              </h3>
                              <p className="mt-1 text-sm text-zinc-500">
                                {formatMeetingDate(meeting.meeting_date)}
                                {meeting.track_condition ? ` · ${meeting.track_condition}` : ""}
                              </p>
                            </div>

                            <Badge tone="blue">{meeting.races.length} current races</Badge>
                          </div>

                          <div className="mt-5 space-y-5">
                            {meeting.races.map((race) => {
                              const raceRunners = runnersForRace(race.id);
                              const activeRunnerCount = getActiveRunnerCount(race.id);
                              const settledCount = getSettledCount(race.id);
                              const parsedRows = parsedResultsByRace[race.id] || [];

                              return (
                                <div
                                  key={race.id}
                                  className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-lg font-semibold text-zinc-950">
                                          R{race.race_number} {race.race_name}
                                        </p>
                                        <Badge tone="green">published</Badge>
                                        <Badge tone={getRaceResultTone(raceRunners)}>
                                          {settledCount}/{activeRunnerCount} completed
                                        </Badge>
                                      </div>

                                      <p className="mt-1 text-sm text-zinc-500">
                                        {race.distance_m || "—"}m
                                      </p>
                                    </div>

                                    {isAdmin ? (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveBackToBuilder(race.id)}
                                          disabled={isPending}
                                          className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
                                        >
                                          Move Back to Builder
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleSaveResultsAndCloseRace(race.id)}
                                          disabled={isPending}
                                          className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                                        >
                                          {isPending ? "Saving..." : "Save Results + Close Race"}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-4 rounded-[20px] border border-blue-200/40 bg-blue-50 p-4 text-sm text-zinc-700">
                                    {isAdmin
                                      ? "Live admin lane: edit the runner, scratch it if needed, then result the race when the field is official."
                                      : "Subscriber view: follow the field, market and form updates without editing controls."}
                                  </div>

                                  {isAdmin ? (
                                    <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-700">
                                            Quick result import
                                          </h4>
                                          <p className="mt-1 text-sm text-zinc-600">
                                            Paste one ordered results list. Missing horses can then be scratched before closing the race.
                                          </p>
                                        </div>
                                        {parsedRows.length > 0 ? (
                                          <Badge tone="green">{parsedRows.length} parsed</Badge>
                                        ) : (
                                          <Badge tone="amber">Stage 1</Badge>
                                        )}
                                      </div>

                                      <div className="mt-4">
                                        <textarea
                                          value={resultImportTextByRace[race.id] || ""}
                                          onChange={(e) =>
                                            setResultImportTextByRace((prev) => ({
                                              ...prev,
                                              [race.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Paste ordered results here, one horse per line..."
                                          className="min-h-[140px] w-full rounded-2xl border border-amber-200/30 px-4 py-4 outline-none transition focus:border-amber-300"
                                        />
                                      </div>

                                      <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                          type="button"
                                          onClick={() => handleParseResultsImport(race.id)}
                                          disabled={isPending}
                                          className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                                        >
                                          Parse Results
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleApplyParsedResults(race.id)}
                                          disabled={isPending || parsedRows.length === 0}
                                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                                        >
                                          Apply Results
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleClearResultsImport(race.id)}
                                          disabled={isPending}
                                          className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                                        >
                                          Clear
                                        </button>
                                      </div>

                                      {parsedRows.length > 0 ? (
                                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                            Parsed result preview
                                          </p>
                                          <div className="mt-3 space-y-2">
                                            {parsedRows.map((row) => (
                                              <div
                                                key={`${race.id}-${row.finishing_position}-${row.horse_name}`}
                                                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                                              >
                                                <span className="font-medium text-zinc-900">
                                                  {row.horse_name}
                                                </span>
                                                <Badge tone="green">{row.finishing_position}</Badge>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="mt-5 space-y-3">
                                    {raceRunners.length > 0 ? (
                                      raceRunners.map((runner) => {
                                        const horse = findHorse(runner.horse_id);
                                        const isEditing = editingRunnerId === runner.id;
                                        const editValues =
                                          runnerEditState[runner.id] || buildRunnerEditState(runner);

                                        return (
                                          <div
                                            key={runner.id}
                                            className={`rounded-2xl border p-4 ${
                                              runner.scratched
                                                ? "border-red-200 bg-red-50"
                                                : "border-zinc-200 bg-white"
                                            }`}
                                          >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                              <div>
                                                <p className="font-semibold text-zinc-950">
                                                  {findHorseName(runner.horse_id)}
                                                </p>
                                                <p className="text-sm text-zinc-500">
                                                  {formatHorseMeta(horse) || "Horse profile not loaded yet"}
                                                </p>
                                                <p className="mt-1 text-sm text-zinc-500">
                                                  Jockey: {runner.jockey_name || "—"}
                                                  {runner.is_apprentice
                                                    ? ` (Apprentice${
                                                        runner.apprentice_claim_kg !== null &&
                                                        runner.apprentice_claim_kg !== undefined
                                                          ? `, -${runner.apprentice_claim_kg}kg`
                                                          : ""
                                                      })`
                                                    : ""}
                                                  {" · "}Trainer: {runner.trainer_name || "—"}
                                                </p>
                                              </div>

                                              <div className="flex flex-wrap items-center gap-2">
                                                {runner.scratched ? (
                                                  <Badge tone="rose">Scratched</Badge>
                                                ) : null}
                                                {runner.barrier ? (
                                                  <Badge tone="blue">Barrier {runner.barrier}</Badge>
                                                ) : null}
                                                {runner.weight_kg !== null && runner.weight_kg !== undefined ? (
                                                  <Badge tone="amber">{runner.weight_kg}kg</Badge>
                                                ) : null}
                                                {runner.market_price !== null ? (
                                                  <Badge tone="green">${runner.market_price}</Badge>
                                                ) : null}
                                                {runner.form_last_6 ? (
                                                  <Badge tone="slate">{runner.form_last_6}</Badge>
                                                ) : null}
                                                {!runner.scratched &&
                                                runner.finishing_position !== null &&
                                                runner.finishing_position !== undefined ? (
                                                  <Badge
                                                    tone={
                                                      runner.finishing_position === 1
                                                        ? "green"
                                                        : runner.finishing_position <= 3
                                                          ? "blue"
                                                          : "rose"
                                                    }
                                                  >
                                                    Fin: {runner.finishing_position}
                                                  </Badge>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                  Last 6
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                                  {runner.form_last_6 || "—"}
                                                </p>
                                              </div>

                                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                  Track form
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                                  {runner.track_form_last_6 || "—"}
                                                </p>
                                              </div>

                                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                  Distance form
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-zinc-900">
                                                  {runner.distance_form_last_6 || "—"}
                                                </p>
                                              </div>
                                            </div>

                                            {isAdmin ? (
                                              <>
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      isEditing
                                                        ? cancelEditingRunner()
                                                        : startEditingRunner(runner)
                                                    }
                                                    disabled={isPending}
                                                    className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
                                                  >
                                                    {isEditing ? "Cancel Edit" : "Edit Runner"}
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleScratch(runner)}
                                                    disabled={isPending}
                                                    className={`rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                                                      runner.scratched
                                                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                                        : "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                                                    }`}
                                                  >
                                                    {runner.scratched ? "Reinstate" : "Scratch Horse"}
                                                  </button>
                                                </div>

                                                {isEditing ? (
                                                  <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Jockey
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={editValues.jockey_name}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "jockey_name",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Trainer
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={editValues.trainer_name}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "trainer_name",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>
                                                    </div>

                                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Barrier
                                                        </label>
                                                        <input
                                                          type="number"
                                                          value={editValues.barrier}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "barrier",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Market price
                                                        </label>
                                                        <input
                                                          type="number"
                                                          step="0.01"
                                                          value={editValues.market_price}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "market_price",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Weight (kg)
                                                        </label>
                                                        <input
                                                          type="number"
                                                          step="0.5"
                                                          value={editValues.weight_kg}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "weight_kg",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>
                                                    </div>

                                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Apprentice
                                                        </label>
                                                        <select
                                                          value={editValues.is_apprentice}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "is_apprentice",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        >
                                                          <option value="false">No</option>
                                                          <option value="true">Yes</option>
                                                        </select>
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Claim (kg)
                                                        </label>
                                                        <input
                                                          type="number"
                                                          step="0.5"
                                                          value={editValues.apprentice_claim_kg}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "apprentice_claim_kg",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>
                                                    </div>

                                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Last 6
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={editValues.form_last_6}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "form_last_6",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Track form
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={editValues.track_form_last_6}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "track_form_last_6",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>

                                                      <div>
                                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                          Distance form
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={editValues.distance_form_last_6}
                                                          onChange={(e) =>
                                                            updateRunnerEditField(
                                                              runner.id,
                                                              "distance_form_last_6",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                        />
                                                      </div>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleSaveRunnerDetails(runner.id)}
                                                        disabled={isPending}
                                                        className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                                                      >
                                                        {isPending ? "Saving..." : "Save Runner Changes"}
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={cancelEditingRunner}
                                                        disabled={isPending}
                                                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {!runner.scratched ? (
                                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    <div>
                                                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                        Finishing position
                                                      </label>
                                                      <input
                                                        type="number"
                                                        value={getRaceResultValue(
                                                          race.id,
                                                          runner.id,
                                                          "finishingPosition",
                                                        )}
                                                        onChange={(e) =>
                                                          handleRaceResultChange(
                                                            race.id,
                                                            runner.id,
                                                            "finishingPosition",
                                                            e.target.value,
                                                          )
                                                        }
                                                        placeholder="1"
                                                        className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                      />
                                                    </div>

                                                    <div>
                                                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                        Starting price
                                                      </label>
                                                      <input
                                                        type="number"
                                                        step="0.01"
                                                        value={getRaceResultValue(
                                                          race.id,
                                                          runner.id,
                                                          "startingPrice",
                                                        )}
                                                        onChange={(e) =>
                                                          handleRaceResultChange(
                                                            race.id,
                                                            runner.id,
                                                            "startingPrice",
                                                            e.target.value,
                                                          )
                                                        }
                                                        placeholder="4.20"
                                                        className="mt-2 w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
                                                      />
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
                                                    This runner is scratched and will be excluded from result entry.
                                                  </div>
                                                )}
                                              </>
                                            ) : null}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-zinc-500">
                                        No runners loaded into this race yet.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                      <p className="text-lg font-semibold text-zinc-900">No current races loaded.</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        {isAdmin
                          ? "Publish a draft race from Race Builder and it’ll land here ready to manage."
                          : "Once races are published, they’ll land here ready to follow."}
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <h3 className="text-lg font-semibold">What this page does now</h3>
                  <div className="mt-4 space-y-2 text-sm text-zinc-600">
                    <p>• Shows published races only</p>
                    <p>{isAdmin ? "• Handles full-field result entry" : "• Lets subscribers follow full fields"}</p>
                    <p>{isAdmin ? "• Lets admin edit runner details" : "• Displays live runner details"}</p>
                    <p>{isAdmin ? "• Supports scratch and reinstate" : "• Keeps admin controls hidden"}</p>
                  </div>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <h3 className="text-lg font-semibold">What happens on save</h3>
                  <div className="mt-4 space-y-2 text-sm text-zinc-600">
                    {isAdmin ? (
                      <>
                        <p>• Runner details are updated live</p>
                        <p>• Scratched horses stay in race history</p>
                        <p>• Resulting excludes scratched runners</p>
                      </>
                    ) : (
                      <>
                        <p>• Subscribers can view live market and form</p>
                        <p>• Admin manages all race-day changes</p>
                        <p>• Results move to archive once settled</p>
                      </>
                    )}
                  </div>
                </div>
              </Panel>

              <Panel className="bg-white/95">
                <div className="p-6 text-zinc-950">
                  <h3 className="text-lg font-semibold">Next build step</h3>
                  <div className="mt-4 space-y-2 text-sm text-zinc-600">
                    <p>• Auto-finalise matching tips</p>
                    <p>• Prefill horse form on future race builds</p>
                    <p>• Add post-race admin notes</p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
