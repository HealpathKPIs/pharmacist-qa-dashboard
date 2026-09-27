import { Suspense } from "react";

import {
  DashboardHeader,
  DashboardShell,
} from "@/components/dashboard/dashboard-components";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "@/components/dashboard/dashboard-filters";
import { CLINICAL_KPI_SECTIONS } from "@/components/kpi/clinical-kpi-sections";
import type { ClinicalKpiFilters } from "@/components/kpi/clinical-kpi-types";
import { KpiSectionSkeleton } from "@/components/kpi/kpi-section-skeleton";
import { requireModuleAccess } from "@/lib/auth-server";
import { getErrorsByPharmacist } from "@/lib/dashboard-queries";

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Same pharmacist list as the Clinical dashboard filter for the same dates.
async function getPharmacistOptions(filters: ClinicalKpiFilters) {
  try {
    const rows = await getErrorsByPharmacist({
      auditType: "clinical",
      endDate: filters.endDate,
      startDate: filters.startDate,
    });

    return rows.map((row) => row.pharmacistName);
  } catch {
    // Each KPI section reports its own loading errors.
    return [];
  }
}

export async function ClinicalKpiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireModuleAccess("clinical");
  const resolvedSearchParams = (await searchParams) ?? {};
  const filterValues: DashboardFilterValues = {
    endDate: getSearchValue(resolvedSearchParams, "endDate"),
    issueType: "",
    pharmacistName: getSearchValue(resolvedSearchParams, "pharmacistName"),
    startDate: getSearchValue(resolvedSearchParams, "startDate"),
  };
  const filters: ClinicalKpiFilters = {
    endDate: filterValues.endDate || undefined,
    pharmacistName: filterValues.pharmacistName || undefined,
    startDate: filterValues.startDate || undefined,
  };
  const pharmacistOptions = await getPharmacistOptions(filters);

  return (
    <DashboardShell auditType="clinical">
      <DashboardHeader
        auditType="clinical"
        description="Monthly key performance indicators for Clinical QA pharmacists. The filters apply to every KPI on this page."
        eyebrow="Clinical QA"
        title="Clinical KPIs"
      >
        <DashboardFilters
          auditType="clinical"
          filters={filterValues}
          issueOptions={[]}
          pharmacistOptions={pharmacistOptions}
          showIssueFilter={false}
        />
      </DashboardHeader>
      <main className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
        {CLINICAL_KPI_SECTIONS.map(({ Component, id, title }) => (
          <div id={id} key={id}>
            <Suspense fallback={<KpiSectionSkeleton title={title} />}>
              <Component filters={filters} />
            </Suspense>
          </div>
        ))}
      </main>
    </DashboardShell>
  );
}
