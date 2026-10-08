import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { ProcessingTimeSection } from "@/components/kpi/processing-time/processing-time-section";
import { getProcessingTimeKpi } from "@/lib/processing-time-queries";

// Processing Time KPI. Data and formula live in lib/processing-time-queries.ts
// and lib/processing-time.ts. The loader never throws; a failure is shown inside
// this section only.
export async function ProcessingTimeKpi({ filters }: KpiSectionProps) {
  return (
    <ProcessingTimeSection
      pharmacistCleared={filters.pharmacistName ? null : (filters.pharmacistCleared ?? null)}
      result={await getProcessingTimeKpi(filters)}
    />
  );
}
