import { DashboardShell } from "@/components/dashboard/dashboard-components";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditType } from "@/lib/audit-types";

export function KpiSectionSkeleton({ title }: { title: string }) {
  return (
    <section aria-busy="true" aria-label={`Loading ${title}`} className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card className="min-h-[168px] border-tint/10 bg-surface shadow-none" key={index}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </section>
  );
}

// Loading state of a KPI page (its loading.tsx).
export function KpiPageSkeleton({ auditType, title }: { auditType: AuditType; title: string }) {
  return (
    <DashboardShell auditType={auditType}>
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
        <KpiSectionSkeleton title={title} />
      </main>
    </DashboardShell>
  );
}
