import { ErrorCountSection } from "@/components/kpi/error-count/error-count-section";
import type { KpiSectionProps } from "@/components/kpi/kpi-types";
import { buildErrorCountTeamAverages } from "@/lib/error-count";
import { getNonMedicalQualityDeduction } from "@/lib/quality-deduction-queries";

// QA Error Count KPI (Non-Medical). It reads the same QA error rows as the
// Quality Deduction section, in the same request (the loader is cached), so the
// counts always match that table. Formula: lib/error-count.ts.
//
// The trend's comparison line is always team-wide: with an agent selected, the
// averages come from the same dates without the agent filter. Only the
// averages are sent to the page, not the team's rows.
export async function NonMedicalErrorCountKpi({ filters }: KpiSectionProps) {
  const [result, teamResult] = await Promise.all([
    getNonMedicalQualityDeduction(filters),
    getNonMedicalQualityDeduction({ ...filters, pharmacistName: undefined }),
  ]);

  return (
    <ErrorCountSection
      result={result}
      teamAverages={teamResult.error === null ? buildErrorCountTeamAverages(teamResult.data) : null}
    />
  );
}
