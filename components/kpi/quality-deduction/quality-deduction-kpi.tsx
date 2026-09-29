import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { QualityDeductionScore } from "@/components/kpi/quality-deduction/quality-deduction-score";
import {
  getNonMedicalQualityDeduction,
  getQualityDeduction,
} from "@/lib/quality-deduction-queries";

// Quality Deduction Score KPI. Formula: lib/quality-deduction.ts. The loaders
// never throw; a failure is shown inside this section only.
export async function QualityDeductionKpi({ filters }: KpiSectionProps) {
  return <QualityDeductionScore auditType="clinical" result={await getQualityDeduction(filters)} />;
}

// Non-Medical: the same section on the derived severity scores.
export async function NonMedicalQualityDeductionKpi({ filters }: KpiSectionProps) {
  return (
    <QualityDeductionScore
      auditType="non_medical"
      result={await getNonMedicalQualityDeduction(filters)}
    />
  );
}
