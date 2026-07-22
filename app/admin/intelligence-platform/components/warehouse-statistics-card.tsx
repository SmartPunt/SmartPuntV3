import { Badge, Panel } from "@/components/ui";
import type { ResearchSnapshotStatistics } from "@/lib/research/actions";

function Statistic({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-zinc-950">
        {value.toLocaleString("en-AU")}
      </p>

      <p className="mt-2 text-sm text-zinc-500">
        {description}
      </p>
    </div>
  );
}

export default function WarehouseStatisticsCard({
  statistics,
}: {
  statistics: ResearchSnapshotStatistics;
}) {
  return (
    <Panel className="h-full bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Warehouse Statistics
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Immutable research records currently stored by SmartPunt.
            </p>
          </div>

          <Badge tone="blue">Warehouse</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Statistic
            label="Classification snapshots"
            value={statistics.classificationSnapshotCount}
            description="Race-level research classifications stored."
          />

          <Statistic
            label="Prediction snapshots"
            value={statistics.predictionRunnerSnapshotCount}
            description="Runner-level predictions stored."
          />

          <Statistic
            label="Captured races"
            value={statistics.capturedRaceCount}
            description="Unique races represented in the warehouse."
          />

          <Statistic
            label="Captured runners"
            value={statistics.capturedRunnerCount}
            description="Unique runners represented in prediction evidence."
          />

          <Statistic
            label="Classification batches"
            value={statistics.classificationBatchCount}
            description="Linked race classification batches."
          />

          <Statistic
            label="Prediction batches"
            value={statistics.predictionBatchCount}
            description="Linked runner prediction batches."
          />
        </div>

        {(statistics.legacyClassificationCount > 0 ||
          statistics.legacyPredictionRunnerCount > 0) ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-amber-950">
                  Legacy warehouse records
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  These records were captured before shared batch IDs were
                  introduced.
                </p>
              </div>

              <Badge tone="amber">
                {(
                  statistics.legacyClassificationCount +
                  statistics.legacyPredictionRunnerCount
                ).toLocaleString("en-AU")}{" "}
                legacy rows
              </Badge>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
