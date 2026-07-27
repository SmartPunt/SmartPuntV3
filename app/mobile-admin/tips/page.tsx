import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MobileMaverickTipBuilder from "@/components/mobile-maverick-tip-builder";

export const dynamic = "force-dynamic";

function getPerthDate(offsetDays = 0) {
  const perthParts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Perth",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

  const year = Number(
    perthParts.find(
      (part) => part.type === "year",
    )?.value,
  );

  const month = Number(
    perthParts.find(
      (part) => part.type === "month",
    )?.value,
  );

  const day = Number(
    perthParts.find(
      (part) => part.type === "day",
    )?.value,
  );

  const calendarDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day + offsetDays,
      12,
    ),
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(calendarDate);
}

export default async function MobileAdminTipsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.status !== "active" ||
    profile.role !== "admin"
  ) {
    redirect("/mobile-admin");
  }

  const supabase = await createClient();

  const today = getPerthDate(0);
  const tomorrow = getPerthDate(1);

  const {
    data: meetings,
    error: meetingsError,
  } = await supabase
    .from("meetings")
    .select(
      "id, meeting_name, meeting_date, track_condition",
    )
    .in("meeting_date", [
      today,
      tomorrow,
    ])
    .order("meeting_date", {
      ascending: true,
    })
    .order("meeting_name", {
      ascending: true,
    });

  if (meetingsError) {
    throw new Error(
      meetingsError.message,
    );
  }

  const meetingIds = (
    meetings || []
  )
    .map((meeting) =>
      Number(meeting.id),
    )
    .filter(Boolean);

  const {
    data: races,
    error: racesError,
  } = meetingIds.length
    ? await supabase
        .from("races")
        .select(
          "id, meeting_id, race_number, race_name, distance_m, status",
        )
        .in("meeting_id", meetingIds)
        .eq("status", "published")
        .order("meeting_id", {
          ascending: true,
        })
        .order("race_number", {
          ascending: true,
        })
    : {
        data: [],
        error: null,
      };

  if (racesError) {
    throw new Error(racesError.message);
  }

  const raceIds = (
    races || []
  )
    .map((race) =>
      Number(race.id),
    )
    .filter(Boolean);

  const [
    runnersQuery,
    existingTipsQuery,
  ] = raceIds.length
    ? await Promise.all([
        supabase
          .from("race_runners")
          .select(
            "id, race_id, horse_id, runner_number, barrier, market_price, weight_kg, jockey_name, scratched",
          )
          .in("race_id", raceIds)
          .order("race_id", {
            ascending: true,
          })
          .order("runner_number", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("suggested_tips")
          .select(
            "id, meeting_id, race_id, race_runner_id, horse_id, horse, race, type, confidence, tip_angle, settled_at",
          )
          .in("race_id", raceIds)
          .is("settled_at", null)
          .order("created_at", {
            ascending: false,
          }),
      ])
    : [
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
      ];

  if (runnersQuery.error) {
    throw new Error(
      runnersQuery.error.message,
    );
  }

  if (existingTipsQuery.error) {
    throw new Error(
      existingTipsQuery.error.message,
    );
  }

  const horseIds = (
    runnersQuery.data || []
  )
    .map((runner) =>
      Number(runner.horse_id),
    )
    .filter(Boolean);

  const uniqueHorseIds =
    Array.from(new Set(horseIds));

  const {
    data: horses,
    error: horsesError,
  } = uniqueHorseIds.length
    ? await supabase
        .from("horses")
        .select("id, horse_name")
        .in("id", uniqueHorseIds)
        .order("horse_name", {
          ascending: true,
        })
    : {
        data: [],
        error: null,
      };

  if (horsesError) {
    throw new Error(
      horsesError.message,
    );
  }

  return (
    <MobileMaverickTipBuilder
      meetings={meetings || []}
      races={races || []}
      runners={
        runnersQuery.data || []
      }
      horses={horses || []}
      existingTips={
        existingTipsQuery.data || []
      }
      dayDates={{
        today,
        tomorrow,
      }}
    />
  );
}
