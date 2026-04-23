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

/* ---------------- TYPES (UNCHANGED) ---------------- */
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

/* ---------------- COMPONENT ---------------- */

export default function CurrentRacesPage({
  currentUser,
  initialMeetings,
  initialRaces,
  initialHorses,
  initialRunners,
}: any) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdmin =
    currentUser?.role === "admin" ||
    currentUser?.role === "staff_admin";

  const currentRaces = useMemo(
    () => initialRaces.filter((r: any) => r.status === "published"),
    [initialRaces]
  );

  const groupedMeetings = useMemo(() => {
    return initialMeetings
      .map((m: any) => ({
        ...m,
        races: currentRaces.filter((r: any) => r.meeting_id === m.id),
      }))
      .filter((m: any) => m.races.length > 0);
  }, [currentRaces, initialMeetings]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">

          {/* ================= SIDEBAR ================= */}
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-black/80 p-5 shadow-2xl">

              <Badge tone="green">SmartPunt</Badge>

              <div className="mt-4">
                <p className="text-lg font-bold">
                  {currentUser.full_name || currentUser.email}
                </p>
                <p className="text-sm text-zinc-400">
                  {isAdmin ? "Race Control Room" : "Race Board"}
                </p>
              </div>

              {/* -------- NAV GROUPS -------- */}
              <div className="mt-6 space-y-4">

                {/* RACING */}
                <div>
                  <p className="text-xs uppercase text-zinc-500 mb-2">Racing</p>

                  <Link href="/current-races" className="block rounded-xl bg-white/10 px-4 py-2 text-sm">
                    Current Races
                  </Link>

                  <Link href="/race-archive" className="block rounded-xl px-4 py-2 text-sm hover:bg-white/10">
                    Race Archive
                  </Link>
                </div>

                {/* TOOLS */}
                {isAdmin && (
                  <div>
                    <p className="text-xs uppercase text-zinc-500 mb-2">Tools</p>

                    <Link href="/admin/race-builder" className="block px-4 py-2 text-sm hover:bg-white/10 rounded-xl">
                      Race Builder
                    </Link>

                    <Link href="/admin/calculator" className="block px-4 py-2 text-sm hover:bg-white/10 rounded-xl">
                      Calculator Lab
                    </Link>
                  </div>
                )}

                {/* ACCOUNT */}
                <div>
                  <p className="text-xs uppercase text-zinc-500 mb-2">Account</p>

                  <Link href="/" className="block px-4 py-2 text-sm hover:bg-white/10 rounded-xl">
                    Dashboard
                  </Link>

                  <form action={signOutAction}>
                    <button className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 rounded-xl">
                      Log Out
                    </button>
                  </form>
                </div>
              </div>

              {/* -------- STATS -------- */}
              <div className="mt-6 space-y-3 text-sm text-zinc-400">
                <p>{currentRaces.length} races live</p>
                <p>{groupedMeetings.length} meetings</p>
              </div>
            </div>
          </aside>

          {/* ================= MAIN CONTENT ================= */}
          <div className="space-y-6">

            <div className="rounded-[32px] bg-black p-6">
              <h1 className="text-3xl font-bold">Current Races</h1>
              <p className="text-zinc-400 mt-2">
                {isAdmin
                  ? "Manage races, runners and results"
                  : "Track races live"}
              </p>
            </div>

            <Panel className="bg-white/95 text-zinc-900">
              <div className="p-6">
                {groupedMeetings.length === 0 ? (
                  <p>No races yet</p>
                ) : (
                  groupedMeetings.map((meeting: any) => (
                    <div key={meeting.id} className="mb-6">
                      <h2 className="text-xl font-bold">
                        {meeting.meeting_name}
                      </h2>

                      {meeting.races.map((race: any) => (
                        <div key={race.id} className="mt-3 border p-4 rounded-xl">
                          <p className="font-semibold">
                            R{race.race_number} {race.race_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </Panel>

          </div>
        </div>
      </div>
    </div>
  );
}
