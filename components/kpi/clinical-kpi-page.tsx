import { CLINICAL_KPI_SECTIONS } from "@/components/kpi/clinical-kpi-sections";
import { KpiPage, type SearchParams } from "@/components/kpi/kpi-page";
import type { KpiFilters } from "@/components/kpi/kpi-types";
import { getProcessingTimePharmacists } from "@/lib/processing-time-queries";

// While a Processing Time task type is selected, the pharmacist filter offers
// only active pharmacists with rows of that type in the selected dates.
async function getTaskTypePharmacists(filters: KpiFilters) {
  return filters.taskType
    ? getProcessingTimePharmacists({
        endDate: filters.endDate,
        startDate: filters.startDate,
        taskType: filters.taskType,
      })
    : null;
}

export function ClinicalKpiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <KpiPage
      auditType="clinical"
      description="Monthly key performance indicators for Clinical QA pharmacists. The filters apply to every KPI on this page."
      getActorOptionsOverride={getTaskTypePharmacists}
      pathname="/kpi"
      searchParams={searchParams}
      sections={CLINICAL_KPI_SECTIONS}
      title="Clinical KPIs"
    />
  );
}
