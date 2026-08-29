import {
  getQualifiedCalculatorTip,
  type Horse,
  type Meeting,
  type Race,
  type Runner,
} from "@/lib/calculator/scoring";

type CalculatorPrediction = {
  id: number;
  race_id: number;
  runner_id: number;
  horse_id: number;
  score: number | string;
  rank: number;
  win_percent: number | string;
  place_percent: number | string;
  recent_form_score: number | string;
  distance_score: number | string;
  track_score: number | string;
  condition_score: number | string;
  barrier_score: number | string;
  weight_score: number | string;
  jockey_score: number | string;
  trainer_score: number | string;
};

type OfficialTip = {
  id: number;
  race_id?: number | null;
  race_runner_id?: number | null;
  horse_id?: number | null;
  horse?: string | null;
  horse_name?: string | null;
  status?: string | null;
};

type VaultMatch = {
  raceId: number;
};

function normaliseTipStatus(
  status?: string | null,
) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isLiveOfficialTipStatus(
  status?: string | null,
) {
  const value =
    normaliseTipStatus(status);

  return (
    !value ||
    value === "active" ||
    value === "published" ||
    value === "pending" ||
    value === "open"
  );
}

function buildSnapshotScoredRunners({
  race,
  meeting,
  predictions,
  runners,
  horses,
}: {
  race: Race;
  meeting: Meeting | undefined;
  predictions: CalculatorPrediction[];
  runners: Runner[];
  horses: Horse[];
}) {
  return [...predictions]
    .sort(
      (a, b) =>
        Number(a.rank || 0) -
        Number(b.rank || 0),
    )
    .flatMap((prediction) => {
      const runner = runners.find(
        (item) =>
          Number(item.id) ===
          Number(prediction.runner_id),
      );

      if (!runner) {
        return [];
      }

      const horse = horses.find(
        (item) =>
          Number(item.id) ===
          Number(
            prediction.horse_id ||
              runner.horse_id,
          ),
      );

      const listedWeight =
        runner.weight_kg === null ||
        runner.weight_kg === undefined
          ? null
          : Number(runner.weight_kg);

      const apprenticeClaim =
        runner.apprentice_claim_kg ===
          null ||
        runner.apprentice_claim_kg ===
          undefined
          ? 0
          : Number(
              runner.apprentice_claim_kg,
            );

      const effectiveWeight =
        listedWeight === null
          ? null
          : Math.max(
              0,
              listedWeight -
                apprenticeClaim,
            );

      return [
        {
          ...runner,
          horse_name:
            horse?.horse_name ||
            "Unknown horse",
          smartpunt_power_rating:
            horse?.smartpunt_power_rating ??
            null,
          meeting_name:
            meeting?.meeting_name ||
            "Unknown meeting",
          meeting_date:
            meeting?.meeting_date || "",
          track_condition:
            meeting?.track_condition ||
            null,
          race_name: race.race_name,
          race_number:
            race.race_number,
          distance_m: race.distance_m,
          effectiveWeight,
          score: Number(
            prediction.score || 0,
          ),
          winPercent: Number(
            prediction.win_percent || 0,
          ),
          placePercent: Number(
            prediction.place_percent || 0,
          ),
          verdict: "Snapshot",
          rank: Number(
            prediction.rank || 0,
          ),
          components: {
            recentForm: Number(
              prediction
                .recent_form_score || 0,
            ),
            distance: Number(
              prediction.distance_score ||
                0,
            ),
            track: Number(
              prediction.track_score || 0,
            ),
            condition: Number(
              prediction
                .condition_score || 0,
            ),
            barrier: Number(
              prediction
                .barrier_score || 0,
            ),
            weight: Number(
              prediction.weight_score ||
                0,
            ),
            jockey: Number(
              prediction
                .jockey_score || 0,
            ),
            trainer: Number(
              prediction
                .trainer_score || 0,
            ),
            consistency: 50,
            powerRating: Number(
              horse
                ?.smartpunt_power_rating ||
                0,
            ),
            powerAdjustment: 0,
          },
          audit: undefined as any,
        },
      ];
    }) as any[];
}

