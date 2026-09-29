import { KpiPage, type SearchParams } from "@/components/kpi/kpi-page";
import { NON_MEDICAL_KPI_SECTIONS } from "@/components/kpi/non-medical-kpi-sections";

export function NonMedicalKpiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <KpiPage
      auditType="non_medical"
      description="Monthly key performance indicators for Non-Medical QA agents. The filters apply to every KPI on this page."
      searchParams={searchParams}
      sections={NON_MEDICAL_KPI_SECTIONS}
      title="Non-Medical KPIs"
    />
  );
}
