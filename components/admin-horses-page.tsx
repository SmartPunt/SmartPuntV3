"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Badge, Panel } from "@/components/ui";

/* ---------- ACTIVE LINK HELPER ---------- */
function NavLink({
  href,
  label,
  currentPath,
}: {
  href: string;
  label: string;
  currentPath: string;
}) {
  const isActive = currentPath.startsWith(href);

  return (
    <Link
      href={href}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold backdrop-blur-sm transition ${
        isActive
          ? "border-amber-300 bg-amber-300/20 text-amber-200"
          : "border-white/15 bg-black/45 text-white hover:bg-white/15"
      }`}
    >
      {label}
    </Link>
  );
}

/* ---------- TYPES ---------- */

type Horse = {
  id: number;
  horse_name: string;
  normalised_name: string;
  sex: string | null;
  age: number | null;
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
  created_at: string;
};

type Race = {
  id: number;
  meeting_id: number;
  race_number: number;
  race_name: string;
};

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string;
};

type SortMode = "alphabetical" | "newest" | "most_used";

/* ---------- HELPERS ---------- */

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatHorseMeta(horse: Horse) {
  const parts: string[] = [];
  if (horse.sex) parts.push(horse.sex);
  if (horse.age !== null && horse.age !== undefined) parts.push(`${horse.age}yo`);
  return parts.join(" · ");
}

/* ---------- MAIN ---------- */

export default function AdminHorsesPage({
  currentUser,
  initialHorses,
  initialRunners,
  initialRaces,
  initialMeetings,
}: any) {
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical");

  const horseRows = useMemo(() => {
    const rows = initialHorses.map((horse: Horse) => {
      const runners = initialRunners.filter((r: Runner) => r.horse_id === horse.id);

      return {
        ...horse,
        appearances: runners.length,
      };
    });

    return rows
      .filter((h) =>
        h.horse_name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => a.horse_name.localeCompare(b.horse_name));
  }, [initialHorses, initialRunners, search]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">

        {/* HEADER */}
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">

          <img
            src="/header-logo.png"
            className="absolute left-1/2 top-1/2 w-[500px] -translate-x-1/2 -translate-y-1/2 opacity-20"
          />

          <div className="relative z-10 p-6">
            <div className="flex justify-between items-center">

              <Badge tone="amber">Saved Horses</Badge>

              <div className="flex gap-2 flex-wrap">

                <NavLink href="/admin/race-builder" label="Race Builder" currentPath={pathname} />
                <NavLink href="/current-races" label="Current Races" currentPath={pathname} />
                <NavLink href="/race-archive" label="Race Archive" currentPath={pathname} />
                <NavLink href="/admin/horses" label="Saved Horses" currentPath={pathname} />

                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold"
                >
                  Back to Admin
                </Link>

              </div>
            </div>

            <h1 className="text-3xl font-bold mt-6">Horse Library</h1>
            <p className="text-sm text-zinc-400">
              Master list of all horses captured through your race system.
            </p>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-6 space-y-4">

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search horses..."
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3"
          />

          {horseRows.map((horse: any) => (
            <Panel key={horse.id} className="bg-white/95 text-zinc-950 p-4">
              <h3 className="font-semibold">{horse.horse_name}</h3>
              <p className="text-sm text-zinc-500">
                {formatHorseMeta(horse)}
              </p>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
