import Link from "next/link";
import { Badge, Panel } from "@/components/ui";

type ResearchModule = {
  title: string;
  icon: string;
  description: string;
  status: "ready" | "coming-soon";
  href?: string;
};

const modules: ResearchModule[] = [
  {
    title: "Performance Analytics",
    icon: "📊",
    description:
      "Calculator strike rates, confidence calibration, Power Rating performance and scoring audits.",
    status: "ready",
    href: "/admin/calculator-report",
  },
  {
    title: "Archetype Explorer",
    icon: "🧬",
    description:
      "Analyse performance by race class, distance, field size, track condition and race complexity.",
    status: "coming-soon",
  },
  {
    title: "Evidence Engine",
    icon: "🧠",
    description:
      "Turn immutable warehouse snapshots into statistical evidence and research findings.",
    status: "coming-soon",
  },
  {
    title: "Model Development",
    icon: "⚙️",
    description:
      "Compare scoring versions and evaluate proposed model changes without touching production.",
    status: "coming-soon",
  },
  {
    title: "Component Laboratory",
    icon: "🔬",
    description:
      "Investigate form, distance, track, condition, barrier, weight, jockey and trainer signals.",
    status: "coming-soon",
  },
  {
    title: "Snapshot Explorer",
    icon: "📦",
    description:
      "Inspect individual snapshot batches, runner predictions and warehouse integrity.",
    status: "coming-soon",
  },
];

function ModuleCard({
  module,
}: {
  module: ResearchModule;
}) {
  const content = (
    <div
      className={`h-full rounded-[24px] border p-5 transition ${
        module.status === "ready"
          ? "border-amber-300/40 bg-gradient-to-br from-zinc-950 to-black text-white hover:-translate-y-0.5 hover:border-amber-300/70 hover:shadow-xl"
          : "border-zinc-200 bg-zinc-50 text-zinc-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-current/10 bg-white/5 text-2xl">
          {module.icon}
        </div>

        <Badge
          tone={
            module.status === "ready"
              ? "green"
              : "slate"
          }
        >
          {module.status === "ready"
            ? "Ready"
            : "Coming Soon"}
        </Badge>
      </div>

      <h3 className="mt-5 text-lg font-bold">
        {module.title}
      </h3>

      <p
        className={`mt-2 text-sm leading-6 ${
          module.status === "ready"
            ? "text-zinc-300"
            : "text-zinc-500"
        }`}
      >
        {module.description}
      </p>

      <p
        className={`mt-5 text-sm font-semibold ${
          module.status === "ready"
            ? "text-amber-300"
            : "text-zinc-400"
        }`}
      >
        {module.status === "ready"
          ? "Open module →"
          : "Research module planned"}
      </p>
    </div>
  );

  if (module.href) {
    return (
      <Link href={module.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

export default function ResearchModules() {
  return (
    <Panel className="bg-white/95">
      <div className="p-6 text-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Research Modules
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              SmartPunt&apos;s controlled environment for evidence and model
              development.
            </p>
          </div>

          <Badge tone="amber">Intelligence Platform</Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.title}
              module={module}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
