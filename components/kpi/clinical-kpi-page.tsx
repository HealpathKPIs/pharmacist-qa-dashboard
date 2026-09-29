import { CLINICAL_KPI_SECTIONS } from "@/components/kpi/clinical-kpi-sections";
import { KpiPage, type SearchParams } from "@/components/kpi/kpi-page";

export function ClinicalKpiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <KpiPage
      auditType="clinical"
      description="Monthly key performance indicators for Clinical QA pharmacists. The filters apply to every KPI on this page."
      searchParams={searchParams}
      sections={CLINICAL_KPI_SECTIONS}
      title="Clinical KPIs"
    />
  );
}
