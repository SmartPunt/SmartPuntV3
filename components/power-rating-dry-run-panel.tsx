"use client";

import { useState, useTransition } from "react";
import {
  dryRunSmartPuntPowerRatingsAction,
  recalculateSmartPuntPowerRatingsAction,
} from "@/lib/actions";

type DryRunHorse = {
  horseId: number;
  horseName: string;
  powerRating: number | null;
  rawScore: number | null;
  breakdown: any;
};
type DryRunResult = {
  success: boolean;
  error: string | null;
  total: number;
  rated: number;
  unrated: number;
  distribution?: { band: string; count: number }[];
  top: DryRunHorse[];
  bottom: DryRunHorse[];
};

export default function PowerRatingDryRunPanel() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DryRunResult | null>(null);
const [saveResult, setSaveResult] = useState<{
  success: boolean;
  error: string | null;
  total: number;
  rated: number;
  unrated: number;
  updated: number;
} | null>(null);
  function runDryTest() {
    startTransition(async () => {
      const response = await dryRunSmartPuntPowerRatingsAction();
      setResult(response as DryRunResult);
    });
  }
  function savePowerRatings() {
    const confirmed = window.confirm(
      "This will save SmartPunt Power Ratings to the horses table. Continue?",
    );

    if (!confirmed) return;

    startTransition(async () => {
      const response = await recalculateSmartPuntPowerRatingsAction();
      setSaveResult(response);
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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runDryTest}
            disabled={isPending}
            className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Working..." : "Run Power Rating Dry Test"}
          </button>

          <button
            type="button"
onClick={() => alert("Power Rating save is temporarily disabled while we move this to a safer batch update.")}
            disabled={isPending}
            className="rounded-2xl border border-emerald-300/60 bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Working..." : "Save Power Ratings"}
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="mt-5 overflow-hidden rounded-full bg-white/10">
          <div className="h-2 w-1/2 animate-pulse rounded-full bg-amber-300" />
        </div>
      ) : null}
      {saveResult ? (
        <div
          className={`mt-5 rounded-2xl border p-4 text-sm ${
            saveResult.success
              ? "border-emerald-300/40 bg-emerald-950/40 text-emerald-100"
              : "border-red-400/40 bg-red-950/40 text-red-100"
          }`}
        >
          {saveResult.success ? (
            <span>
              SmartPunt Power Ratings saved. Updated {saveResult.updated} horses.
              Rated {saveResult.rated}. Unrated {saveResult.unrated}.
            </span>
          ) : (
            <span>{saveResult.error || "Power Rating save failed."}</span>
          )}
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

              {result.distribution?.length ? (
                <div className="mt-5 rounded-2xl bg-white/10 p-4">
                  <h3 className="font-bold text-amber-200">
                    Rating Distribution
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {result.distribution.map((item) => (
                      <div
                        key={item.band}
                        className="rounded-xl bg-black/30 px-3 py-2 text-sm"
                      >
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                          {item.band}
                        </p>
                        <p className="mt-1 text-lg font-bold text-white">
                          {item.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
              {horse.breakdown ? (
  <div className="mt-1 text-[11px] text-zinc-400">
    T:{horse.breakdown.trackScore ?? "-"} ·
    D:{horse.breakdown.distanceScore ?? "-"} ·
    C:{horse.breakdown.conditionScore ?? "-"} ·
    B:{horse.breakdown.specialistBonus ?? 0}
  </div>
) : null}
            </span>
<div className="shrink-0 text-right">
  <div className="font-bold text-amber-300">
    {horse.powerRating ?? "N/A"}
  </div>

  <div className="text-xs text-zinc-400">
    Raw {horse.rawScore?.toFixed(1) ?? "-"}
  </div>
</div>
          </div>
        ))}
      </div>
    </div>
  );
}
