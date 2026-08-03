import { Badge, Panel } from "@/components/ui";
import type {
  ResearchEvidenceMix,
  ResearchRaceAnalysis,
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

function competitionTone(
  band:
    | ResearchRaceAnalysis["competition"]["competitionBand"]
    | undefined,
) {
  if (band === "Dominant") return "green";
  if (band === "Two-Horse") return "blue";
  if (band === "Competitive") return "amber";
  if (band === "Compressed") return "rose";
  if (band === "Wide-Open") return "rose";

  return "slate";
}

function EvidenceRow({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-950">
            {label}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {count} observation
            {count === 1 ? "" : "s"}
          </p>
        </div>

        <Badge tone={percent > 0 ? "blue" : "slate"}>
          {formatNumber(percent, 1)}%
        </Badge>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-zinc-950"
          style={{
            width: `${Math.min(
              Math.max(percent, 0),
              100,
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function EvidenceMixPanel({
  evidence,
}: {
  evidence: ResearchEvidenceMix;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            Evidence Mix
          </p>

          <h3 className="mt-2 text-xl font-bold text-zinc-950">
            Scoring evidence sources
          </h3>

          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Summary of the evidence sources selected inside the captured
            scoring audits.
          </p>
        </div>

        <Badge tone="blue">
          {evidence.observationCount} observations
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EvidenceRow
          label="SmartPunt History"
          count={evidence.smartpuntHistoryCount}
          percent={evidence.smartpuntHistoryPercent}
        />

        <EvidenceRow
          label="Stored Evidence"
          count={evidence.storedEvidenceCount}
          percent={evidence.storedEvidencePercent}
        />

        <EvidenceRow
          label="Imported Evidence"
          count={evidence.importedEvidenceCount}
          percent={evidence.importedEvidencePercent}
        />

        <EvidenceRow
          label="Neutral"
          count={evidence.neutralCount}
          percent={evidence.neutralPercent}
        />

        <EvidenceRow
          label="Fallback"
          count={evidence.fallbackCount}
          percent={evidence.fallbackPercent}
        />

        <EvidenceRow
          label="Unknown"
          count={evidence.unknownCount}
          percent={evidence.unknownPercent}
        />
      </div>
    </div>
  );
}

export default function ResearchRaceAnalysisCard({
  analysis,
}: {
  analysis: ResearchRaceAnalysis | null;
}) {
  if (!analysis) {
    return (
      <Panel className="bg-white/95">
        <div className="p-5 text-zinc-950 sm:p-6">
          <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="font-bold text-zinc-950">
              Research analysis unavailable
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              This snapshot batch does not currently contain enough runner
              prediction data to calculate the first research analysis.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const { competition, evidence } = analysis;

  return (
    <Panel className="bg-white/95">
      <div className="p-5 text-zinc-950 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
              Research Analysis
            </p>

            <h2 className="mt-2 text-2xl font-bold text-zinc-950">
              Race Intelligence V1
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
              Read-only analysis calculated from the immutable runner
              predictions and scoring-audit evidence captured for this batch.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              tone={competitionTone(
                competition.competitionBand,
              )}
            >
              {competition.competitionBand}
            </Badge>

            <Badge tone="slate">
              {analysis.analysisVersion}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                  Competition Fingerprint
                </p>

                <h3 className="mt-2 text-2xl font-bold text-zinc-950">
                  {competition.competitionBand}
                </h3>

                <p className="mt-1 text-sm text-zinc-600">
                  A higher competition index means the field is more tightly
                  grouped.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white px-5 py-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                  Competition Index
                </p>

                <p className="mt-1 text-4xl font-black text-zinc-950">
                  {formatNumber(
                    competition.competitionIndex,
                    1,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Top score
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.topScore,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Second score
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.secondScore,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Third score
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.thirdScore,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Top gap
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.topGap,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Top-three spread
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.topThreeSpread,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Field spread
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.fieldSpread,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Average score
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.averageScore,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Median score
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.medianScore,
                    2,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Standard deviation
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatNumber(
                    competition.scoreStandardDeviation,
                    2,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-sm text-zinc-700">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <span>
                  <strong>Runners:</strong>{" "}
                  {competition.runnerCount}
                </span>

                <span>
                  <strong>Second gap:</strong>{" "}
                  {formatNumber(
                    competition.secondGap,
                    2,
                  )}
                </span>

                <span>
                  <strong>Average adjacent gap:</strong>{" "}
                  {formatNumber(
                    competition.averageAdjacentGap,
                    2,
                  )}
                </span>

                <span>
                  <strong>Lowest score:</strong>{" "}
                  {formatNumber(
                    competition.lowestScore,
                    2,
                  )}
                </span>
              </div>
            </div>
          </div>

          <EvidenceMixPanel evidence={evidence} />
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-white">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Analysis version
              </p>

              <p className="mt-1 font-mono text-sm text-amber-300">
                {analysis.analysisVersion}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Scoring version
              </p>

              <p className="mt-1 font-mono text-sm text-white">
                {analysis.scoringVersion || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Classifier version
              </p>

              <p className="mt-1 font-mono text-sm text-white">
                {analysis.classifierVersion || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Analysis mode
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-300">
                Live read-only calculation
              </p>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
