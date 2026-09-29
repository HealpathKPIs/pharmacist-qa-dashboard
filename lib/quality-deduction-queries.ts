import "server-only";

import type { AuditType } from "@/lib/audit-types";
import { getActiveClinicalPharmacistNames } from "@/lib/clinical-roster";
import {
  getPreviousPeriodFilters,
  getQaErrorDetails,
  type DashboardDateRangeFilter,
} from "@/lib/dashboard-queries";
import { getActiveNonMedicalAgentNames } from "@/lib/non-medical-roster";
import {
  toQualityDeductionRows,
  withDerivedSeverity,
  type ScoredQaErrorDetail,
} from "@/lib/qa-error-severity";
import {
  buildQualityDeductionTable,
  getQualityDeductionMonths,
  listQualityDeductionActors,
  summarizeQualityDeduction,
  toFilterDay,
  type QualityDeductionFigures,
  type QualityDeductionTable,
} from "@/lib/quality-deduction";

// Quality Deduction Score section of the KPI pages. It reads the same QA error
// rows as the module's dashboard (exact dates) and uses the dashboard's
// previous-period comparison:
//   * Clinical: active roster pharmacists, stored scores.
//   * Non-Medical: active roster agents, scores derived from the scoring
//     criteria.

export type QualityDeductionFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
};

export type QualityDeductionData = QualityDeductionTable & {
  // SUM(score) / COUNT(rows) of the selected period.
  current: QualityDeductionFigures;
  endDate: string | null;
  // QA error rows of the selected period, for drill-down.
  errorRows: ScoredQaErrorDetail[];
  pharmacistName: string | null;
  pharmacists: string[];
  previous: QualityDeductionFigures | null;
  previousPeriod: { endDate: string; startDate: string } | null;
  startDate: string | null;
  // QA errors of the selected period without a scoring criterion (Non-Medical).
  // They count as QA errors and add no points.
  unscoredErrors: number;
};

export type QualityDeductionResult =
  | { data: QualityDeductionData; error: null }
  | { data: null; error: string };

type Query = {
  endDate?: string;
  pharmacistName?: string;
  queryFilters: DashboardDateRangeFilter;
  startDate?: string;
};

// Date filter values come from the URL; anything that is not YYYY-MM-DD is ignored.
function toQuery(auditType: AuditType, filters: QualityDeductionFilters): Query {
  const startDate = toFilterDay(filters.startDate);
  const endDate = toFilterDay(filters.endDate);
  const pharmacistName = filters.pharmacistName || undefined;

  return {
    endDate,
    pharmacistName,
    queryFilters: { auditType, endDate, pharmacistName, startDate },
    startDate,
  };
}

function getPreviousPeriod(previousFilters: DashboardDateRangeFilter) {
  return typeof previousFilters.startDate === "string" &&
    typeof previousFilters.endDate === "string"
    ? { endDate: previousFilters.endDate, startDate: previousFilters.startDate }
    : null;
}

function buildQualityDeductionData({
  errorRows,
  pharmacists,
  previousPeriod,
  previousRows,
  query: { endDate, pharmacistName, startDate },
}: {
  errorRows: ScoredQaErrorDetail[];
  pharmacists: string[];
  previousPeriod: QualityDeductionData["previousPeriod"];
  previousRows: ScoredQaErrorDetail[] | null;
  query: Query;
}): QualityDeductionData {
  const rows = toQualityDeductionRows(errorRows);
  const months = getQualityDeductionMonths({ endDate, rows, startDate });

  return {
    ...buildQualityDeductionTable({ endDate, months, pharmacists, rows, startDate }),
    current: summarizeQualityDeduction(rows),
    endDate: endDate ?? null,
    errorRows,
    pharmacistName: pharmacistName ?? null,
    pharmacists,
    previous: previousRows ? summarizeQualityDeduction(toQualityDeductionRows(previousRows)) : null,
    previousPeriod,
    startDate: startDate ?? null,
    unscoredErrors: errorRows.filter((row) => row.derivedSeverity === null).length,
  };
}

function toErrorResult(error: unknown): QualityDeductionResult {
  return {
    data: null,
    error:
      error instanceof Error
        ? error.message
        : "The Quality Deduction Score could not be loaded.",
  };
}

export async function getQualityDeduction(
  filters: QualityDeductionFilters,
): Promise<QualityDeductionResult> {
  try {
    const query = toQuery("clinical", filters);
    const [errorRows, previousFilters, activePharmacists] = await Promise.all([
      getQaErrorDetails(query.queryFilters),
      getPreviousPeriodFilters(query.queryFilters),
      getActiveClinicalPharmacistNames(),
    ]);
    const previousPeriod = getPreviousPeriod(previousFilters);
    const previousRows = previousPeriod ? await getQaErrorDetails(previousFilters) : null;

    return {
      data: buildQualityDeductionData({
        errorRows,
        pharmacists: listQualityDeductionActors({
          activeNames: activePharmacists,
          rows: errorRows,
          selectedName: query.pharmacistName,
        }),
        previousPeriod,
        previousRows,
        query,
      }),
      error: null,
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

// Non-Medical: the same formula on the derived severity scores. Like Clinical,
// the table lists the active agents of the roster.
export async function getNonMedicalQualityDeduction(
  filters: QualityDeductionFilters,
): Promise<QualityDeductionResult> {
  try {
    const query = toQuery("non_medical", filters);
    const [storedRows, previousFilters, activeAgents] = await Promise.all([
      getQaErrorDetails(query.queryFilters),
      getPreviousPeriodFilters(query.queryFilters),
      getActiveNonMedicalAgentNames(),
    ]);
    const previousPeriod = getPreviousPeriod(previousFilters);
    const previousRows = previousPeriod
      ? withDerivedSeverity(await getQaErrorDetails(previousFilters))
      : null;
    const errorRows = withDerivedSeverity(storedRows);

    return {
      data: buildQualityDeductionData({
        errorRows,
        pharmacists: listQualityDeductionActors({
          activeNames: activeAgents,
          rows: errorRows,
          selectedName: query.pharmacistName,
        }),
        previousPeriod,
        previousRows,
        query,
      }),
      error: null,
    };
  } catch (error) {
    return toErrorResult(error);
  }
}
