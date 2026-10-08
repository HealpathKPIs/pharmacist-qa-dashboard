import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  DashboardHeader,
  DashboardShell,
} from "@/components/dashboard/dashboard-components";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "@/components/dashboard/dashboard-filters";
import { KpiSectionSkeleton } from "@/components/kpi/kpi-section-skeleton";
import type {
  KpiActorOptionsOverride,
  KpiFilters,
  KpiSection,
} from "@/components/kpi/kpi-types";
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import { requireModuleAccess } from "@/lib/auth-server";
import { getErrorsByPharmacist } from "@/lib/dashboard-queries";

export type SearchParams = Record<string, string | string[] | undefined>;

function getSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Same pharmacist (or agent) list as the module dashboard filter for the same dates.
async function getActorOptions(auditType: AuditType, filters: KpiFilters) {
  try {
    const rows = await getErrorsByPharmacist({
      auditType,
      endDate: filters.endDate,
      startDate: filters.startDate,
    });

    return rows.map((row) => row.pharmacistName);
  } catch {
    // Each KPI section reports its own loading errors.
    return [];
  }
}

// A module's KPI page: one filter bar and the module's KPI sections, each
// loading on its own. Read-only, like the module dashboard.
export async function KpiPage({
  auditType,
  description,
  getActorOptionsOverride,
  pathname,
  searchParams,
  sections,
  title,
}: {
  auditType: AuditType;
  description: string;
  // When it returns a list, the pharmacist filter offers only those names and
  // a selected pharmacist outside it is cleared (redirect to pathname).
  getActorOptionsOverride?: KpiActorOptionsOverride;
  pathname?: string;
  searchParams?: Promise<SearchParams>;
  sections: readonly KpiSection[];
  title: string;
}) {
  await requireModuleAccess(auditType);
  const resolvedSearchParams = (await searchParams) ?? {};
  const filterValues: DashboardFilterValues = {
    endDate: getSearchValue(resolvedSearchParams, "endDate"),
    issueType: "",
    pharmacistName: getSearchValue(resolvedSearchParams, "pharmacistName"),
    startDate: getSearchValue(resolvedSearchParams, "startDate"),
  };
  const filters: KpiFilters = {
    endDate: filterValues.endDate || undefined,
    pharmacistCleared: getSearchValue(resolvedSearchParams, "pharmacistCleared") || undefined,
    pharmacistName: filterValues.pharmacistName || undefined,
    startDate: filterValues.startDate || undefined,
    taskType: getSearchValue(resolvedSearchParams, "taskType") || undefined,
  };
  const overrideOptions = getActorOptionsOverride
    ? await getActorOptionsOverride(filters).catch(() => null)
    : null;

  if (
    overrideOptions &&
    pathname &&
    filters.pharmacistName &&
    !overrideOptions.includes(filters.pharmacistName)
  ) {
    const nextParams = new URLSearchParams();

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      const first = Array.isArray(value) ? value[0] : value;

      if (first && key !== "pharmacistName" && key !== "pharmacistCleared") {
        nextParams.set(key, first);
      }
    }

    nextParams.set("pharmacistCleared", filters.pharmacistName);
    redirect(`${pathname}?${nextParams}`);
  }

  const actorOptions = overrideOptions ?? (await getActorOptions(auditType, filters));

  return (
    <DashboardShell auditType={auditType}>
      <DashboardHeader
        auditType={auditType}
        description={description}
        eyebrow={getAuditModule(auditType).moduleLabel}
        title={title}
      >
        <DashboardFilters
          auditType={auditType}
          filters={filterValues}
          issueOptions={[]}
          pharmacistOptions={actorOptions}
          showIssueFilter={false}
        />
      </DashboardHeader>
      <main className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
        {sections.map(({ Component, id, title: sectionTitle }) => (
          <div id={id} key={id}>
            <Suspense fallback={<KpiSectionSkeleton title={sectionTitle} />}>
              <Component filters={filters} />
            </Suspense>
          </div>
        ))}
      </main>
    </DashboardShell>
  );
}
