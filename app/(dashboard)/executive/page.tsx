import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PlatformShell } from "@/components/layout/platform-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AUDIT_MODULES, getAuditPath } from "@/lib/audit-types";
import { requireAdmin } from "@/lib/auth-server";
import { getDashboardTotals } from "@/lib/dashboard-queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function ExecutiveDashboardPage() {
  await requireAdmin();
  const modules = Object.values(AUDIT_MODULES);
  const totals = await Promise.all(
    modules.map((module) =>
      getDashboardTotals({ auditType: module.auditType }),
    ),
  );

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-emerald-300">Platform overview</p>
          <h1 className="text-3xl font-semibold tracking-normal text-white">
            Executive Dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            A consolidated view of quality activity across every QA module.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {modules.map((module, index) => {
            const moduleTotals = totals[index];

            return (
              <Card
                className="border-white/10 bg-white/[0.04] shadow-none"
                key={module.auditType}
              >
                <CardHeader>
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                    <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-white">{module.moduleLabel}</CardTitle>
                  <CardDescription>{module.dashboardTitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-zinc-500">
                        {module.workloadLabel}
                      </p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-white">
                        {formatInteger(moduleTotals.totalPatients)}
                      </p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-zinc-500">QA Errors</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-white">
                        {formatInteger(moduleTotals.totalQaErrors)}
                      </p>
                    </div>
                  </div>
                  <Link
                    className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                    href={getAuditPath(module.auditType)}
                  >
                    Open {module.moduleLabel}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </PlatformShell>
  );
}
