"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import {
  abandonMeetingAction,
  abandonRaceAction,
  bulkScratchRaceRunnersAction,
  settleRaceRunnersAction,
  toggleRacePublishAction,
  toggleRaceRunnerScratchAction,
  updateRaceRunnerDetailsAction,
  startRaceDayAction,
  updateMeetingConditionAction,
  updateMeetingDetailsAction,
  updateRaceDetailsAction,
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
  calculator_released_at: string | null;
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
place_terms?: "win_only" | "top_2" | "top_3" | null;
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
type ParsedScratchingRow = {
  meeting_name: string;
  race_number: number;
  horse_name: string;
};

type ScratchingMatchRow = ParsedScratchingRow & {
  race_id: number;
  runner_id: number;
  matched_horse_name: string;
  already_scratched: boolean;
};

type ScratchingUnmatchedRow = ParsedScratchingRow & {
  reason: string;
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
    .replace(/['’`]/g, "")
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
function parseScratchingsImportText(raw: string): ParsedScratchingRow[] {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ParsedScratchingRow[] = [];
  let currentMeeting = "";
  let currentRaceNumber: number | null = null;

  function isStateLine(line: string) {
    return /^\(([A-Z]{2,3}|NZL|US|CA)\)$/i.test(line);
  }

  function isNoiseLine(line: string) {
    const lower = line.toLowerCase();

    return (
      lower === "final" ||
      lower === "today" ||
      lower === "tomorrow" ||
      lower === "scratchings" ||
      lower === "dual acceptors" ||
      lower === "jockey changes" ||
      lower.includes("racenet") ||
      lower.includes("unlock") ||
      lower.includes("login") ||
      lower.includes("copyright") ||
      lower.includes("gambling") ||
      lower.includes("bookmaker") ||
      lower.includes("newsletter")
    );
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || "";

    if (isStateLine(nextLine)) {
      currentMeeting = line;
      currentRaceNumber = null;
      continue;
    }

    const raceMatch = line.match(/^R(\d+)$/i);

    if (raceMatch) {
      currentRaceNumber = Number(raceMatch[1]);
      continue;
    }

    const horseMatch = line.match(/^(\d+)\.\s*(.+)$/);

    if (!horseMatch || !currentMeeting || !currentRaceNumber) {
      continue;
    }

    const horseName = horseMatch[2]
      .replace(/\s+\(EM[0-9]+\)\s*$/i, "")
      .trim();

    if (!horseName || isNoiseLine(horseName)) {
      continue;
    }

    rows.push({
      meeting_name: currentMeeting,
      race_number: currentRaceNumber,
      horse_name: horseName,
    });
  }

  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = `${normaliseHorseName(row.meeting_name)}|${row.race_number}|${normaliseHorseName(
      row.horse_name,
    )}`;

    if (!normaliseHorseName(row.horse_name) || seen.has(key)) return false;

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
  const [openRaceIds, setOpenRaceIds] = useState<Record<number, boolean>>({});
  const [editingMeetingIds, setEditingMeetingIds] = useState<number[]>([]);
  const [editingRaceIds, setEditingRaceIds] = useState<number[]>([]);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
const [closedRaceIds, setClosedRaceIds] = useState<number[]>([]);
const [resultPreviewRaceId, setResultPreviewRaceId] = useState<number | null>(
  null,
);

  const [raceResultState, setRaceResultState] = useState<
    Record<number, Record<number, { finishingPosition: string; startingPrice: string }>>
  >({});

  const [editingRunnerId, setEditingRunnerId] = useState<number | null>(null);
  const [runnerEditState, setRunnerEditState] = useState<Record<number, RunnerEditState>>({});

  const [resultImportTextByRace, setResultImportTextByRace] = useState<Record<number, string>>({});
  const [parsedResultsByRace, setParsedResultsByRace] = useState<Record<number, ParsedResultRow[]>>(
    {},
  );
const [scratchingsImportText, setScratchingsImportText] = useState("");
const [parsedScratchings, setParsedScratchings] = useState<ParsedScratchingRow[]>([]);
const [scratchingsPreviewOpen, setScratchingsPreviewOpen] = useState(false);
const currentRaces = useMemo(
  () =>
    initialRaces.filter(
      (race) =>
        race.status === "published" && !closedRaceIds.includes(race.id),
    ),
  [initialRaces, closedRaceIds],
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
function toggleRaceOpen(raceId: number) {
  setOpenRaceIds((prev) => ({
    ...prev,
    [raceId]: !prev[raceId],
  }));
}

function isRaceOpen(raceId: number) {
  return openRaceIds[raceId] === true;
}
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
            : (prev[raceId]?.[runnerId]?.finishingPosition ??
              getExistingFinishingPosition(runnerId)),
        startingPrice:
          field === "startingPrice"
            ? value
            : (prev[raceId]?.[runnerId]?.startingPrice ??
              getExistingStartingPrice(runnerId)),
      },
    },
  }));
}

  function handleUpdateTrackCondition(meetingId: number, value: string) {
  startTransition(async () => {
    const formData = new FormData();
    formData.set("meeting_id", String(meetingId));
    formData.set("track_condition", value);

    const result = await updateMeetingConditionAction(formData);

    if (!result.success) {
      setError(result.error || "Failed to update track condition.");
      return;
    }

    setSuccess("Track condition updated.");
    router.refresh();
  });
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

function getRaceResultPreview(raceId: number) {
  return runnersForRace(raceId)
    .filter((runner) => !runner.scratched)
    .map((runner) => {
      const finishingPositionRaw = getRaceResultValue(
        raceId,
        runner.id,
        "finishingPosition",
      ).trim();

      const startingPriceRaw = getRaceResultValue(
        raceId,
        runner.id,
        "startingPrice",
      ).trim();

      return {
        runner,
        horseName: findHorseName(runner.horse_id),
        finishingPositionRaw,
        finishingPosition: Number(finishingPositionRaw),
        startingPriceRaw,
        startingPrice: Number(startingPriceRaw),
      };
    })
    .sort((a, b) => {
      const positionGap = a.finishingPosition - b.finishingPosition;

      if (positionGap !== 0) {
        return positionGap;
      }

      return a.horseName.localeCompare(b.horseName);
    });
}

function validateRaceResults(raceId: number) {
  const previewRows = getRaceResultPreview(raceId);
  const activeRunnerCount = previewRows.length;

  if (activeRunnerCount === 0) {
    return {
      valid: false,
      error: "This race has no active runners to result.",
      rows: previewRows,
    };
  }

  const missingFinishes = previewRows.filter(
    (row) => !row.finishingPositionRaw,
  );

  if (missingFinishes.length > 0) {
    return {
      valid: false,
      error: `Enter a finishing position for: ${missingFinishes
        .map((row) => row.horseName)
        .join(", ")}.`,
      rows: previewRows,
    };
  }

  const invalidFinishes = previewRows.filter(
    (row) =>
      !Number.isInteger(row.finishingPosition) ||
      row.finishingPosition < 1 ||
      row.finishingPosition > activeRunnerCount,
  );

  if (invalidFinishes.length > 0) {
    return {
      valid: false,
      error: `Finishing positions must be whole numbers from 1 to ${activeRunnerCount}. Check: ${invalidFinishes
        .map((row) => row.horseName)
        .join(", ")}.`,
      rows: previewRows,
    };
  }

  const firstPlaceRows = previewRows.filter(
    (row) => row.finishingPosition === 1,
  );

  if (firstPlaceRows.length === 0) {
    return {
      valid: false,
      error: "At least one runner must be entered as finishing position 1.",
      rows: previewRows,
    };
  }

const invalidStartingPrices = previewRows.filter(
  (row) =>
    row.startingPriceRaw !== "" &&
    (!Number.isFinite(row.startingPrice) || row.startingPrice <= 1),
);

if (invalidStartingPrices.length > 0) {
  return {
    valid: false,
    error: `Any entered starting price must be greater than 1.00. Check: ${invalidStartingPrices
      .map((row) => row.horseName)
      .join(", ")}.`,
    rows: previewRows,
  };
}

  return {
    valid: true,
    error: null,
    rows: previewRows,
  };
}

function handlePreviewResults(raceId: number) {
  const validation = validateRaceResults(raceId);

  if (!validation.valid) {
    setResultPreviewRaceId(null);
    setError(
      validation.error ||
        "Check the race results before previewing.",
    );
    return;
  }

  setResultPreviewRaceId(raceId);
  setSuccess(
    "Results preview ready. Nothing has been saved or closed yet.",
  );
}

function handleSaveResultsAndCloseRace(raceId: number) {
  const validation = validateRaceResults(raceId);

  if (!validation.valid) {
    setResultPreviewRaceId(null);
    setError(
      validation.error ||
        "Check the race results before saving.",
    );
    return;
  }

  startTransition(async () => {
    const formData = new FormData();
    formData.set("race_id", String(raceId));

    const runners = initialRunners.filter(
      (runner) => runner.race_id === raceId,
    );

    runners.forEach((runner) => {
      formData.set(
        `finishing_position_${runner.id}`,
        getRaceResultValue(
          raceId,
          runner.id,
          "finishingPosition",
        ),
      );

      formData.set(
        `starting_price_${runner.id}`,
        getRaceResultValue(
          raceId,
          runner.id,
          "startingPrice",
        ),
      );
    });

    const settleResult = await settleRaceRunnersAction(formData);

    if (!settleResult.success) {
      setError(
        settleResult.error ||
          "Failed to settle race.",
      );
      return;
    }

    setResultPreviewRaceId(null);

    setClosedRaceIds((current) =>
      current.includes(raceId)
        ? current
        : [...current, raceId],
    );

    setSuccess("Race settled and moved to archive.");
    router.refresh();
  });
}
  function handleAbandonRace(raceId: number) {
    const confirmed = window.confirm(
      "Abandon this race only? This will close the race, void linked calculator tips/user bets, and leave the rest of the meeting active.",
    );

    if (!confirmed) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", String(raceId));
      formData.set("abandonment_reason", "Race abandoned.");

      const result = await abandonRaceAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to abandon race.");
        return;
      }

      setClosedRaceIds((current) =>
        current.includes(raceId) ? current : [...current, raceId],
      );

      setSuccess("Race abandoned and moved out of Current Races.");
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
function buildScratchingsPreview(rows: ParsedScratchingRow[]) {
  const matched: ScratchingMatchRow[] = [];
  const unmatched: ScratchingUnmatchedRow[] = [];

  rows.forEach((row) => {
    const meeting = groupedMeetings.find(
      (item) =>
        normaliseHorseName(item.meeting_name) ===
        normaliseHorseName(row.meeting_name),
    );

    if (!meeting) {
      unmatched.push({
        ...row,
        reason: "Meeting not found in Current Races.",
      });
      return;
    }

    const race = meeting.races.find(
      (item) => Number(item.race_number) === Number(row.race_number),
    );

    if (!race) {
      unmatched.push({
        ...row,
        reason: "Race number not found for this meeting.",
      });
      return;
    }

    const raceRunners = runnersForRace(race.id);

    const runner =
      raceRunners.find(
        (item) =>
          normaliseHorseName(findHorseName(item.horse_id)) ===
          normaliseHorseName(row.horse_name),
      ) || null;

    if (!runner) {
      unmatched.push({
        ...row,
        reason: "Horse name not matched in this race.",
      });
      return;
    }

    matched.push({
      ...row,
      race_id: race.id,
      runner_id: runner.id,
      matched_horse_name: findHorseName(runner.horse_id),
      already_scratched: runner.scratched === true,
    });
  });

  return {
    matched,
    unmatched,
    toScratch: matched.filter((row) => !row.already_scratched),
    alreadyScratched: matched.filter((row) => row.already_scratched),
  };
}

function handleParseScratchingsImport() {
  const parsed = parseScratchingsImportText(scratchingsImportText);

  if (!parsed.length) {
    setParsedScratchings([]);
    setScratchingsPreviewOpen(false);
    setError("No scratchings could be parsed from the pasted text.");
    return;
  }

  setParsedScratchings(parsed);
  setScratchingsPreviewOpen(true);

  const preview = buildScratchingsPreview(parsed);

  setSuccess(
    `Parsed ${parsed.length} scratchings. Matched ${preview.matched.length}, unmatched ${preview.unmatched.length}.`,
  );
}

function handleClearScratchingsImport() {
  setScratchingsImportText("");
  setParsedScratchings([]);
  setScratchingsPreviewOpen(false);
}

function handleApplyScratchingsImport() {
  const preview = buildScratchingsPreview(parsedScratchings);

  if (!preview.toScratch.length) {
    setSuccess("No new matched runners to scratch.");
    return;
  }

  const byRace = new Map<number, number[]>();

  preview.toScratch.forEach((row) => {
    const existing = byRace.get(row.race_id) || [];
    existing.push(row.runner_id);
    byRace.set(row.race_id, existing);
  });

  startTransition(async () => {
    for (const [raceId, runnerIds] of byRace.entries()) {
      const formData = new FormData();
      formData.set("race_id", String(raceId));
      formData.set("runner_ids", JSON.stringify(runnerIds));

      const result = await bulkScratchRaceRunnersAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to apply imported scratchings.");
        return;
      }
    }

    setSuccess(`Applied ${preview.toScratch.length} imported scratchings.`);
    setParsedScratchings([]);
    setScratchingsPreviewOpen(false);
    setScratchingsImportText("");
    router.refresh();
  });
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
function handleScratchMissingResults(raceId: number) {
  const raceRunners = runnersForRace(raceId);

  const runnersToScratch = raceRunners.filter(
    (runner) =>
      !runner.scratched &&
      getRaceResultValue(raceId, runner.id, "finishingPosition") === "",
  );

  if (runnersToScratch.length === 0) {
    setSuccess("No missing runners to scratch.");
    return;
  }

  startTransition(async () => {
    const formData = new FormData();
    formData.set("race_id", String(raceId));
    formData.set(
      "runner_ids",
      JSON.stringify(runnersToScratch.map((runner) => runner.id)),
    );

    const result = await bulkScratchRaceRunnersAction(formData);

    if (!result.success) {
      setError(result.error || "Failed to scratch missing runners.");
      return;
    }

    setSuccess(`Scratched ${runnersToScratch.length} runners without applied results.`);
    router.refresh();
  });
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
function handleStartRaceDay(meeting: Meeting) {
  const confirmed = window.confirm(
    `Start race day for ${meeting.meeting_name}?\n\n` +
      "This will make this meeting's Calculator predictions visible to subscribers.\n\n" +
      "Please confirm that:\n" +
      "• Track condition is correct\n" +
      "• Scratchings are entered\n" +
      "• Place terms are correct",
  );

  if (!confirmed) return;

  startTransition(async () => {
    const formData = new FormData();
    formData.set("meeting_id", String(meeting.id));

    const result = await startRaceDayAction(formData);

    if (!result.success) {
      setError(result.error || "Failed to start race day.");
      return;
    }

    setSuccess(
      `${meeting.meeting_name} Calculator predictions are now live.`,
    );

    router.refresh();
  });
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
        href="/admin/calculator"
        className="block rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
      >
        Calculator Lab
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
<Link
  href="/admin/power-rating-race-card"
  className="rounded-2xl border border-amber-400/30 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/30"
>
  🏆 Power Rating Race Card
</Link>
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
{isAdmin ? (
  <Panel className="bg-white/95">
    <div className="space-y-4 p-6 text-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Import Scratchings</h2>
          <p className="text-sm text-zinc-500">
            Paste the scratchings page. SmartPunt will match by meeting,
            race number, and horse name before applying anything.
          </p>
        </div>

        <Badge tone="amber">Paste + Preview</Badge>
      </div>

      <textarea
        value={scratchingsImportText}
        onChange={(event) => setScratchingsImportText(event.target.value)}
        placeholder="Paste scratchings text here..."
        className="min-h-[160px] w-full rounded-2xl border border-zinc-300 bg-white p-4 text-sm text-zinc-950 outline-none transition focus:border-amber-400"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleParseScratchingsImport}
          disabled={isPending || !scratchingsImportText.trim()}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
        >
          Preview Scratchings
        </button>

        <button
          type="button"
          onClick={handleClearScratchingsImport}
          disabled={isPending}
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
        >
          Clear
        </button>
      </div>

      {scratchingsPreviewOpen ? (() => {
        const preview = buildScratchingsPreview(parsedScratchings);

        return (
          <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{preview.toScratch.length} to scratch</Badge>
              <Badge tone="blue">{preview.alreadyScratched.length} already scratched</Badge>
              <Badge tone={preview.unmatched.length ? "red" : "green"}>
                {preview.unmatched.length} unmatched
              </Badge>
            </div>

            {preview.toScratch.length > 0 ? (
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-800">
                  Matched scratchings
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {preview.toScratch.map((row) => (
                    <div
                      key={`${row.race_id}-${row.runner_id}`}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    >
                      <span className="font-bold">{row.meeting_name} R{row.race_number}</span>
                      {" — "}
                      {row.matched_horse_name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.alreadyScratched.length > 0 ? (
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-800">
                  Already scratched
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {preview.alreadyScratched.map((row) => (
                    <div
                      key={`already-${row.race_id}-${row.runner_id}`}
                      className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    >
                      <span className="font-bold">{row.meeting_name} R{row.race_number}</span>
                      {" — "}
                      {row.matched_horse_name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.unmatched.length > 0 ? (
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-red-800">
                  Unmatched — check manually
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {preview.unmatched.map((row, index) => (
                    <div
                      key={`unmatched-${index}-${row.meeting_name}-${row.race_number}-${row.horse_name}`}
                      className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    >
                      <span className="font-bold">{row.meeting_name} R{row.race_number}</span>
                      {" — "}
                      {row.horse_name}
                      <p className="mt-1 text-xs text-red-700">{row.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-amber-200 pt-4">
              <button
                type="button"
                onClick={handleApplyScratchingsImport}
                disabled={isPending || preview.toScratch.length === 0}
                className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                Apply {preview.toScratch.length} Scratchings
              </button>

              <button
                type="button"
                onClick={() => setScratchingsPreviewOpen(false)}
                disabled={isPending}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Hide Preview
              </button>
            </div>
          </div>
        );
      })() : null}
    </div>
  </Panel>
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
<div className="space-y-3">
  {isAdmin ? (
    editingMeetingIds.includes(meeting.id) ? (
      <form
        action={async (formData) => {
          await updateMeetingDetailsAction(formData);
          setEditingMeetingIds((current) =>
            current.filter((id) => id !== meeting.id),
          );
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="meeting_id" value={meeting.id} />

        <input
          name="meeting_name"
          defaultValue={meeting.meeting_name}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-950"
        />

        <input
          type="date"
          name="meeting_date"
          defaultValue={meeting.meeting_date}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950"
        />

        <button
          type="button"
          onClick={() =>
            setEditingMeetingIds((current) =>
              current.filter((id) => id !== meeting.id),
            )
          }
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-amber-300"
        >
          Save Meeting
        </button>
      </form>
    ) : (
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-2xl font-bold tracking-tight text-zinc-950">
          {meeting.meeting_name}
        </h3>

        <button
          type="button"
          onClick={() =>
            setEditingMeetingIds((current) => [...current, meeting.id])
          }
          className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white"
        >
          Edit Meeting
        </button>
      </div>
    )
  ) : (
    <h3 className="text-2xl font-bold tracking-tight text-zinc-950">
      {meeting.meeting_name}
    </h3>
  )}

  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
    <span>{formatMeetingDate(meeting.meeting_date)}</span>

    {isAdmin ? (
      <select
        value={meeting.track_condition || ""}
        onChange={(e) =>
          handleUpdateTrackCondition(meeting.id, e.target.value)
        }
        className="rounded-xl border border-zinc-300 bg-white px-3 py-1 text-sm font-semibold text-zinc-700"
      >
        <option value="">Set condition</option>
        <option value="Good">Good</option>
        <option value="Soft">Soft</option>
        <option value="Heavy">Heavy</option>
        <option value="Synthetic">Synthetic</option>
      </select>
    ) : (
      meeting.track_condition && (
        <Badge tone="blue">{meeting.track_condition}</Badge>
      )
    )}
  </div>
</div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="blue">{meeting.races.length} current races</Badge>

                              {isAdmin ? (
                                <form action={abandonMeetingAction}>
                                  <input type="hidden" name="meeting_id" value={meeting.id} />
                                  <button
                                    type="submit"
                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-red-700 transition hover:bg-red-100"
                                  >
                                    Abandon Meeting
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
{isAdmin ? (
  <div
    className={`mt-5 rounded-[24px] border p-5 ${
      meeting.calculator_released_at
        ? "border-emerald-200 bg-emerald-50"
        : meeting.track_condition
          ? "border-amber-200 bg-amber-50"
          : "border-red-200 bg-red-50"
    }`}
  >
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
          Calculator release
        </p>

        <h4 className="mt-2 text-lg font-bold text-zinc-950">
          {meeting.calculator_released_at
            ? "Meeting released"
            : meeting.track_condition
              ? "Ready for final checks"
              : "Waiting for track condition"}
        </h4>

        <p className="mt-2 text-sm text-zinc-600">
          {meeting.calculator_released_at
            ? "Calculator predictions for this meeting are visible to subscribers."
            : meeting.track_condition
              ? "Confirm scratchings and place terms, then release this meeting."
              : "Set the official track condition before releasing this meeting."}
        </p>

        {meeting.calculator_released_at ? (
          <p className="mt-3 text-sm font-semibold text-emerald-800">
            Released{" "}
            {new Date(meeting.calculator_released_at).toLocaleString(
              "en-AU",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Australia/Perth",
              },
            )}
          </p>
        ) : null}
      </div>

      {meeting.calculator_released_at ? (
        <Badge tone="green">Live</Badge>
      ) : (
        <button
          type="button"
          onClick={() => handleStartRaceDay(meeting)}
          disabled={isPending || !meeting.track_condition}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-amber-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Starting..."
            : `Start ${meeting.meeting_name} Race Day`}
        </button>
      )}
    </div>

    {!meeting.calculator_released_at ? (
      <div className="mt-4 grid gap-2 border-t border-black/10 pt-4 text-sm text-zinc-700 sm:grid-cols-3">
        <p>
          {meeting.track_condition ? "✓" : "○"} Track condition
        </p>
        <p>✓ {meeting.races.length} published races</p>
        <p>○ Confirm scratchings and place terms</p>
      </div>
    ) : null}
  </div>
) : null}

                          <div className="mt-5 space-y-5">
                          <div className="mt-5 space-y-5">
                            {meeting.races.map((race) => {
                              const raceRunners = runnersForRace(race.id);
                              const activeRunnerCount = getActiveRunnerCount(race.id);
                              const settledCount = getSettledCount(race.id);
                              const parsedRows = parsedResultsByRace[race.id] || [];
                          const raceIsOpen = isRaceOpen(race.id);

                              return (
                                <div
                                  key={race.id}
                                  className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
                                >
<div className="flex w-full flex-wrap items-start justify-between gap-3">
  <div className="min-w-0 flex-1 space-y-2">
    {isAdmin && editingRaceIds.includes(race.id) ? (
      <form
        action={async (formData) => {
          await updateRaceDetailsAction(formData);
          setEditingRaceIds((current) =>
            current.filter((id) => id !== race.id),
          );
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="race_id" value={race.id} />

        <button
          type="button"
          onClick={() => toggleRaceOpen(race.id)}
          className="text-lg font-semibold text-zinc-950"
        >
          {raceIsOpen ? "▾" : "▸"}
        </button>

        <input
          type="number"
          name="race_number"
          defaultValue={race.race_number}
          className="w-[90px] rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-950"
        />

        <input
          name="race_name"
          defaultValue={race.race_name}
          className="min-w-[260px] flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-950"
        />

        <input
          type="number"
          name="distance_m"
          defaultValue={race.distance_m || ""}
          placeholder="Distance"
          className="w-[120px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950"
        />
        <select
  name="place_terms"
  defaultValue={race.place_terms || "top_3"}
  className="w-[150px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950"
>
  <option value="top_3">Pay 1, 2 & 3</option>
  <option value="top_2">Pay 1 & 2</option>
  <option value="win_only">Pay 1 Only</option>
</select>

        <button
          type="button"
          onClick={() =>
            setEditingRaceIds((current) =>
              current.filter((id) => id !== race.id),
            )
          }
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-amber-300"
        >
          Save Race
        </button>

        <Badge tone="green">published</Badge>

        <Badge tone={getRaceResultTone(raceRunners)}>
          {settledCount}/{activeRunnerCount} completed
        </Badge>
      </form>
    ) : (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleRaceOpen(race.id)}
            className="text-lg font-semibold text-zinc-950"
          >
            {raceIsOpen ? "▾" : "▸"} R{race.race_number} {race.race_name}
          </button>

          <Badge tone="green">published</Badge>

          <Badge tone={getRaceResultTone(raceRunners)}>
            {settledCount}/{activeRunnerCount} completed
          </Badge>
        </div>

<p className="mt-1 text-sm text-zinc-500">
  {race.distance_m || "—"}m ·{" "}
  {race.place_terms === "win_only"
    ? "Pay 1 Only"
    : race.place_terms === "top_2"
      ? "Pay 1 & 2"
      : "Pay 1, 2 & 3"}
</p>
      </>
    )}
  </div>

  <div className="flex flex-wrap items-center gap-2">
    {isAdmin ? (
      <button
        type="button"
        onClick={() =>
          setEditingRaceIds((current) =>
            current.includes(race.id)
              ? current.filter((id) => id !== race.id)
              : [...current, race.id],
          )
        }
        className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white"
      >
        {editingRaceIds.includes(race.id) ? "Cancel Edit" : "Edit Race"}
      </button>
    ) : null}

    <Badge tone={raceIsOpen ? "blue" : "amber"}>
      {raceIsOpen ? "Open" : "Collapsed"}
    </Badge>
  </div>
</div>

{raceIsOpen ? (
  <>
{isAdmin ? (
  <div className="mt-4 flex flex-wrap gap-2">
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
      onClick={() => handlePreviewResults(race.id)}
      disabled={isPending}
      className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
    >
      Preview Results
    </button>

    <button
      type="button"
      onClick={() => handleAbandonRace(race.id)}
      disabled={isPending}
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 transition hover:bg-red-100 disabled:opacity-60"
    >
      Abandon Race
    </button>
  </div>
) : null}

{isAdmin && resultPreviewRaceId === race.id
  ? (() => {
      const validation = validateRaceResults(race.id);

      const positionCounts = new Map<number, number>();

      validation.rows.forEach((row) => {
        positionCounts.set(
          row.finishingPosition,
          (positionCounts.get(row.finishingPosition) || 0) + 1,
        );
      });

      return (
        <div className="mt-4 rounded-[20px] border border-emerald-300 bg-emerald-50 p-4 text-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-black uppercase tracking-[0.12em] text-emerald-900">
                Results Preview — Not Saved
              </h4>

              <p className="mt-1 text-sm text-emerald-800">
                Check every runner below. Tied finishing
                positions are allowed for dead heats.
              </p>
            </div>

            <Badge tone="amber">
              No database changes yet
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            {validation.rows.map((row) => {
              const isDeadHeat =
                (positionCounts.get(row.finishingPosition) || 0) >
                1;

              return (
                <div
                  key={`preview-${race.id}-${row.runner.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-zinc-950">
                      {row.finishingPosition}. {row.horseName}
                    </p>

                    {isDeadHeat ? (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        Dead heat / tied placing
                      </p>
                    ) : null}
                  </div>

{row.startingPriceRaw ? (
  <Badge tone="green">
    SP ${row.startingPriceRaw}
  </Badge>
) : (
  <Badge tone="slate">
    SP not entered
  </Badge>
)}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-emerald-200 pt-4">
            <button
              type="button"
              onClick={() =>
                handleSaveResultsAndCloseRace(race.id)
              }
              disabled={isPending}
              className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {isPending
                ? "Saving..."
                : "Confirm + Save Results + Close Race"}
            </button>

            <button
              type="button"
              onClick={() => setResultPreviewRaceId(null)}
              disabled={isPending}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Back to Editing
            </button>
          </div>
        </div>
      );
    })()
  : null}
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
  onClick={() => handleScratchMissingResults(race.id)}
  disabled={isPending || parsedRows.length === 0}
  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
>
  Scratch Missing Results
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
<div className="group relative inline-block">
{isAdmin ? (
  <Link
    href={`/admin/horses/${runner.horse_id}`}
    className="font-semibold text-zinc-950 underline-offset-4 transition hover:text-amber-700 hover:underline"
  >
    {findHorseName(runner.horse_id)}
  </Link>
) : (
  <p className="font-semibold text-zinc-950">
    {findHorseName(runner.horse_id)}
  </p>
)}

  <div className="pointer-events-none absolute left-0 top-full z-50 mt-3 hidden w-[320px] rounded-[24px] border border-amber-200 bg-white p-4 shadow-2xl group-hover:block">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-lg font-bold text-zinc-950">
          {findHorseName(runner.horse_id)}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          {formatHorseMeta(horse) || "Horse profile"}
        </p>
      </div>

      {runner.market_price !== null ? (
        <Badge tone="green">${runner.market_price}</Badge>
      ) : null}
    </div>

    <div className="mt-4 grid gap-3 grid-cols-3">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Last 6
        </p>

        <p className="mt-2 text-sm font-bold text-zinc-900">
          {runner.form_last_6 || "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Track
        </p>

        <p className="mt-2 text-sm font-bold text-zinc-900">
          {runner.track_form_last_6 || "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Distance
        </p>

        <p className="mt-2 text-sm font-bold text-zinc-900">
          {runner.distance_form_last_6 || "—"}
        </p>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {runner.barrier ? (
        <Badge tone="blue">Barrier {runner.barrier}</Badge>
      ) : null}

      {runner.weight_kg !== null &&
      runner.weight_kg !== undefined ? (
        <Badge tone="amber">
          {runner.weight_kg}kg
        </Badge>
      ) : null}

      {runner.jockey_name ? (
        <Badge tone="slate">
          {runner.jockey_name}
        </Badge>
      ) : null}
    </div>

{isAdmin ? (
  <div className="mt-4 border-t border-zinc-200 pt-3">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
      Open profile
    </p>

    <p className="mt-1 text-sm text-zinc-600">
      Click horse name to open full saved horse profile.
    </p>
  </div>
) : null}
  </div>
</div>
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
  min="1"
  max={activeRunnerCount}
  step="1"
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
  onWheel={(event) => {
  event.currentTarget.blur();
}}
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
  </>
) : null}
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
