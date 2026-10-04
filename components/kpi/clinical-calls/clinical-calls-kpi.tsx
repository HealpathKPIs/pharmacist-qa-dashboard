import { ClinicalCallsSection } from "@/components/kpi/clinical-calls/clinical-calls-section";
import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { getClinicalCallsKpi } from "@/lib/clinical-calls-queries";

// Clinical Calls KPI. Data and formula live in lib/clinical-calls-queries.ts
// and lib/clinical-calls.ts. The loader never throws; a failure is shown inside
// this section only.
export async function ClinicalCallsKpi({ filters }: KpiSectionProps) {
  return <ClinicalCallsSection result={await getClinicalCallsKpi(filters)} />;
}
