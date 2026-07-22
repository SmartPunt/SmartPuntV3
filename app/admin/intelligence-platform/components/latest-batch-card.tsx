import { Badge, Panel } from "@/components/ui";
import type { ResearchBatchSummary } from "@/lib/research/actions";

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

function Detail({
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

export default function LatestBatchCard({
  batch,
}: {
  batch: ResearchBatchSummary | null;
}) {
  return (
    <Panel className="h-full bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Latest Research Snapshot
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Most recent immutable race and runner prediction batch.
            </p>
          </div>

          <Badge tone={batch ? "green" : "slate"}>
            {batch ? "Captured" : "No snapshot"}
          </Badge>
        </div>

        {batch ? (
          <>
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
              <p className="text-sm text-zinc-500">
                {batch.meetingDate || "Unknown meeting date"}
              </p>

              <h3 className="mt-1 text-2xl font-bold text-zinc-950">
                {batch.meetingName || "Unknown meeting"}{" "}
                {batch.raceNumber
                  ? `R${batch.raceNumber}`
                  : ""}
              </h3>

              <p className="mt-1 text-sm font-medium text-zinc-700">
                {batch.raceName || "Unnamed race"}
                {batch.distanceM
                  ? ` • ${batch.distanceM}m`
                  : ""}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="blue">
                  {batch.activeRunnerCount} runners
                </Badge>

                <Badge tone="amber">
                  {batch.raceConfidenceTier || "Unknown"} confidence
                </Badge>

                <Badge tone="green">
                  {batch.raceConfidencePercent}% confidence
                </Badge>

                <Badge tone="slate">
                  Gap {batch.raceGap}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail
                label="Snapshot time"
                value={formatDateTime(batch.snapshotAt)}
              />

              <Detail
                label="Snapshot stage"
                value={batch.snapshotStage}
              />

              <Detail
                label="Scoring version"
                value={batch.scoringVersion}
              />

              <Detail
                label="Classifier version"
                value={batch.classifierVersion}
              />

              <Detail
                label="Condition"
                value={batch.conditionBand}
              />

              <Detail
                label="Field size"
                value={batch.fieldSizeBand}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Snapshot batch ID
              </p>

              <p className="mt-2 break-all font-mono text-sm text-amber-300">
                {batch.snapshotBatchId}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="font-semibold text-zinc-950">
              No research snapshot has been captured yet.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              The latest settled race will appear here once warehouse
              snapshots are available.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
