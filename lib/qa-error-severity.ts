import type { QaErrorDetail } from "@/lib/dashboard-queries";
import type { QualityDeductionRow } from "@/lib/quality-deduction";
import { scoreNonMedicalQaError, type SeverityLevel } from "@/lib/non-medical-scoring";

// A QA error row with the severity the KPIs use. Non-Medical rows carry the
// severity derived from their Category and Issue type
// (lib/non-medical-scoring.ts), null when no scoring criterion matches. Rows of
// the other modules have no derived severity and keep their stored score.
export type ScoredQaErrorDetail = QaErrorDetail & {
  derivedSeverity?: { level: SeverityLevel; score: number } | null;
};

// Non-Medical severity is derived when the data is analyzed; the stored score
// column (the Need Edit flag) is not a severity.
export function withDerivedSeverity(rows: QaErrorDetail[]): ScoredQaErrorDetail[] {
  return rows.map((row) => {
    const result = scoreNonMedicalQaError(row);

    return {
      ...row,
      derivedSeverity:
        result.status === "scored"
          ? { level: result.severityLevel, score: result.score }
          : null,
    };
  });
}

// Severity points of a QA error row: the derived score on Non-Medical rows,
// the stored score elsewhere. null: no scoring criterion, so no score.
export function getSeverityPoints(row: ScoredQaErrorDetail) {
  return row.derivedSeverity === undefined
    ? row.score
    : (row.derivedSeverity?.score ?? null);
}

// Rows for the Quality Deduction Score. A row without a scoring criterion still
// counts as a QA error and adds no points.
export function toQualityDeductionRows(
  rows: readonly ScoredQaErrorDetail[],
): QualityDeductionRow[] {
  return rows.map((row) => ({
    day: row.day,
    pharmacistName: row.pharmacistName,
    score: getSeverityPoints(row) ?? 0,
  }));
}
