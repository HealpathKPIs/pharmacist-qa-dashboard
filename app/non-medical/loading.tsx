import { DashboardShell } from "@/components/dashboard/dashboard-components";
import { Skeleton } from "@/components/ui/skeleton";

export default function NonMedicalDashboardLoading() {
  return (
    <DashboardShell auditType="non_medical">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-36" key={index} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-44" key={index} />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </DashboardShell>
  );
}
