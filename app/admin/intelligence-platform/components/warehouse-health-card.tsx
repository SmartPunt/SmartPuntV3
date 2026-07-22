import { Badge, Panel } from "@/components/ui";
import type { ResearchWarehouseHealth } from "@/lib/research/actions";

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortBatchId(value?: string | null) {
  if (!value) return "—";

  return value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
}

export default function WarehouseHealthCard({
  health,
}: {
  health: ResearchWarehouseHealth;
}) {
  const statusLabel =
    health.status === "healthy"
      ? "Healthy"
      : health.status === "warning"
        ? "Warning"
        : "Empty";

  const statusTone =
    health.status === "healthy"
      ? "green"
      : health.status === "warning"
        ? "amber"
        : "slate";

  const statusIcon =
    health.status === "healthy"
      ? "●"
      : health.status === "warning"
        ? "▲"
        : "○";

  return (
    <Panel className="h-full bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Warehouse Health
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span
                className={`text-3xl ${
                  health.status === "healthy"
                    ? "text-emerald-500"
                    : health.status === "warning"
                      ? "text-amber-500"
                      : "text-zinc-400"
                }`}
              >
                {statusIcon}
              </span>

              <p className="text-3xl font-bold">{statusLabel}</p>
            </div>
          </div>

          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Batch integrity
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-zinc-950">
                Classification and prediction
              </p>

              <Badge tone={health.latestBatchIdsMatch ? "green" : "rose"}>
                {health.latestBatchIdsMatch ? "Matched" : "Mismatch"}
              </Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Latest classification
            </p>

            <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
              {shortBatchId(health.latestClassificationBatchId)}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {formatDateTime(
                health.latestClassificationSnapshotAt,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Latest predictions
            </p>

            <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
              {shortBatchId(health.latestPredictionBatchId)}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {formatDateTime(
                health.latestPredictionSnapshotAt,
              )}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
