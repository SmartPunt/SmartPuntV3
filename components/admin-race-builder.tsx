"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import {
  createMeetingAction,
  createRaceAction,
  createRaceRunnerAction,
  deleteMeetingAction,
  deleteRaceAction,
  deleteRaceRunnerAction,
  toggleRacePublishAction,
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

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-amber-200/30 px-3 py-3 outline-none transition focus:border-amber-300"
    >
      {children}
    </select>
  );
}

function formatMeetingLabel(meeting: Meeting) {
  return `${meeting.meeting_name} — ${meeting.meeting_date}`;
}

function getRaceStatusTone(status: Race["status"]) {
  if (status === "published") return "green";
  if (status === "closed") return "rose";
  return "amber";
}

function formatHorseMeta(horse: Horse | null) {
  if (!horse) return "";
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

function normaliseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatFormString(positions: Array<number | null | undefined>) {
  const usable = positions
    .filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value)))
    .map((value) => String(value));

  return usable.join("-");
}
type ImportedRunner = {
  horse_name: string;
  barrier: string;
  weight_kg: string;
  jockey_name: string;
  trainer_name: string;
  market_price: string;
  fixed_place_odds: string;
  form_last_6: string;
  track_form_last_6: string;
  distance_form_last_6: string;
  is_apprentice: boolean;
  apprentice_claim_kg: string;
};

