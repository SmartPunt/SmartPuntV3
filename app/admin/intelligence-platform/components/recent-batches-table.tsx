import Link from "next/link";
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
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortBatchId(value: string) {
  return value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
}

function snapshotHref(snapshotBatchId: string) {
  return `/admin/intelligence-platform/snapshots/${encodeURIComponent(
    snapshotBatchId,
  )}`;
}

export default function RecentBatchesTable({
  batches,
}: {
  batches: ResearchBatchSummary[];
}) {
  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Recent Snapshot Batches
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              The latest race-level research captures stored in the warehouse.
            </p>
          </div>

          <Badge tone="blue">{batches.length} batches</Badge>
        </div>

        {batches.length > 0 ? (
          <>
            <div className="mt-5 space-y-3 md:hidden">
              {batches.map((batch) => (
                <Link
                  key={batch.snapshotBatchId}
                  href={snapshotHref(batch.snapshotBatchId)}
                  className="block rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-zinc-950">
                        {batch.meetingName || "Unknown"}{" "}
                        {batch.raceNumber
                          ? `R${batch.raceNumber}`
                          : ""}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {batch.raceName || "Unnamed race"}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-amber-700">
                      Open →
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="blue">
                      {batch.activeRunnerCount} runners
                    </Badge>

                    <Badge tone="amber">
                      {batch.raceConfidenceTier ||
                        "Unknown"}
                    </Badge>

                    <Badge tone="green">
                      {batch.raceConfidencePercent}%
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs text-zinc-500">
                    Captured {formatDateTime(batch.snapshotAt)}
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <th className="py-3 pr-4">Captured</th>
                    <th className="py-3 pr-4">Meeting</th>
                    <th className="py-3 pr-4">Race</th>
                    <th className="py-3 pr-4">Runners</th>
                    <th className="py-3 pr-4">Confidence</th>
                    <th className="py-3 pr-4">Scoring</th>
                    <th className="py-3 pr-4">Batch</th>
                    <th className="py-3 text-right">Explorer</th>
                  </tr>
                </thead>

                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.snapshotBatchId}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="py-4 pr-4 text-zinc-600">
                        {formatDateTime(batch.snapshotAt)}
                      </td>

                      <td className="py-4 pr-4 font-semibold text-zinc-950">
                        {batch.meetingName || "Unknown"}
                      </td>

                      <td className="py-4 pr-4">
                        <p className="font-semibold text-zinc-950">
                          {batch.raceNumber
                            ? `R${batch.raceNumber}`
                            : "Race"}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {batch.raceName ||
                            "Unnamed race"}
                        </p>
                      </td>

                      <td className="py-4 pr-4">
                        <Badge tone="blue">
                          {batch.activeRunnerCount}
                        </Badge>
                      </td>

                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="amber">
                            {batch.raceConfidenceTier ||
                              "Unknown"}
                          </Badge>

                          <Badge tone="green">
                            {batch.raceConfidencePercent}%
                          </Badge>
                        </div>
                      </td>

                      <td className="py-4 pr-4 font-mono text-xs text-zinc-600">
                        {batch.scoringVersion || "—"}
                      </td>

                      <td className="py-4 pr-4 font-mono text-xs text-zinc-600">
                        {shortBatchId(
                          batch.snapshotBatchId,
                        )}
                      </td>

                      <td className="py-4 text-right">
                        <Link
                          href={snapshotHref(
                            batch.snapshotBatchId,
                          )}
                          className="inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-500 hover:text-zinc-950"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="font-semibold text-zinc-950">
              No research batches found.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              New settlement snapshots will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
