"use client";

import { useState, useTransition } from "react";
import { dryRunSmartPuntPowerRatingsAction } from "@/lib/actions";

type DryRunHorse = {
  horseId: number;
  horseName: string;
  powerRating: number | null;
  rawScore: number | null;
  breakdown: unknown;
};

type DryRunResult = {
  success: boolean;
  error: string | null;
  total: number;
  rated: number;
  unrated: number;
  top: DryRunHorse[];
  bottom: DryRunHorse[];
};

export default function PowerRatingDryRunPanel() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DryRunResult | null>(null);

  function runDryTest() {
    startTransition(async () => {
      const response = await dryRunSmartPuntPowerRatingsAction();
      setResult(response as DryRunResult);
    });
  }

  return (
    <div className="mt-6 rounded-[28px] border border-amber-300/30 bg-zinc-950 p-5 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
            SmartPunt Power Rating
          </p>
          <h2 className="mt-2 text-xl font-bold">Dry run test</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">
            Runs the Power Rating engine without writing anything to the
            database. Use this to inspect the top and bottom rated horses before
            saving ratings.
          </p>
        </div>

        <button
          type="button"
          onClick={runDryTest}
          disabled={isPending}
          className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Running dry test..." : "Run Power Rating Dry Test"}
        </button>
      </div>

      {isPending ? (
        <div className="mt-5 overflow-hidden rounded-full bg-white/10">
          <div className="h-2 w-1/2 animate-pulse rounded-full bg-amber-300" />
        </div>
      ) : null}

      {result ? (
        <div className="mt-5">
          {result.success ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                    Total horses
                  </p>
                  <p className="mt-1 text-2xl font-bold">{result.total}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                    Rated
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-300">
                    {result.rated}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                    Unrated
                  </p>
                  <p className="mt-1 text-2xl font-bold text-zinc-300">
                    {result.unrated}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <RatingList title="Top 20" horses={result.top} />
                <RatingList title="Bottom 20" horses={result.bottom} />
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
              {result.error || "Power Rating dry run failed."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RatingList({
  title,
  horses,
}: {
  title: string;
  horses: DryRunHorse[];
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <h3 className="font-bold text-amber-200">{title}</h3>
      <div className="mt-3 space-y-2">
        {horses.map((horse, index) => (
          <div
            key={`${horse.horseId}-${index}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2 text-sm"
          >
            <span className="truncate">
              {index + 1}. {horse.horseName}
            </span>
            <span className="shrink-0 font-bold text-amber-300">
              {horse.powerRating ?? "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
