import Link from "next/link";
import { Badge } from "@/components/ui";

export default function IntelligenceHeader({
  capturedRaces,
  capturedRunners,
  healthStatus,
}: {
  capturedRaces: number;
  capturedRunners: number;
  healthStatus: "healthy" | "warning" | "empty";
}) {
  const healthLabel =
    healthStatus === "healthy"
      ? "Warehouse Healthy"
      : healthStatus === "warning"
        ? "Warehouse Warning"
        : "Warehouse Empty";

  const healthTone =
    healthStatus === "healthy"
      ? "green"
      : healthStatus === "warning"
        ? "amber"
        : "slate";

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
      <img
        src="/header-logo.png"
        alt="Fortune on 5"
        className="pointer-events-none absolute left-1/2 top-[42%] w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-90 sm:w-[420px] lg:w-[900px]"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.30)_0%,rgba(0,0,0,0.10)_30%,rgba(0,0,0,0.68)_100%)]" />

      <div className="relative z-10 flex min-h-[250px] flex-col justify-between p-4 lg:min-h-[310px] lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge tone="amber">SmartPunt Intelligence Platform</Badge>

          <div className="ml-auto flex flex-wrap gap-2">
            <Link
              href="/admin/calculator-report"
              className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Performance Report
            </Link>

            <Link
              href="/"
              className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-white/5 bg-black/30 px-4 py-5 backdrop-blur-[2px] lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/10 text-3xl shadow-[0_0_30px_rgba(251,191,36,0.12)]">
              🧠
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                SmartPunt Intelligence Platform
              </h1>

              <p className="mt-1 text-sm text-zinc-200 lg:text-base">
                Research • Evidence • Model Development
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
            SmartPunt&apos;s read-only research environment for immutable race
            evidence, prediction snapshots, warehouse health and controlled
            model development.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={healthTone}>{healthLabel}</Badge>
            <Badge tone="blue">{capturedRaces} captured races</Badge>
            <Badge tone="amber">{capturedRunners} captured runners</Badge>
            <Badge tone="slate">Research only</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
