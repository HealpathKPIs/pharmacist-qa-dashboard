import { OverallSection } from "@/components/kpi/overall/overall-section";
import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { buildOverallTable } from "@/lib/overall-kpi";
import { getNonMedicalQualityDeduction } from "@/lib/quality-deduction-queries";

// Overall KPI (Non-Medical): 60% QA error count + 40% quality, ranked within
// the team. Formula: lib/overall-kpi.ts.
//
// The ranking, the cards and the trend's average line always use the whole
// team: they come from the same dates without the agent filter (the same
// cached load when no agent is selected). The Agent filter only narrows the
// table rows. Only scores are sent to the page, not QA error records.
export async function NonMedicalOverallKpi({ filters }: KpiSectionProps) {
  const [result, teamResult] = await Promise.all([
    getNonMedicalQualityDeduction(filters),
    getNonMedicalQualityDeduction({ ...filters, pharmacistName: undefined }),
  ]);

  if (teamResult.error !== null || result.error !== null) {
    return (
      <OverallSection
        result={{ data: null, error: teamResult.error ?? result.error ?? "Unknown error." }}
      />
    );
  }

  return (
    <OverallSection
      result={{
        data: {
          agents: result.data.pharmacists,
          endDate: result.data.endDate,
          pharmacistName: result.data.pharmacistName,
          startDate: result.data.startDate,
          table: buildOverallTable(teamResult.data),
        },
        error: null,
      }}
    />
  );
}
