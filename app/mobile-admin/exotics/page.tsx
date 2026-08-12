import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MobileAdminExotics from "@/components/mobile-admin-exotics";

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

export default async function MobileAdminExoticsPage() {
  const profile =
    await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.status !== "active" ||
    profile.role !== "admin"
  ) {
    redirect("/mobile-admin");
  }

  const supabase =
    await createClient();

  const today =
    getPerthDate(0);

  const tomorrow =
    getPerthDate(1);

  const {
    data: meetings,
    error: meetingsError,
  } = await supabase
    .from("meetings")
    .select(
      "id, meeting_name, meeting_date",
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

  const meetingIds =
    (meetings || [])
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
          "id, meeting_id, race_number, race_name, status",
        )
        .in(
          "meeting_id",
          meetingIds,
        )
        .eq(
          "status",
          "published",
        )
        .order(
          "meeting_id",
          {
            ascending: true,
          },
        )
        .order(
          "race_number",
          {
            ascending: true,
          },
        )
    : {
        data: [],
        error: null,
      };

  if (racesError) {
    throw new Error(
      racesError.message,
    );
  }

  const raceIds =
    (races || [])
      .map((race) =>
        Number(race.id),
      )
      .filter(Boolean);

  const [
    runnersQuery,
    exoticTipsQuery,
  ] = raceIds.length
    ? await Promise.all([
        supabase
          .from("race_runners")
          .select(
            "id, race_id, horse_id, runner_number, barrier, scratched",
          )
          .in(
            "race_id",
            raceIds,
          )
          .order(
            "race_id",
            {
              ascending: true,
            },
          )
          .order(
            "runner_number",
            {
              ascending: true,
              nullsFirst: false,
            },
          ),

        supabase
          .from(
            "maverick_exotic_tips",
          )
          .select(
            "id, race_id, bet_type, mode, selections, created_at, updated_at",
          )
          .in(
            "race_id",
            raceIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          ),
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

  if (exoticTipsQuery.error) {
    throw new Error(
      exoticTipsQuery.error.message,
    );
  }

  const activeRunners =
    (
      runnersQuery.data || []
    ).filter(
      (runner) =>
        runner.scratched !== true,
    );

  const horseIds =
    activeRunners
      .map((runner) =>
        Number(
          runner.horse_id,
        ),
      )
      .filter(Boolean);

  const uniqueHorseIds =
    Array.from(
      new Set(horseIds),
    );

  const {
    data: horses,
    error: horsesError,
  } = uniqueHorseIds.length
    ? await supabase
        .from("horses")
        .select(
          "id, horse_name",
        )
        .in(
          "id",
          uniqueHorseIds,
        )
        .order(
          "horse_name",
          {
            ascending: true,
          },
        )
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.18),transparent_30%),linear-gradient(180deg,#030303_0%,#09090b_50%,#020617_100%)] px-3 py-4 text-white">
      <div className="mx-auto max-w-[460px]">
        <div className="mb-4">
          <Link
            href="/mobile-admin"
            className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200"
          >
            ← Mobile Admin
          </Link>
        </div>

        <MobileAdminExotics
          meetings={
            meetings || []
          }
          races={
            races || []
          }
          runners={
            activeRunners
          }
          horses={
            horses || []
          }
          existingTips={
            exoticTipsQuery.data ||
            []
          }
          dayDates={{
            today,
            tomorrow,
          }}
        />
      </div>
    </div>
  );
}
