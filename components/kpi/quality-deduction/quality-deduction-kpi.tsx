import type { ClinicalKpiSectionProps } from "@/components/kpi/clinical-kpi-types";
import { QualityDeductionScore } from "@/components/kpi/quality-deduction/quality-deduction-score";
import { getQualityDeduction } from "@/lib/quality-deduction-queries";

// Quality Deduction Score KPI. Formula: lib/quality-deduction.ts. The loader
// never throws; a failure is shown inside this section only.
export async function QualityDeductionKpi({ filters }: ClinicalKpiSectionProps) {
  return <QualityDeductionScore result={await getQualityDeduction(filters)} />;
}
