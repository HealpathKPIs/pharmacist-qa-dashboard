import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { QualityDeductionScore } from "@/components/kpi/quality-deduction/quality-deduction-score";
import { buildQualityDeductionTeamTrend } from "@/lib/quality-deduction";
import {
  getNonMedicalQualityDeduction,
  getQualityDeduction,
} from "@/lib/quality-deduction-queries";

// Quality Deduction Score KPI. Formula: lib/quality-deduction.ts. The loaders
// never throw; a failure is shown inside this section only.
export async function QualityDeductionKpi({ filters }: KpiSectionProps) {
  return <QualityDeductionScore auditType="clinical" result={await getQualityDeduction(filters)} />;
}

// Non-Medical: the same section on the derived severity scores. The trend's
// team line stays team-wide when an agent is selected: it comes from the same
// dates without the agent filter (the same cached load when none is selected).
export async function NonMedicalQualityDeductionKpi({ filters }: KpiSectionProps) {
  const [result, teamResult] = await Promise.all([
    getNonMedicalQualityDeduction(filters),
    getNonMedicalQualityDeduction({ ...filters, pharmacistName: undefined }),
  ]);

  return (
    <QualityDeductionScore
      auditType="non_medical"
      result={result}
      teamTrend={
        teamResult.error === null ? buildQualityDeductionTeamTrend(teamResult.data) : null
      }
    />
  );
}
