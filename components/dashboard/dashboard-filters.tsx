"use client";

import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import { cn } from "@/lib/utils";

export type DashboardFilterValues = {
  startDate: string;
  endDate: string;
  pharmacistName: string;
  issueType: string;
};

export function DashboardFilters({
  auditType,
  filters,
  issueOptions,
  pharmacistOptions,
}: {
  auditType: AuditType;
  filters: DashboardFilterValues;
  issueOptions: string[];
  pharmacistOptions: string[];
}) {
  const moduleConfig = getAuditModule(auditType);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateFilter(key: keyof DashboardFilterValues, value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }

    startTransition(() => {
      router.push(nextParams.size > 0 ? `${pathname}?${nextParams}` : pathname);
    });
  }

  function refreshDashboard() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-normal text-zinc-500">
          Start Date
        </span>
        <Input
          className="border-white/10 bg-black/30 text-white"
          onChange={(event) => updateFilter("startDate", event.target.value)}
          type="date"
          value={filters.startDate}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-normal text-zinc-500">
          End Date
        </span>
        <Input
          className="border-white/10 bg-black/30 text-white"
          onChange={(event) => updateFilter("endDate", event.target.value)}
          type="date"
          value={filters.endDate}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-normal text-zinc-500">
          {moduleConfig.actorLabel}
        </span>
        <select
          className="flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => updateFilter("pharmacistName", event.target.value)}
          value={filters.pharmacistName}
        >
          <option value="">All {moduleConfig.actorLabelPlural.toLowerCase()}</option>
          {pharmacistOptions.map((pharmacistName) => (
            <option key={pharmacistName} value={pharmacistName}>
              {pharmacistName}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-normal text-zinc-500">
          Issue
        </span>
        <select
          className="flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => updateFilter("issueType", event.target.value)}
          value={filters.issueType}
        >
          <option value="">All issues</option>
          {issueOptions.map((issueType) => (
            <option key={issueType} value={issueType}>
              {issueType}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <Button
          className={cn(
            "w-full border-white/10 bg-white/5 text-white hover:bg-white/10 lg:w-auto",
            isPending && "opacity-70",
          )}
          onClick={refreshDashboard}
          type="button"
          variant="outline"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("h-4 w-4", isPending && "animate-spin")}
          />
          Refresh
        </Button>
      </div>
    </div>
  );
}
