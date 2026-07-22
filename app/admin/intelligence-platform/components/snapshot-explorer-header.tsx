import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import type { ResearchBatchDetails } from "@/lib/research/actions";

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-zinc-950">
        {value === null || value === undefined || value === ""
          ? "—"
          : value}
      </p>
    </div>
  );
}

export default function SnapshotExplorerHeader({
  details,
}: {
  details: ResearchBatchDetails;
}) {
  const { batch } = details;

  return (
    <Panel className="overflow-hidden bg-white/95">
      <div className="border-b border-white/10 bg-black p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">Snapshot Explorer</Badge>

              <Badge
                tone={
                  details.runnerCountMatches
                    ? "green"
                    : "amber"
                }
              >
                {details.runnerCountMatches
                  ? "Integrity Passed"
                  : "Integrity Warning"}
              </Badge>

              <Badge tone="slate">Read Only</Badge>
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {batch?.meetingName || "Unknown meeting"}{" "}
              {batch?.raceNumber
                ? `R${batch.raceNumber}`
                : ""}
            </h1>

            <p className="mt-1 text-sm text-zinc-300 sm:text-base">
              {batch?.raceName || "Unnamed race"}
              {batch?.distanceM
                ? ` • ${batch.distanceM}m`
                : ""}
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Immutable replay of the race classification and runner
              predictions captured by SmartPunt for this research batch.
            </p>
          </div>

          <Link
            href="/admin/intelligence-platform"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Intelligence Platform
          </Link>
        </div>
      </div>

      <div className="p-5 text-zinc-950 sm:p-6">
        {batch ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailCard
                label="Snapshot time"
                value={formatDateTime(batch.snapshotAt)}
              />

              <DetailCard
                label="Snapshot stage"
                value={batch.snapshotStage}
              />

              <DetailCard
                label="Scoring version"
                value={batch.scoringVersion}
              />

              <DetailCard
                label="Classifier version"
                value={batch.classifierVersion}
              />

              <DetailCard
                label="Condition"
                value={batch.conditionBand}
              />

              <DetailCard
                label="Field size"
                value={batch.fieldSizeBand}
              />

              <DetailCard
                label="Expected runners"
                value={details.expectedRunnerCount}
              />

              <DetailCard
                label="Captured runners"
                value={details.predictionRunnerCount}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="amber">
                {batch.raceConfidenceTier || "Unknown"} confidence
              </Badge>

              <Badge tone="green">
                {batch.raceConfidencePercent}% confidence
              </Badge>

              <Badge tone="blue">
                Race gap {batch.raceGap}
              </Badge>

              <Badge
                tone={
                  details.runnerCountMatches
                    ? "green"
                    : "amber"
                }
              >
                {details.predictionRunnerCount}/
                {details.expectedRunnerCount} runners captured
              </Badge>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Snapshot batch ID
              </p>

              <p className="mt-2 break-all font-mono text-sm text-amber-300">
                {batch.snapshotBatchId}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-950">
              Batch classification unavailable
            </p>

            <p className="mt-1 text-sm text-amber-800">
              Prediction records may still be present, but no matching
              classification snapshot was found.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
