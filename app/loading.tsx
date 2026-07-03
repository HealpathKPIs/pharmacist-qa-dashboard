import { DashboardShell } from "@/components/dashboard/dashboard-components";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <DashboardShell>
      <header className="border-b border-white/10 bg-[#0b0d0f]/95">
        <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>
      </header>
      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card className="border-white/10 bg-white/[0.04] shadow-none" key={index}>
              <CardContent className="space-y-4 p-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-4 w-36" />
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card
              className="border-white/10 bg-white/[0.04] shadow-none first:xl:col-span-2"
              key={index}
            >
              <CardHeader className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
