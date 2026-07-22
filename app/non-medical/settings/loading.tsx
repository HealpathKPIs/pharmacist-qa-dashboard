import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function NonMedicalSettingsLoading() {
  return (
    <AppShell auditType="non_medical">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-80 w-full" />
      </main>
    </AppShell>
  );
}
