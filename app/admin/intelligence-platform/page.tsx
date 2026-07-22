import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getResearchDashboard } from "@/lib/research/actions";
import IntelligenceHeader from "./components/intelligence-header";
import WarehouseHealthCard from "./components/warehouse-health-card";
import WarehouseStatisticsCard from "./components/warehouse-statistics-card";
import LatestBatchCard from "./components/latest-batch-card";
import RecentBatchesTable from "./components/recent-batches-table";
import ResearchModules from "./components/research-modules";
import WarningsCard from "./components/warnings-card";

export const dynamic = "force-dynamic";

export default async function IntelligencePlatformPage() {
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

  const dashboard = await getResearchDashboard();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_25%),linear-gradient(180deg,#0a0a0a_0%,#18181b_50%,#020617_100%)] text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-8">
        <IntelligenceHeader
          capturedRaces={
            dashboard.statistics.capturedRaceCount
          }
          capturedRunners={
            dashboard.statistics.capturedRunnerCount
          }
          healthStatus={dashboard.health.status}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <WarehouseHealthCard
            health={dashboard.health}
          />

          <LatestBatchCard
            batch={dashboard.latestBatch}
          />
        </div>

        <div className="mt-6">
          <WarehouseStatisticsCard
            statistics={dashboard.statistics}
          />
        </div>

        <div className="mt-6">
          <ResearchModules />
        </div>

        <div className="mt-6">
          <RecentBatchesTable
            batches={dashboard.recentBatches}
          />
        </div>

        <div className="mt-6">
          <WarningsCard
            warnings={dashboard.health.warnings}
          />
        </div>
      </div>
    </div>
  );
}