function cleanImportedValue(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseApprentice(jockeyLine: string) {
  const cleaned = cleanImportedValue(jockeyLine);

  const claimMatch = cleaned.match(/\(A\s*([0-9]+(?:\.[0-9]+)?)\)/i);
  if (claimMatch) {
    return {
      jockey_name: cleaned.replace(/\(A\s*[0-9]+(?:\.[0-9]+)?\)/i, "").trim(),
      is_apprentice: true,
      apprentice_claim_kg: claimMatch[1],
    };
  }

  const apprenticeOnlyMatch = cleaned.match(/\(A\)/i);
  if (apprenticeOnlyMatch) {
    return {
      jockey_name: cleaned.replace(/\(A\)/i, "").trim(),
      is_apprentice: true,
      apprentice_claim_kg: "",
    };
  }

  return {
    jockey_name: cleaned.trim(),
    is_apprentice: false,
    apprentice_claim_kg: "",
  };
}

function isNoiseLine(line: string) {
  const lower = line.toLowerCase();

  const exactNoise = new Set([
    "my bets",
    "bet slip",
    "tips",
    "stewards comments",
    "fixed flucs",
    "form",
    "fixed",
    "tote",
    "sp",
    "colour",
    "career -",
    "prize -",
    "more betting options",
    "mystery bet",
    "odds vs evens",
    "half vs half",
    "head to head",
    "favourite out",
    "deductions applied",
    "no deductions",
  ]);

  if (exactNoise.has(lower)) return true;
  if (lower.startsWith("colour ")) return true;
  if (lower.startsWith("career ")) return true;
  if (lower.startsWith("prize ")) return true;
  if (lower.startsWith("deductions")) return true;
  if (lower.startsWith("no deductions")) return true;

  if (/^r\d+\s+[a-z]+$/i.test(line)) return true;
  if (/^\d{1,2}-[a-z]{3}-\d{2}$/i.test(line)) return true;
  if (/^\d{3,4}m$/i.test(line)) return true;
  if (/^mon|tue|wed|thu|fri|sat|sun\b/i.test(line)) return true;
  if (/^magic millions|maiden|benchmark|plate|handicap|stakes/i.test(line)) return true;

  if (/^(last starts|trainer|age \/ sex|sire \/ dam|distance|track|trk\/dist|good|soft|heavy|firm|synthetic)\b/i.test(line)) {
    return true;
  }

  if (/positioned|running|showed best work|well timed run|found one better|late fourth|came with|held on well|run down late|big task ahead|settling well back/i.test(lower)) {
    return true;
  }

if (/trifecta|quinella|exacta|double|betting options|odds vs|head to head|favourite out|gear changes|tongue tie|blinkers|visor|lugging bit|nose roll|ear muffs/i.test(lower)) {
  return true;
}

  if (/^\$?\d+(\.\d+)?$/.test(line)) return true;
  if (/^[0-9xX\-]{2,}$/.test(line)) return true;

  return false;
}

function looksLikeHorseName(line: string, nextLines: string[] = []) {
  if (!line) return false;
  if (isNoiseLine(line)) return false;
  if (line.includes(":")) return false;
  if (/\b(j|t|br|barrier|weight|last starts|trainer|colour|career|prize)\b/i.test(line)) {
    return false;
  }
  if (/[0-9]{1,2}-[A-Za-z]{3}-[0-9]{2}/.test(line)) return false;
  if (/^\d/.test(line)) return false;

  const cleanedLine = line.replace(/\s+\(([A-Z]{2,3})\)\s*$/, "").trim();

  const words = cleanedLine.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 6) return false;
  if (!words.every((word) => /^[A-Za-z'’.\-]+$/.test(word))) return false;

const supportScore = nextLines.reduce((score, entry) => {
  if (/\bbr[:\s]*[0-9]+/i.test(entry) || /\bbarrier[:\s]*[0-9]+/i.test(entry)) score++;
  if (/\bw[:\s]*[0-9]+(?:\.[0-9]+)?\s*kg\b/i.test(entry)) score++;
  if (/\bj[:\s].+/i.test(entry)) score++;
  if (/\bt[:\s].+/i.test(entry)) score++;
  if (/last starts[:\s]*[0-9xX\-]+/i.test(entry)) score++;
  return score;
}, 0);

return supportScore >= 2;
}

function parseRaceImportText(raw: string): ImportedRunner[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanImportedValue(line))
    .filter(Boolean);

  const runners: ImportedRunner[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!looksLikeHorseName(line, lines.slice(i + 1, i + 8))) {
      i += 1;
      continue;
    }

    const horse_name = line;
    const windowLines = lines.slice(i + 1, i + 20);

    let barrier = "";
    let weight_kg = "";
    let jockey_name = "";
    let trainer_name = "";
        let market_price = "";
    let fixed_place_odds = "";
    let form_last_6 = "";
    let track_form_last_6 = "";
    let distance_form_last_6 = "";
    let is_apprentice = false;
    let apprentice_claim_kg = "";

    for (const entry of windowLines) {
      if (!barrier) {
        const barrierMatch =
          entry.match(/\bbr[:\s]*([0-9]+)/i) ||
          entry.match(/\bbarrier[:\s]*([0-9]+)/i);
        if (barrierMatch) barrier = barrierMatch[1];
      }

      if (!weight_kg) {
        const weightMatch =
          entry.match(/\bw[:\s]*([0-9]+(?:\.[0-9]+)?)\s*kg\b/i) ||
          entry.match(/\bweight[:\s]*([0-9]+(?:\.[0-9]+)?)\s*kg\b/i) ||
          entry.match(/^([0-9]+(?:\.[0-9]+)?)\s*kg$/i);
        if (weightMatch) weight_kg = weightMatch[1];
      }

      if (!jockey_name) {
        const jockeyMatch =
          entry.match(/\bj[:\s]*(.+)$/i) ||
          entry.match(/^jockey[:\s]*(.+)$/i);
        if (jockeyMatch) {
          const parsed = parseApprentice(jockeyMatch[1]);
          jockey_name = parsed.jockey_name;
          is_apprentice = parsed.is_apprentice;
          apprentice_claim_kg = parsed.apprentice_claim_kg;
        }
      }

      if (!trainer_name) {
        const trainerMatch =
          entry.match(/\bt[:\s]*(.+)$/i) ||
          entry.match(/^trainer[:\s]*(.+)$/i);
        if (trainerMatch) trainer_name = trainerMatch[1].trim();
      }

      if (!form_last_6) {
        const formMatch = entry.match(/last starts[:\s]*([0-9xX\-]+)/i);
        if (formMatch) {
          form_last_6 = formMatch[1].replace(/\s+/g, "");
        }
      }
            if (!distance_form_last_6) {
        const distanceMatch =
          entry.match(/^distance[:\s]*([0-9]+:[0-9,]+)$/i) ||
          entry.match(/\bdistance[:\s]*([0-9]+:[0-9,]+)/i);
        if (distanceMatch) {
          distance_form_last_6 = distanceMatch[1].trim();
        }
      }

      if (!track_form_last_6) {
        const trackMatch =
          entry.match(/^track[:\s]*([0-9]+:[0-9,]+)$/i) ||
          entry.match(/\btrack[:\s]*([0-9]+:[0-9,]+)/i);
        if (trackMatch) {
          track_form_last_6 = trackMatch[1].trim();
        }
      }
    }

    const decimalNumberLines = windowLines
      .filter((entry) => /^\$?\d+\.\d+$/.test(entry))
      .map((entry) => Number(entry.replace(/^\$/, "")))
      .filter((value) => !Number.isNaN(value));

    if (decimalNumberLines.length >= 2) {
      const uniqueSorted = Array.from(new Set(decimalNumberLines)).sort((a, b) => a - b);

      const placeCandidate = uniqueSorted.find((value) => value >= 1.01 && value <= 10);
      const winCandidate = uniqueSorted.find(
        (value) => placeCandidate !== undefined && value > placeCandidate,
      );

      if (placeCandidate !== undefined && winCandidate !== undefined) {
        fixed_place_odds = String(placeCandidate);
        market_price = String(winCandidate);
      } else {
        const first = uniqueSorted[0];
        const second = uniqueSorted[1];

        fixed_place_odds = String(Math.min(first, second));
        market_price = String(Math.max(first, second));
      }
    } else if (decimalNumberLines.length === 1) {
      market_price = String(decimalNumberLines[0]);
    }

    if (
      horse_name &&
      (barrier || weight_kg || jockey_name || trainer_name || market_price || form_last_6)
    ) {
      runners.push({
        horse_name,
        barrier,
        weight_kg,
        jockey_name,
        trainer_name,
        market_price,
        fixed_place_odds,
        form_last_6,
        track_form_last_6,
        distance_form_last_6,
        is_apprentice,
        apprentice_claim_kg,
      });
    }

    i += 1;
  }

  const seen = new Set<string>();
  return runners.filter((runner) => {
    const key = runner.horse_name.toLowerCase();
    if (!runner.horse_name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export default function RaceBuilderPage({
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

  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [runners, setRunners] = useState<Runner[]>(initialRunners);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");

  const [meetingName, setMeetingName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTrackCondition, setMeetingTrackCondition] = useState("Good 4");

  const [selectedMeetingIdForRace, setSelectedMeetingIdForRace] = useState("");
  const [raceNumber, setRaceNumber] = useState("");
  const [raceName, setRaceName] = useState("");
  const [raceDistance, setRaceDistance] = useState("");

  const [selectedMeetingIdForRunner, setSelectedMeetingIdForRunner] = useState("");
  const [selectedRaceIdForRunner, setSelectedRaceIdForRunner] = useState("");
  const [horseQuery, setHorseQuery] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [jockeyName, setJockeyName] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [barrier, setBarrier] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [isApprentice, setIsApprentice] = useState(false);
  const [apprenticeClaim, setApprenticeClaim] = useState("");
  const [formLast6, setFormLast6] = useState("");
  const [trackFormLast6, setTrackFormLast6] = useState("");
  const [distanceFormLast6, setDistanceFormLast6] = useState("");
  const [importText, setImportText] = useState("");
  const [parsedImportRunners, setParsedImportRunners] = useState<ImportedRunner[]>([]);
  const [importingRunners, setImportingRunners] = useState(false);
  useEffect(() => {
    setMeetings(initialMeetings);
  }, [initialMeetings]);

  useEffect(() => {
    setRaces(initialRaces);
  }, [initialRaces]);

  useEffect(() => {
    setRunners(initialRunners);
  }, [initialRunners]);

  const draftRaces = useMemo(
    () => races.filter((race) => race.status === "draft"),
    [races],
  );

  const publishedRaces = useMemo(
    () => races.filter((race) => race.status === "published"),
    [races],
  );

  const closedRaces = useMemo(
    () => races.filter((race) => race.status === "closed"),
    [races],
  );

  const activeMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const meetingRaces = races.filter((race) => race.meeting_id === meeting.id);

      if (meetingRaces.length === 0) return true;

      return meetingRaces.some((race) => race.status === "draft");
    });
  }, [meetings, races]);

  const closedRaceIds = useMemo(() => new Set(closedRaces.map((race) => race.id)), [closedRaces]);

  const filteredHorseSuggestions = useMemo(() => {
    const query = horseQuery.trim().toLowerCase();

    if (!query) {
      return initialHorses.slice(0, 8);
    }

    return initialHorses
      .filter((horse) => horse.horse_name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [horseQuery, initialHorses]);

  const matchedHorseFromQuery = useMemo(() => {
    const query = normaliseName(horseQuery);
    if (!query) return null;

    return (
      initialHorses.find((horse) => horse.normalised_name === query) ||
      initialHorses.find((horse) => normaliseName(horse.horse_name) === query) ||
      null
    );
  }, [horseQuery, initialHorses]);

  const activeHorseId = useMemo(() => {
    if (selectedHorseId) return Number(selectedHorseId);
    if (matchedHorseFromQuery) return matchedHorseFromQuery.id;
    return null;
  }, [selectedHorseId, matchedHorseFromQuery]);

  const racesForSelectedMeeting = useMemo(() => {
    if (!selectedMeetingIdForRunner) return [];

    return draftRaces.filter(
      (race) => String(race.meeting_id) === selectedMeetingIdForRunner,
    );
  }, [draftRaces, selectedMeetingIdForRunner]);

  const selectedRace = draftRaces.find(
    (race) => String(race.id) === selectedRaceIdForRunner,
  );

  const selectedMeetingForRunner = meetings.find(
    (meeting) => String(meeting.id) === selectedMeetingIdForRunner,
  );

  const horseHistoricalRunners = useMemo(() => {
    if (!activeHorseId) return [];

    return runners
      .filter(
        (runner) =>
          runner.horse_id === activeHorseId &&
          closedRaceIds.has(runner.race_id) &&
          !runner.scratched &&
          runner.finishing_position !== null &&
          runner.finishing_position !== undefined,
      )
      .map((runner) => {
        const race = races.find((item) => item.id === runner.race_id) || null;
        const meeting = race
          ? meetings.find((item) => item.id === race.meeting_id) || null
          : null;

        return {
          runner,
          race,
          meeting,
          sortDate:
            runner.settled_at ||
            race?.updated_at ||
            race?.published_at ||
            runner.updated_at ||
            runner.created_at,
        };
      })
      .sort((a, b) => {
        const aTime = a.sortDate ? new Date(a.sortDate).getTime() : 0;
        const bTime = b.sortDate ? new Date(b.sortDate).getTime() : 0;
        return bTime - aTime;
      });
  }, [activeHorseId, closedRaceIds, meetings, races, runners]);

  const suggestedOverallForm = useMemo(() => {
    return formatFormString(
      horseHistoricalRunners.slice(0, 6).map((item) => item.runner.finishing_position),
    );
  }, [horseHistoricalRunners]);

  const suggestedTrackForm = useMemo(() => {
    if (!selectedMeetingForRunner) return "";

    const targetTrack = normaliseName(selectedMeetingForRunner.meeting_name);

    return formatFormString(
      horseHistoricalRunners
        .filter((item) => normaliseName(item.meeting?.meeting_name || "") === targetTrack)
        .slice(0, 6)
        .map((item) => item.runner.finishing_position),
    );
  }, [horseHistoricalRunners, selectedMeetingForRunner]);

  const suggestedDistanceForm = useMemo(() => {
    if (!selectedRace || selectedRace.distance_m === null || selectedRace.distance_m === undefined) {
      return "";
    }

    return formatFormString(
      horseHistoricalRunners
        .filter((item) => item.race?.distance_m === selectedRace.distance_m)
        .slice(0, 6)
        .map((item) => item.runner.finishing_position),
    );
  }, [horseHistoricalRunners, selectedRace]);

  const selectedRaceRunnerCount = selectedRace
    ? runners.filter((runner) => runner.race_id === selectedRace.id).length
    : 0;

  useEffect(() => {
    if (!activeHorseId) return;

    if (!formLast6.trim() && suggestedOverallForm) {
      setFormLast6(suggestedOverallForm);
    }
  }, [activeHorseId, formLast6, suggestedOverallForm]);

  useEffect(() => {
    if (!activeHorseId || !selectedMeetingForRunner) return;

    if (!trackFormLast6.trim() && suggestedTrackForm) {
      setTrackFormLast6(suggestedTrackForm);
    }
  }, [activeHorseId, selectedMeetingForRunner, suggestedTrackForm, trackFormLast6]);

  useEffect(() => {
    if (!activeHorseId || !selectedRace) return;

    if (!distanceFormLast6.trim() && suggestedDistanceForm) {
      setDistanceFormLast6(suggestedDistanceForm);
    }
  }, [activeHorseId, selectedRace, suggestedDistanceForm, distanceFormLast6]);

  function applySuggestedHorseForm() {
    if (suggestedOverallForm) setFormLast6(suggestedOverallForm);
    if (suggestedTrackForm) setTrackFormLast6(suggestedTrackForm);
    if (suggestedDistanceForm) setDistanceFormLast6(suggestedDistanceForm);
  }

  function clearMeetingForm() {
    setMeetingName("");
    setMeetingDate("");
    setMeetingTrackCondition("Good 4");
  }

  function clearRaceForm() {
    setSelectedMeetingIdForRace("");
    setRaceNumber("");
    setRaceName("");
    setRaceDistance("");
  }

  function clearRunnerForm() {
    setSelectedMeetingIdForRunner("");
    setSelectedRaceIdForRunner("");
    setHorseQuery("");
    setSelectedHorseId("");
    setJockeyName("");
    setTrainerName("");
    setBarrier("");
    setMarketPrice("");
    setWeightKg("");
    setIsApprentice(false);
    setApprenticeClaim("");
    setFormLast6("");
    setTrackFormLast6("");
    setDistanceFormLast6("");
  }

  function setSuccess(message: string) {
    setStatusTone("success");
    setStatusMessage(message);
  }

  function setError(message: string) {
    setStatusTone("error");
    setStatusMessage(message);
  }
  function handlePreviewImport() {
    const parsed = parseRaceImportText(importText);
    setParsedImportRunners(parsed);

    if (!parsed.length) {
      setError("No runners could be parsed from the pasted text.");
      return;
    }

    setSuccess(`Parsed ${parsed.length} runners. Check the preview below, then import.`);
  }

  function clearImportPanel() {
    setImportText("");
    setParsedImportRunners([]);
  }

  async function handleImportParsedRunners() {
    if (!selectedRaceIdForRunner) {
      setError("Select a draft race first before importing runners.");
      return;
    }

    if (!parsedImportRunners.length) {
      setError("Nothing to import. Paste race text and preview it first.");
      return;
    }

    setImportingRunners(true);

    try {
      for (const runner of parsedImportRunners) {
        const formData = new FormData();
        formData.set("race_id", selectedRaceIdForRunner);
        formData.set("selected_horse_id", "");
        formData.set("horse_name", runner.horse_name);
        formData.set("jockey_name", runner.jockey_name);
        formData.set("trainer_name", runner.trainer_name);
        formData.set("barrier", runner.barrier);
        formData.set("market_price", runner.market_price);
        formData.set("weight_kg", runner.weight_kg);
        formData.set("is_apprentice", String(runner.is_apprentice));
        formData.set("apprentice_claim_kg", runner.apprentice_claim_kg);
        formData.set("form_last_6", runner.form_last_6);
        formData.set("track_form_last_6", runner.track_form_last_6);
        formData.set("distance_form_last_6", runner.distance_form_last_6);

        const result = await createRaceRunnerAction(formData);

        if (!result.success) {
          throw new Error(
            result.error || `Failed to import runner ${runner.horse_name}.`,
          );
        }
      }

      setSuccess(`Imported ${parsedImportRunners.length} runners into the selected race.`);
      clearImportPanel();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to import runners.");
    } finally {
      setImportingRunners(false);
    }
  }
  function handleAddMeeting() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_name", meetingName);
      formData.set("meeting_date", meetingDate);
      formData.set("track_condition", meetingTrackCondition);

      const result = await createMeetingAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create meeting.");
        return;
      }

      clearMeetingForm();
      setSuccess("Meeting added to Race Builder.");
      router.refresh();
    });
  }

  function handleDeleteMeeting(meetingId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_id", String(meetingId));

      const result = await deleteMeetingAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete meeting.");
        return;
      }

      setMeetings((prev) => prev.filter((meeting) => meeting.id !== meetingId));

      const raceIdsToRemove = races
        .filter((race) => race.meeting_id === meetingId)
        .map((race) => race.id);

      setRaces((prev) => prev.filter((race) => race.meeting_id !== meetingId));
      setRunners((prev) => prev.filter((runner) => !raceIdsToRemove.includes(runner.race_id)));

      if (selectedMeetingIdForRace === String(meetingId)) {
        setSelectedMeetingIdForRace("");
      }
      if (selectedMeetingIdForRunner === String(meetingId)) {
        setSelectedMeetingIdForRunner("");
        setSelectedRaceIdForRunner("");
      }

      setSuccess("Meeting deleted.");
      router.refresh();
    });
  }

  function handleAddRace() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("meeting_id", selectedMeetingIdForRace);
      formData.set("race_number", raceNumber);
      formData.set("race_name", raceName);
      formData.set("distance_m", raceDistance);

      const result = await createRaceAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create race.");
        return;
      }

      clearRaceForm();
      setSuccess("Race added to the selected meeting.");
      router.refresh();
    });
  }

  function handleTogglePublish(raceId: number, currentStatus: Race["status"]) {
    startTransition(async () => {
      const nextStatus = currentStatus === "published" ? "draft" : "published";
      const formData = new FormData();
      formData.set("race_id", String(raceId));
      formData.set("next_status", nextStatus);

      const result = await toggleRacePublishAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to update race status.");
        return;
      }

      setRaces((prev) =>
        prev.map((race) =>
          race.id === raceId
            ? {
                ...race,
                status: nextStatus,
                published_at: nextStatus === "published" ? new Date().toISOString() : null,
              }
            : race,
        ),
      );

      if (selectedRaceIdForRunner === String(raceId) && nextStatus !== "draft") {
        setSelectedRaceIdForRunner("");
      }

      setSuccess(
        nextStatus === "published"
          ? "Race sent to Current Races."
          : "Race moved back to Race Builder.",
      );
      router.refresh();
    });
  }

  function handleDeleteRace(raceId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", String(raceId));

      const result = await deleteRaceAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete race.");
        return;
      }

      setRaces((prev) => prev.filter((race) => race.id !== raceId));
      setRunners((prev) => prev.filter((runner) => runner.race_id !== raceId));

      if (selectedRaceIdForRunner === String(raceId)) {
        setSelectedRaceIdForRunner("");
      }

      setSuccess("Race deleted.");
      router.refresh();
    });
  }

  function handleSelectHorse(horse: Horse) {
    setSelectedHorseId(String(horse.id));
    setHorseQuery(horse.horse_name);
    setFormLast6("");
    setTrackFormLast6("");
    setDistanceFormLast6("");
  }

  function handleAddRunner() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("race_id", selectedRaceIdForRunner);
      formData.set("selected_horse_id", selectedHorseId);
      formData.set("horse_name", horseQuery);
      formData.set("jockey_name", jockeyName);
      formData.set("trainer_name", trainerName);
      formData.set("barrier", barrier);
      formData.set("market_price", marketPrice);
      formData.set("weight_kg", weightKg);
      formData.set("is_apprentice", String(isApprentice));
      formData.set("apprentice_claim_kg", apprenticeClaim);
      formData.set("form_last_6", formLast6);
      formData.set("track_form_last_6", trackFormLast6);
      formData.set("distance_form_last_6", distanceFormLast6);

      const result = await createRaceRunnerAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to create runner.");
        return;
      }

      clearRunnerForm();
      setSuccess("Runner added to race.");
      router.refresh();
    });
  }

  function handleDeleteRunner(runnerId: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("runner_id", String(runnerId));

      const result = await deleteRaceRunnerAction(formData);

      if (!result.success) {
        setError(result.error || "Failed to delete runner.");
        return;
      }

      setRunners((prev) => prev.filter((runner) => runner.id !== runnerId));
      setSuccess("Runner deleted.");
      router.refresh();
    });
  }

  function runnersForRace(raceId: number) {
    return runners.filter((runner) => runner.race_id === raceId);
  }

  function findHorse(horseId: number) {
    return initialHorses.find((horse) => horse.id === horseId) || null;
  }

  function findHorseName(horseId: number) {
    return findHorse(horseId)?.horse_name || "Unknown horse";
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
              <Badge tone="amber">Race Builder</Badge>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/current-races"
                  className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 backdrop-blur-sm transition hover:bg-amber-400/15"
                >
                  Current Races
                </Link>
                <Link
                  href="/race-archive"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Race Archive
                </Link>
                <Link
                  href="/admin/horses"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Saved Horses
                </Link>
                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Back to Admin
                </Link>
              </div>
            </div>

            <div className="mt-auto rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-[1px] lg:px-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Fortune on 5 race builder
                </h1>
                <p className="text-sm text-zinc-200 lg:text-base">
                  Build meetings, draft races, and runners here. Saved horses now pull their recent form from your own SmartPunt database.
                </p>
                <p className="ml-auto text-xs text-zinc-300 lg:text-sm">
                  Logged in as {currentUser.full_name || currentUser.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">Live database</Badge>
                <Badge tone="blue">Admin only</Badge>
                <Badge tone="amber">Horse form prefill active</Badge>
              </div>
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              statusTone === "success"
                ? "border-emerald-300/20 bg-emerald-100 text-emerald-950"
                : "border-red-300/20 bg-red-100 text-red-900"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}
               <div className="mt-6">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Quick race import</h2>
                  <p className="text-sm text-zinc-500">
                    Paste one raw race from Tabtouch here, preview it, then import runners into a selected draft race.
                  </p>
                </div>
                <Badge tone="amber">Stage 2</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting for import">
                  <Select
                    value={selectedMeetingIdForRunner}
                    onChange={(value) => {
                      setSelectedMeetingIdForRunner(value);
                      setSelectedRaceIdForRunner("");
                      setTrackFormLast6("");
                      setDistanceFormLast6("");
                    }}
                  >
                    <option value="">Select meeting</option>
                    {activeMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {formatMeetingLabel(meeting)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Draft race for import">
                  <Select
                    value={selectedRaceIdForRunner}
                    onChange={(value) => {
                      setSelectedRaceIdForRunner(value);
                      setDistanceFormLast6("");
                    }}
                  >
                    <option value="">Select draft race</option>
                    {racesForSelectedMeeting.map((race) => (
                      <option key={race.id} value={String(race.id)}>
                        R{race.race_number} {race.race_name} — {race.distance_m || "—"}m
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Paste raw race text"
                hint="Paste the messy Tabtouch race text exactly as copied. SmartPunt will parse the runners for preview."
              >
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste one full race here..."
                  className="min-h-[220px] w-full rounded-2xl border border-amber-200/30 px-4 py-4 outline-none transition focus:border-amber-300"
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePreviewImport}
                  disabled={isPending || importingRunners}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  Preview Import
                </button>

                <button
                  type="button"
                  onClick={handleImportParsedRunners}
                  disabled={
                    isPending ||
                    importingRunners ||
                    !parsedImportRunners.length ||
                    !selectedRaceIdForRunner
                  }
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {importingRunners ? "Importing..." : "Import Runners"}
                </button>

                <button
                  type="button"
                  onClick={clearImportPanel}
                  disabled={isPending || importingRunners}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear Import
                </button>
              </div>

              {parsedImportRunners.length > 0 ? (
                <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Import preview
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Parsed {parsedImportRunners.length} runners from the pasted race text.
                      </p>
                    </div>
                    <Badge tone="green">{parsedImportRunners.length} runners</Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {parsedImportRunners.map((runner, index) => (
                      <div
                        key={`${runner.horse_name}-${index}`}
                        className="rounded-2xl border border-emerald-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-950">
                              {index + 1}. {runner.horse_name}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">
                              Jockey: {runner.jockey_name || "—"}
                              {runner.is_apprentice
                                ? ` (Apprentice${
                                    runner.apprentice_claim_kg
                                      ? `, -${runner.apprentice_claim_kg}kg`
                                      : ""
                                  })`
                                : ""}
                              {" · "}Trainer: {runner.trainer_name || "—"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {runner.barrier ? <Badge tone="blue">Barrier {runner.barrier}</Badge> : null}
                            {runner.weight_kg ? <Badge tone="amber">{runner.weight_kg}kg</Badge> : null}
                            {runner.market_price ? <Badge tone="green">${runner.market_price}</Badge> : null}
                            {runner.fixed_place_odds ? (
                              <Badge tone="blue">Place ${runner.fixed_place_odds}</Badge>
                            ) : null}
                            {runner.form_last_6 ? <Badge tone="slate">Form {runner.form_last_6}</Badge> : null}
                            {runner.track_form_last_6 ? (
                              <Badge tone="amber">Track {runner.track_form_last_6}</Badge>
                            ) : null}
                            {runner.distance_form_last_6 ? (
                              <Badge tone="green">Distance {runner.distance_form_last_6}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Draft races
              </p>
              <p className="mt-2 text-3xl font-bold">{draftRaces.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                These stay in Race Builder until they’re ready to go live.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Current races
              </p>
              <p className="mt-2 text-3xl font-bold">{publishedRaces.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Published races are now managed from the Current Races page.
              </p>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Archived races
              </p>
              <p className="mt-2 text-3xl font-bold">{closedRaces.length}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Closed races now feed your horse history engine.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">1. Add meeting</h2>
                  <p className="text-sm text-zinc-500">
                    Start with the meeting shell so races can sit under it.
                  </p>
                </div>
                <Badge tone="amber">{activeMeetings.length} meetings</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Meeting name">
                  <TextInput
                    value={meetingName}
                    onChange={setMeetingName}
                    placeholder="Randwick"
                  />
                </Field>

                <Field label="Meeting date">
                  <TextInput
                    type="date"
                    value={meetingDate}
                    onChange={setMeetingDate}
                    placeholder=""
                  />
                </Field>

                <Field label="Track condition">
                  <Select
                    value={meetingTrackCondition}
                    onChange={setMeetingTrackCondition}
                  >
                    <option>Good 3</option>
                    <option>Good 4</option>
                    <option>Soft 5</option>
                    <option>Soft 6</option>
                    <option>Soft 7</option>
                    <option>Heavy 8</option>
                    <option>Heavy 9</option>
                    <option>Heavy 10</option>
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddMeeting}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Meeting"}
                </button>
                <button
                  type="button"
                  onClick={clearMeetingForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-4 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Meetings loaded</h2>
                <Badge tone="blue">Builder only</Badge>
              </div>

              <div className="space-y-3">
                {activeMeetings.length > 0 ? (
                  activeMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-zinc-950">
                            {meeting.meeting_name}
                          </p>
                          <p className="text-sm text-zinc-500">{meeting.meeting_date}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone="amber">{meeting.track_condition || "—"}</Badge>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            disabled={isPending}
                            className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No meetings loaded yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">2. Add race</h2>
                  <p className="text-sm text-zinc-500">
                    Build races under a meeting before loading runners.
                  </p>
                </div>
                <Badge tone="green">{draftRaces.length} draft races</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting">
                  <Select
                    value={selectedMeetingIdForRace}
                    onChange={setSelectedMeetingIdForRace}
                  >
                    <option value="">Select meeting</option>
                    {activeMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {formatMeetingLabel(meeting)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Race number">
                  <TextInput
                    value={raceNumber}
                    onChange={setRaceNumber}
                    placeholder="6"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Race name">
                  <TextInput
                    value={raceName}
                    onChange={setRaceName}
                    placeholder="Sprint Handicap"
                  />
                </Field>

                <Field label="Distance (m)">
                  <TextInput
                    value={raceDistance}
                    onChange={setRaceDistance}
                    placeholder="1200"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddRace}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Race"}
                </button>
                <button
                  type="button"
                  onClick={clearRaceForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-4 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Draft races loaded</h2>
                <Badge tone="violet">Builder only</Badge>
              </div>

              <div className="space-y-3">
                {draftRaces.length > 0 ? (
                  draftRaces.map((race) => {
                    const meeting = meetings.find((item) => item.id === race.meeting_id);

                    return (
                      <div
                        key={race.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-zinc-950">
                                R{race.race_number} {race.race_name}
                              </p>
                              <Badge tone={getRaceStatusTone(race.status)}>
                                {race.status}
                              </Badge>
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {meeting?.meeting_name || "Unknown meeting"} · {race.distance_m || "—"}m
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge tone="blue">
                              {runnersForRace(race.id).length} runners
                            </Badge>

                            <button
                              type="button"
                              onClick={() => handleTogglePublish(race.id, race.status)}
                              disabled={isPending}
                              className="rounded-2xl bg-black px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                            >
                              Send to Current Races
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRace(race.id)}
                              disabled={isPending}
                              className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">No draft races loaded yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="bg-white/95">
            <div className="space-y-6 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">3. Add runner</h2>
                  <p className="text-sm text-zinc-500">
                    Saved horses now pull recent form from your own settled race history. You can still override anything before saving.
                  </p>
                </div>
                <Badge tone="rose">{initialHorses.length} horses</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting">
                  <Select
                    value={selectedMeetingIdForRunner}
                    onChange={(value) => {
                      setSelectedMeetingIdForRunner(value);
                      setSelectedRaceIdForRunner("");
                      setTrackFormLast6("");
                      setDistanceFormLast6("");
                    }}
                  >
                    <option value="">Select meeting</option>
                    {activeMeetings.map((meeting) => (
                      <option key={meeting.id} value={String(meeting.id)}>
                        {formatMeetingLabel(meeting)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Race">
                  <Select
                    value={selectedRaceIdForRunner}
                    onChange={(value) => {
                      setSelectedRaceIdForRunner(value);
                      setDistanceFormLast6("");
                    }}
                  >
                    <option value="">Select race</option>
                    {racesForSelectedMeeting.map((race) => (
                      <option key={race.id} value={String(race.id)}>
                        R{race.race_number} {race.race_name} — {race.distance_m || "—"}m
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Horse search"
                hint="Pick a saved horse to auto-fill its recent form. If it’s new, leave the typed name and SmartPunt will create it."
              >
                <TextInput
                  value={horseQuery}
                  onChange={(value) => {
                    setHorseQuery(value);
                    setSelectedHorseId("");
                    setFormLast6("");
                    setTrackFormLast6("");
                    setDistanceFormLast6("");
                  }}
                  placeholder="Private Harry"
                />
              </Field>

              {horseQuery.trim() ? (
                <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Horse suggestions
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredHorseSuggestions.length > 0 ? (
                      filteredHorseSuggestions.map((horse) => (
                        <button
                          key={horse.id}
                          type="button"
                          onClick={() => handleSelectHorse(horse)}
                          className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                            selectedHorseId === String(horse.id)
                              ? "bg-black text-amber-300"
                              : "border border-amber-300/40 bg-white text-zinc-800 hover:bg-amber-100"
                          }`}
                        >
                          {horse.horse_name}
                          {formatHorseMeta(horse) ? ` · ${formatHorseMeta(horse)}` : ""}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-600">
                        No saved horse matched. Add runner to create this horse in the master list.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {activeHorseId ? (
                <div className="rounded-[24px] border border-emerald-200/40 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                        Database horse form
                      </p>
                      <p className="mt-2 text-sm text-zinc-700">
                        SmartPunt has matched this horse to your own history and can prefill form lines from archived races.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={applySuggestedHorseForm}
                      className="rounded-2xl bg-black px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900"
                    >
                      Pull Form From Database
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Suggested Last 6
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                        {suggestedOverallForm || "No settled form yet"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Suggested Track Form
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                        {suggestedTrackForm || "No same-track history yet"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Suggested Distance Form
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                        {suggestedDistanceForm || "No same-trip history yet"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Jockey">
                  <TextInput
                    value={jockeyName}
                    onChange={setJockeyName}
                    placeholder="J McDonald"
                  />
                </Field>

                <Field label="Trainer">
                  <TextInput
                    value={trainerName}
                    onChange={setTrainerName}
                    placeholder="Chris Waller"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Barrier">
                  <TextInput
                    value={barrier}
                    onChange={setBarrier}
                    placeholder="4"
                  />
                </Field>

                <Field label="Market price">
                  <TextInput
                    value={marketPrice}
                    onChange={setMarketPrice}
                    placeholder="3.80"
                  />
                </Field>

                <Field label="Weight (kg)">
                  <TextInput
                    value={weightKg}
                    onChange={setWeightKg}
                    placeholder="56.5"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Apprentice jockey">
                  <Select
                    value={isApprentice ? "yes" : "no"}
                    onChange={(value) => {
                      const apprentice = value === "yes";
                      setIsApprentice(apprentice);
                      if (!apprentice) {
                        setApprenticeClaim("");
                      }
                    }}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </Field>

                <Field label="Claim (kg)">
                  <Select
                    value={apprenticeClaim}
                    onChange={setApprenticeClaim}
                  >
                    <option value="">No claim</option>
                    <option value="0.5">0.5kg</option>
                    <option value="1">1.0kg</option>
                    <option value="1.5">1.5kg</option>
                    <option value="2">2.0kg</option>
                    <option value="2.5">2.5kg</option>
                    <option value="3">3.0kg</option>
                    <option value="3.5">3.5kg</option>
                    <option value="4">4.0kg</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Last 6 starts" hint="Pulled from recent settled runs when available">
                  <TextInput
                    value={formLast6}
                    onChange={setFormLast6}
                    placeholder="1-2-1-3-2-1"
                  />
                </Field>

                <Field label="Track form (last 6)" hint="Matched to selected meeting where possible">
                  <TextInput
                    value={trackFormLast6}
                    onChange={setTrackFormLast6}
                    placeholder="1-1-2-3-1-2"
                  />
                </Field>

                <Field label="Distance form (last 6)" hint="Matched to selected race trip where possible">
                  <TextInput
                    value={distanceFormLast6}
                    onChange={setDistanceFormLast6}
                    placeholder="2-3-1-1-2-4"
                  />
                </Field>
              </div>

              <div className="rounded-[24px] border border-blue-200/40 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                  Selected race
                </p>
                <p className="mt-2 text-sm text-zinc-700">
                  {selectedRace
                    ? `R${selectedRace.race_number} ${selectedRace.race_name} — ${selectedRace.distance_m || "—"}m · ${selectedRaceRunnerCount} runners loaded`
                    : "Choose a meeting and draft race to load runners cleanly."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddRunner}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Add Runner"}
                </button>
                <button
                  type="button"
                  onClick={clearRunnerForm}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="space-y-5 p-6 text-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">4. Draft race board</h2>
                <Badge tone="green">{runners.length} loaded</Badge>
              </div>

              <div className="rounded-[24px] border border-amber-200/30 bg-amber-50 p-4 text-sm text-zinc-700">
                Race Builder is now for building only. Once a race is ready, send it to Current Races to manage live edits, scratchings, and official settlement.
              </div>

              <div className="space-y-4">
                {draftRaces.length > 0 ? (
                  draftRaces.map((race) => {
                    const meeting = meetings.find((item) => item.id === race.meeting_id);
                    const raceRunners = runnersForRace(race.id);

                    return (
                      <div
                        key={race.id}
                        className="rounded-[24px] border border-amber-200/30 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-zinc-950">
                                {meeting?.meeting_name || "Meeting"} · R{race.race_number}
                              </p>
                              <Badge tone={getRaceStatusTone(race.status)}>
                                {race.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-zinc-500">
                              {race.race_name} · {race.distance_m || "—"}m
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="amber">{raceRunners.length} runners</Badge>
                            <button
                              type="button"
                              onClick={() => handleTogglePublish(race.id, race.status)}
                              disabled={isPending}
                              className="rounded-2xl bg-black px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-zinc-900 disabled:opacity-60"
                            >
                              Send to Current Races
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {raceRunners.length > 0 ? (
                            raceRunners.map((runner) => {
                              const horse = findHorse(runner.horse_id);

                              return (
                                <div
                                  key={runner.id}
                                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
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
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRunner(runner.id)}
                                        disabled={isPending}
                                        className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Last 6
                                      </p>
                                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                                        {runner.form_last_6 || "—"}
                                      </p>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Track form
                                      </p>
                                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                                        {runner.track_form_last_6 || "—"}
                                      </p>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Distance form
                                      </p>
                                      <p className="mt-2 text-sm font-semibold text-zinc-900">
                                        {runner.distance_form_last_6 || "—"}
                                      </p>
                                    </div>
                                  </div>
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
                  })
                ) : (
                  <p className="text-sm text-zinc-500">No draft races available yet.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">What Race Builder does now</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Build meetings</p>
                <p>• Build draft races</p>
                <p>• Add runners to draft races</p>
                <p>• Prefill horse form from your own archive</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Why this matters</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Less manual typing</p>
                <p>• Your database becomes smarter over time</p>
                <p>• Admin can still override form manually</p>
              </div>
            </div>
          </Panel>

          <Panel className="bg-white/95">
            <div className="p-6 text-zinc-950">
              <h3 className="text-lg font-semibold">Next build step</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Auto-finalise matching tips</p>
                <p>• Prefill more runner details where useful</p>
                <p>• Add post-race admin notes</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
