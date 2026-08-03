import {
  calculateRaceScores,
  getQualifiedCalculatorTip,
  type Horse,
  type JockeyProfile,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";

export type SubscriberCalculatorPlay = {
  id: number;
  race_id: number | null;
  race_runner_id: number | null;
  horse_id: number | null;
  race: string | null;
  horse: string | null;
  bet_type: string | null;
  confidence: string | null;
  score: number | string | null;
  win_percent: number | string | null;
  place_percent: number | string | null;
  race_gap: number | string | null;
  race_confidence_percent: number | string | null;
  race_confidence_tier: string | null;
  status: string | null;
  finishing_position: number | null;
  won: boolean | null;
  placed: boolean | null;
  settled_at: string | null;
  published_at: string | null;
  calculator_tip_id?: number | null;
};

function asRaces(rows: any[]): Race[] {
  return rows as Race[];
}

function asRunners(rows: any[]): Runner[] {
  return rows as Runner[];
}

function asHorses(rows: any[]): Horse[] {
  return rows as Horse[];
}

function asMeetings(rows: any[]): Meeting[] {
  return rows as Meeting[];
}

function asJockeyProfiles(rows: any[]): JockeyProfile[] {
  return rows as JockeyProfile[];
}

export function getSubscriberCalculatorPlays({
  races,
  scoringRaces,
  runners,
  scoringRunners,
  horses,
  meetings,
  jockeyProfiles,
}: {
  races: any[];
  scoringRaces?: any[];
  runners: any[];
  scoringRunners?: any[];
  horses: any[];
  meetings: any[];
  jockeyProfiles?: any[];
}): SubscriberCalculatorPlay[] {
  const typedRaces = asRaces(races || []);
  const typedScoringRaces = asRaces(scoringRaces?.length ? scoringRaces : races || []);
  const typedScoringRunners = asRunners(scoringRunners?.length ? scoringRunners : runners || []);
  const typedHorses = asHorses(horses || []);
  const typedMeetings = asMeetings(meetings || []);
  const typedJockeyProfiles = asJockeyProfiles(jockeyProfiles || []);

  const meetingMap = new Map(
    typedMeetings.map((meeting) => [
      Number(meeting.id),
      meeting,
    ]),
  );

  return typedRaces
    .filter((race) => race.status === "published" || race.status === "closed")
    .sort((a, b) => {
      const meetingA =
        meetingMap.get(Number(a.meeting_id))
          ?.meeting_name || "";

      const meetingB =
        meetingMap.get(Number(b.meeting_id))
          ?.meeting_name || "";

      const meetingCompare =
        meetingA.localeCompare(meetingB);

      if (meetingCompare !== 0) {
        return meetingCompare;
      }

      return (
        Number(a.race_number || 0) -
        Number(b.race_number || 0)
      );
    })
    .map((race) => {
      const scoredRunners = calculateRaceScores({
        activeRace: race,
        races: typedScoringRaces,
        runners: typedScoringRunners,
        horses: typedHorses,
        meetings: typedMeetings,
        jockeyProfiles: typedJockeyProfiles,
      });

      if (!scoredRunners.length) return null;

      const topRunner = scoredRunners[0] || null;
const meeting =
  meetingMap.get(
    Number(race.meeting_id),
  ) || null;

const qualifiedTip =
  getQualifiedCalculatorTip(
    scoredRunners,
    {
      trackCondition:
        topRunner?.track_condition ||
        meeting?.track_condition ||
        null,

      raceName:
        race.race_name || "",

      placeTerms:
        race.place_terms || "top_3",

      meetingDate:
        meeting?.meeting_date || null,
    },
  );

if (!qualifiedTip) return null;

const runner = qualifiedTip.runner;

return {
        id: Number(race.id) * 100000 + Number(runner.id),
        race_id: Number(race.id),
        race_runner_id: Number(runner.id),
        horse_id: Number(runner.horse_id),
        race: `${meeting?.meeting_name || "Meeting"} R${race.race_number} ${race.race_name}`,
        horse: runner.horse_name || null,
        bet_type: qualifiedTip.type,
        confidence: qualifiedTip.raceConfidence.tier,
        score: Number(runner.score || 0),
        win_percent: Number(runner.winPercent || 0),
        place_percent: Number(runner.placePercent || 0),
        race_gap: Number(qualifiedTip.gap || 0),
        race_confidence_percent: Number(
          qualifiedTip.raceConfidence.confidencePercent || 0,
        ),
        race_confidence_tier: qualifiedTip.raceConfidence.tier,
        status: "active",
        finishing_position: null,
        won: null,
        placed: null,
        settled_at: null,
        published_at: null,
        calculator_tip_id: null,
      };
    })
    .filter(Boolean) as SubscriberCalculatorPlay[];
}
