import { Badge, Panel } from "@/components/ui";

export default function WarningsCard({
  warnings,
}: {
  warnings: string[];
}) {
  const hasWarnings = warnings.length > 0;

  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              System Warnings
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Automated warehouse integrity and snapshot health checks.
            </p>
          </div>

          <Badge tone={hasWarnings ? "amber" : "green"}>
            {hasWarnings
              ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
              : "All clear"}
          </Badge>
        </div>

        {hasWarnings ? (
          <div className="mt-5 space-y-3">
            {warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg text-amber-600">
                    ▲
                  </span>

                  <p className="text-sm leading-6 text-amber-900">
                    {warning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl text-emerald-600">
                ✓
              </span>

              <div>
                <p className="font-bold text-emerald-950">
                  Warehouse integrity checks passed
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Classification and prediction snapshots are present and the
                  latest batch identifiers match.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