export function getSubscriberLiveOpportunityCount({
  meetingDate,
  races,
  runners,
  horses,
  meetings,
  calculatorPredictions,
  officialTips,
  vaultMatches,
}: {
  meetingDate: string;
  races: Race[];
  runners: Runner[];
  horses: Horse[];
  meetings: Meeting[];
  calculatorPredictions: CalculatorPrediction[];
  officialTips: OfficialTip[];
  vaultMatches: VaultMatch[];
}) {
  const dayRaces = races.filter(
    (race) => {
      if (
        !["published", "closed"].includes(
          String(race.status || ""),
        )
      ) {
        return false;
      }

      const meeting =
        meetings.find(
          (item) =>
            Number(item.id) ===
            Number(race.meeting_id),
        );

      return (
        meeting?.meeting_date ===
        meetingDate
      );
    },
  );

  const liveRaceIds = new Set(
    dayRaces
      .filter(
        (race) =>
          String(race.status || "")
            .trim()
            .toLowerCase() !==
          "closed",
      )
      .map((race) =>
        Number(race.id),
      ),
  );

  let bestOpportunityCount = 0;

  dayRaces.forEach((race) => {
    if (
      String(race.status || "")
        .trim()
        .toLowerCase() === "closed"
    ) {
      return;
    }

    const meeting =
      meetings.find(
        (item) =>
          Number(item.id) ===
          Number(race.meeting_id),
      );

    const raceSnapshotRows =
      calculatorPredictions.filter(
        (prediction) =>
          Number(
            prediction.race_id,
          ) === Number(race.id),
      );

    const raceScoredRunners =
      raceSnapshotRows.length > 0
        ? buildSnapshotScoredRunners({
            race,
            meeting,
            predictions:
              raceSnapshotRows,
            runners,
            horses,
          })
        : [];

    /*
     * This deliberately matches
     * Subscriber Live Picks.
     *
     * A race without its released
     * Calculator snapshot is not
     * counted as a Best Opportunity.
     */
    if (
      !raceScoredRunners.length
    ) {
      return;
    }

    const raceTopRunner =
      raceScoredRunners[0] || null;

    const raceQualifiedTip =
      getQualifiedCalculatorTip(
        raceScoredRunners,
        {
          trackCondition:
            raceTopRunner
              ?.track_condition ||
            null,
          raceName:
            race.race_name || "",
          placeTerms:
            race.place_terms ||
            "top_3",
          meetingDate:
            meeting?.meeting_date ||
            null,
        },
      );

    const raceOfficialTip =
      officialTips.find((tip) => {
        if (
          Number(
            tip.race_id || 0,
          ) !== Number(race.id)
        ) {
          return false;
        }

        return isLiveOfficialTipStatus(
          tip.status,
        );
      }) || null;

    const raceOfficialTipRunner =
      raceOfficialTip
        ? raceScoredRunners.find(
            (runner) => {
              if (
                raceOfficialTip
                  .race_runner_id
              ) {
                return (
                  Number(runner.id) ===
                  Number(
                    raceOfficialTip
                      .race_runner_id,
                  )
                );
              }

              if (
                raceOfficialTip.horse_id
              ) {
                return (
                  Number(
                    runner.horse_id,
                  ) ===
                  Number(
                    raceOfficialTip
                      .horse_id,
                  )
                );
              }

              const tipHorseName =
                String(
                  raceOfficialTip.horse ||
                    raceOfficialTip
                      .horse_name ||
                    "",
                )
                  .trim()
                  .toLowerCase();

              return tipHorseName
                ? String(
                    runner.horse_name ||
                      "",
                  )
                    .trim()
                    .toLowerCase() ===
                    tipHorseName
                : false;
            },
          ) || null
        : null;

    const isConsensus =
      Boolean(
        raceOfficialTipRunner &&
          raceQualifiedTip?.runner &&
          Number(
            raceOfficialTipRunner.id,
          ) ===
            Number(
              raceQualifiedTip.runner.id,
            ),
      );

    /*
     * Maverick + Calculator on the
     * same horse = one Consensus
     * opportunity.
     */
    if (raceOfficialTip) {
      bestOpportunityCount += 1;
    }

    if (
      raceQualifiedTip?.runner &&
      !isConsensus
    ) {
      bestOpportunityCount += 1;
    }
  });

  /*
   * This matches Live Picks'
   * vaultOpportunities:
   * only Vault matches belonging
   * to currently live races for
   * the selected date.
   */
  const vaultOpportunityCount =
    vaultMatches.filter((match) =>
      liveRaceIds.has(
        Number(match.raceId),
      ),
    ).length;

  return (
    bestOpportunityCount +
    vaultOpportunityCount
  );
}
