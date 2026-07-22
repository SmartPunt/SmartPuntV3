import { redirect } from "next/navigation";
import { Badge, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getResearchBatch } from "@/lib/research/actions";
import SnapshotExplorerHeader from "../../components/snapshot-explorer-header";
import SnapshotRunnerTable from "../../components/snapshot-runner-table";

export const dynamic = "force-dynamic";

export default async function SnapshotExplorerPage({
  params,
}: {
  params:
    | Promise<{ batchId: string }>
    | { batchId: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    redirect("/");
  }

  const resolvedParams = await params;
  const batchId = decodeURIComponent(
    String(resolvedParams.batchId || ""),
  ).trim();

  if (!batchId) {
    redirect("/admin/intelligence-platform");
  }

  const details = await getResearchBatch(batchId);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <SnapshotExplorerHeader details={details} />

        {details.warnings.length > 0 ? (
          <div className="mt-6">
            <Panel className="bg-white/95">
              <div className="p-5 text-zinc-950 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      Snapshot Warnings
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      Integrity checks relating specifically to this batch.
                    </p>
                  </div>

                  <Badge tone="amber">
                    {details.warnings.length} warning
                    {details.warnings.length === 1
                      ? ""
                      : "s"}
                  </Badge>
                </div>

                <div className="mt-5 space-y-3">
                  {details.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-amber-600">
                          ▲
                        </span>

                        <p className="text-sm leading-6 text-amber-950">
                          {warning}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        ) : (
          <div className="mt-6">
            <Panel className="bg-white/95">
              <div className="flex items-start gap-3 p-5 text-zinc-950 sm:p-6">
                <span className="text-2xl text-emerald-600">
                  ✓
                </span>

                <div>
                  <p className="font-bold text-emerald-950">
                    Snapshot integrity checks passed
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    The classification snapshot and captured runner count
                    agree for this research batch.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        )}

        <div className="mt-6">
          <SnapshotRunnerTable
            runners={details.predictionSnapshots}
          />
        </div>
      </div>
    </div>
  );
}
