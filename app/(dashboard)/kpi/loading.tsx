import { DashboardShell } from "@/components/dashboard/dashboard-components";
import { KpiSectionSkeleton } from "@/components/kpi/kpi-section-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClinicalKpiLoading() {
  return (
    <DashboardShell auditType="clinical">
      <header className="border-b border-tint/10 bg-panel/95">
        <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>
      </header>
      <main className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
        <KpiSectionSkeleton title="Clinical KPIs" />
      </main>
    </DashboardShell>
  );
}
