import { Badge, Panel } from "@/components/ui";
import type {
  ResearchPredictionRunnerSnapshot,
} from "@/lib/research/actions";

function formatNumber(
  value: number | null | undefined,
  digits = 1,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(digits);
}

function rankTone(rank?: number | null) {
  if (rank === 1) return "amber";
  if (rank === 2) return "blue";
  if (rank === 3) return "green";

  return "slate";
}

export default function SnapshotRunnerTable({
  runners,
}: {
  runners: ResearchPredictionRunnerSnapshot[];
}) {
  const orderedRunners = [...runners].sort(
    (a, b) =>
      Number(a.predicted_rank || 9999) -
      Number(b.predicted_rank || 9999),
  );

  return (
    <Panel className="bg-white/95">
      <div className="p-5 text-zinc-950 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Captured Runner Predictions
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Original predicted order stored for this immutable batch.
            </p>
          </div>

          <Badge tone="blue">
            {orderedRunners.length} runners
          </Badge>
        </div>

        {orderedRunners.length > 0 ? (
          <>
            <div className="mt-5 space-y-3 md:hidden">
              {orderedRunners.map((runner) => (
                <div
                  key={runner.id}
                  className={`rounded-[22px] border p-4 ${
                    runner.smartpunt_tip
                      ? "border-amber-300 bg-amber-50"
                      : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge tone={rankTone(runner.predicted_rank)}>
                        #{runner.predicted_rank || "—"}
                      </Badge>

                      <div>
                        <p className="font-bold text-zinc-950">
                          Runner #{runner.runner_id}
                        </p>

                        <p className="mt-0.5 text-xs text-zinc-500">
                          Horse ID {runner.horse_id || "—"}
                        </p>
                      </div>
                    </div>

                    {runner.smartpunt_tip ? (
                      <Badge tone="amber">
                        {runner.smartpunt_tip_type ||
                          "SmartPunt Tip"}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Score
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {formatNumber(runner.score, 2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Race gap
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {formatNumber(runner.race_gap, 2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Win %
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {formatNumber(runner.win_percent)}%
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Place %
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {formatNumber(runner.place_percent)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
                    <th className="py-3 pr-4">Rank</th>
                    <th className="py-3 pr-4">Runner</th>
                    <th className="py-3 pr-4">Horse ID</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Win %</th>
                    <th className="py-3 pr-4">Place %</th>
                    <th className="py-3 pr-4">Race Gap</th>
                    <th className="py-3 pr-4">SmartPunt Tip</th>
                  </tr>
                </thead>

                <tbody>
                  {orderedRunners.map((runner) => (
                    <tr
                      key={runner.id}
                      className={`border-b last:border-0 ${
                        runner.smartpunt_tip
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-100"
                      }`}
                    >
                      <td className="py-4 pr-4">
                        <Badge
                          tone={rankTone(
                            runner.predicted_rank,
                          )}
                        >
                          #{runner.predicted_rank || "—"}
                        </Badge>
                      </td>

                      <td className="py-4 pr-4 font-semibold text-zinc-950">
                        #{runner.runner_id}
                      </td>

                      <td className="py-4 pr-4 text-zinc-600">
                        {runner.horse_id || "—"}
                      </td>

                      <td className="py-4 pr-4 font-semibold text-zinc-950">
                        {formatNumber(runner.score, 2)}
                      </td>

                      <td className="py-4 pr-4">
                        {formatNumber(runner.win_percent)}%
                      </td>

                      <td className="py-4 pr-4">
                        {formatNumber(runner.place_percent)}%
                      </td>

                      <td className="py-4 pr-4">
                        {formatNumber(runner.race_gap, 2)}
                      </td>

                      <td className="py-4 pr-4">
                        {runner.smartpunt_tip ? (
                          <Badge tone="amber">
                            {runner.smartpunt_tip_type ||
                              "Tip"}
                          </Badge>
                        ) : (
                          <span className="text-zinc-400">
                            —
                          </span>
                        )}
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
              No runner prediction snapshots found.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              This batch does not currently contain captured runner
              predictions.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
