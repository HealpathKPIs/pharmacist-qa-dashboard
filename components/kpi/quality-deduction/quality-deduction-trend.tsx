"use client";

import { formatInteger } from "@/components/kpi/kpi-format";
import { KpiTrendDialog } from "@/components/kpi/kpi-trend-dialog";
import type { QualityDeductionTeamTrend } from "@/lib/quality-deduction";
import type { QualityDeductionData } from "@/lib/quality-deduction-queries";

// One agent's monthly Quality Deduction Score against the team total.
export function QualityDeductionTrendDialog({
  actorLabel,
  data,
  onClose,
  pharmacist,
  teamTrend,
}: {
  actorLabel: string;
  data: QualityDeductionData;
  onClose: () => void;
  pharmacist: string | null;
  // Unfiltered team figures; see QualityDeductionScore.
  teamTrend?: QualityDeductionTeamTrend | null;
}) {
  const points = pharmacist
    ? data.months.map((month) => {
        const figures = month.cells[pharmacist];

        return {
          agent: figures?.score ?? null,
          agentDetail: figures?.errors
            ? `${formatInteger(figures.severity)} / ${formatInteger(figures.errors)}`
            : null,
          month: month.month,
          team: teamTrend === undefined ? month.team.score : teamTrend?.months[month.month] ?? null,
        };
      })
    : [];

  return (
    <KpiTrendDialog
      actorLabel={actorLabel}
      chartLabel={`Line chart of ${pharmacist}'s monthly Quality Deduction Score against the team total. The same figures are in the table below.`}
      comparisonNoun="team"
      description="Monthly score against the team total. Lower is better: a point above the dashed team line means more severity points per QA error than the team."
      emptyMonthsLabel="No scored months"
      footnote={`Points per QA error. A gap in the line is a month with no QA errors for this ${actorLabel.toLowerCase()}.`}
      formatAxis={(value) => value.toFixed(1)}
      formatDifference={(value) => value.toFixed(2)}
      formatValue={(value) => `${value.toFixed(2)} pts`}
      onClose={onClose}
      period={{
        agent: pharmacist ? data.total.cells[pharmacist]?.score ?? null : null,
        team: teamTrend === undefined ? data.total.team.score : teamTrend?.period ?? null,
      }}
      pharmacist={pharmacist}
      points={points}
      teamLabel="Team total"
      title="Quality Deduction trend"
    />
  );
}
