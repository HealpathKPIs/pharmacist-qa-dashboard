import type { QualityDeductionFigures, QualityDeductionTable } from "@/lib/quality-deduction";
import type { MonthKey } from "@/lib/reconciliation";

// Overall KPI (Non-Medical): 60% QA error count + 40% quality, as a rank within
// the team, 0–100, higher is better. Each column (one month, or the selected
// period) is ranked on its own:
//   Error score   = (most errors − agent errors) ÷ (most − fewest) × 100
//   Quality score = (worst pts − agent pts) ÷ (worst − best) × 100
//   Overall       = 0.6 × Error score + 0.4 × Quality score
// "pts" is the agent's Quality Deduction Score (severity points per QA error).
// Only agents with QA errors and a valid Quality Deduction Score are scored and
// set the column's fewest/most and best/worst. When all scored agents are tied
// (or only one is scored), that part is 100 for everyone.

export const OVERALL_WEIGHTS = { errorCount: 0.6, quality: 0.4 } as const;

export type OverallScore = {
  errorScore: number;
  errors: number;
  overall: number;
  points: number;
  qualityScore: number;
};

export type OverallColumn = {
  // Simple mean of the scored agents' Overall; null when no agent is scored.
  averageOverall: number | null;
  bestPoints: number | null;
  fewestErrors: number | null;
  mostErrors: number | null;
  // Scored agents only.
  scores: Record<string, OverallScore>;
  worstPoints: number | null;
};

export type OverallTable = {
  months: {
    column: OverallColumn;
    coverage: { from: string; to: string } | null;
    month: MonthKey;
  }[];
  total: OverallColumn;
};

function hasValidScore(
  figures: QualityDeductionFigures,
): figures is QualityDeductionFigures & { score: number } {
  return figures.errors > 0 && typeof figures.score === "number" && Number.isFinite(figures.score);
}

// Lower values are better for both inputs.
function toScore(value: number, best: number, worst: number) {
  return worst === best ? 100 : ((worst - value) / (worst - best)) * 100;
}

export function scoreOverallColumn(
  cells: Readonly<Record<string, QualityDeductionFigures>>,
): OverallColumn {
  const scored = Object.entries(cells).filter(
    (entry): entry is [string, QualityDeductionFigures & { score: number }] =>
      hasValidScore(entry[1]),
  );

  if (scored.length === 0) {
    return {
      averageOverall: null,
      bestPoints: null,
      fewestErrors: null,
      mostErrors: null,
      scores: {},
      worstPoints: null,
    };
  }

  const errors = scored.map(([, figures]) => figures.errors);
  const points = scored.map(([, figures]) => figures.score);
  const fewestErrors = Math.min(...errors);
  const mostErrors = Math.max(...errors);
  const bestPoints = Math.min(...points);
  const worstPoints = Math.max(...points);
  const scores: Record<string, OverallScore> = {};

  for (const [name, figures] of scored) {
    const errorScore = toScore(figures.errors, fewestErrors, mostErrors);
    const qualityScore = toScore(figures.score, bestPoints, worstPoints);

    scores[name] = {
      errorScore,
      errors: figures.errors,
      overall: OVERALL_WEIGHTS.errorCount * errorScore + OVERALL_WEIGHTS.quality * qualityScore,
      points: figures.score,
      qualityScore,
    };
  }

  const overalls = Object.values(scores).map((score) => score.overall);

  return {
    averageOverall: overalls.reduce((total, value) => total + value, 0) / overalls.length,
    bestPoints,
    fewestErrors,
    mostErrors,
    scores,
    worstPoints,
  };
}

// Built from the unfiltered team table, so selecting one agent never changes
// the ranking.
export function buildOverallTable(table: QualityDeductionTable): OverallTable {
  return {
    months: table.months.map((month) => ({
      column: scoreOverallColumn(month.cells),
      coverage: month.coverage,
      month: month.month,
    })),
    total: scoreOverallColumn(table.total.cells),
  };
}
