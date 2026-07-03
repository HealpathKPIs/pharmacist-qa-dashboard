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
      <main className="space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-7 w-56" />
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card className="min-h-[184px] border-white/10 bg-white/[0.04] shadow-none" key={index}>
                <CardContent className="flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                    <Skeleton className="h-11 w-11 rounded-lg" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card className="min-h-[178px] border-white/10 bg-white/[0.04] shadow-none" key={index}>
                <CardContent className="flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-6 w-36" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-lg" />
                  </div>
                  <Skeleton className="h-14 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card className="min-h-[226px] border-white/10 bg-white/[0.04] shadow-none" key={index}>
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-14 w-full" />
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
