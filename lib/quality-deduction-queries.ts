import "server-only";

import { getActiveClinicalPharmacistNames } from "@/lib/clinical-roster";
import {
  getPreviousPeriodFilters,
  getQaErrorDetails,
  type DashboardDateRangeFilter,
  type QaErrorDetail,
} from "@/lib/dashboard-queries";
import {
  buildQualityDeductionTable,
  getQualityDeductionMonths,
  summarizeQualityDeduction,
  toFilterDay,
  type QualityDeductionFigures,
  type QualityDeductionTable,
} from "@/lib/quality-deduction";

// Quality Deduction Score section of the Clinical KPI page. It reads the same
// Clinical QA error rows as the Clinical dashboard (active roster pharmacists
// only, exact dates) and uses the dashboard's previous-period comparison.

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
  errorRows: QaErrorDetail[];
  pharmacistName: string | null;
  pharmacists: string[];
  previous: QualityDeductionFigures | null;
  previousPeriod: { endDate: string; startDate: string } | null;
  startDate: string | null;
};

export type QualityDeductionResult =
  | { data: QualityDeductionData; error: null }
  | { data: null; error: string };

export async function getQualityDeduction(
  filters: QualityDeductionFilters,
): Promise<QualityDeductionResult> {
  try {
    const startDate = toFilterDay(filters.startDate);
    const endDate = toFilterDay(filters.endDate);
    const pharmacistName = filters.pharmacistName || undefined;
    const queryFilters: DashboardDateRangeFilter = {
      auditType: "clinical",
      endDate,
      pharmacistName,
      startDate,
    };
    const [errorRows, previousFilters, activePharmacists] = await Promise.all([
      getQaErrorDetails(queryFilters),
      getPreviousPeriodFilters(queryFilters),
      getActiveClinicalPharmacistNames(),
    ]);
    const previousPeriod =
      typeof previousFilters.startDate === "string" &&
      typeof previousFilters.endDate === "string"
        ? { endDate: previousFilters.endDate, startDate: previousFilters.startDate }
        : null;
    const previousRows = previousPeriod ? await getQaErrorDetails(previousFilters) : null;
    const rosterNames = pharmacistName
      ? activePharmacists.filter((name) => name === pharmacistName)
      : activePharmacists;
    // Every row belongs to an active roster pharmacist; any other name is still
    // listed so the table always adds up to the totals.
    const pharmacists = [
      ...rosterNames,
      ...new Set(
        errorRows
          .map((row) => row.pharmacistName)
          .filter((name) => !rosterNames.includes(name)),
      ),
    ];
    const months = getQualityDeductionMonths({ endDate, rows: errorRows, startDate });

    return {
      data: {
        ...buildQualityDeductionTable({
          endDate,
          months,
          pharmacists,
          rows: errorRows,
          startDate,
        }),
        current: summarizeQualityDeduction(errorRows),
        endDate: endDate ?? null,
        errorRows,
        pharmacistName: pharmacistName ?? null,
        pharmacists,
        previous: previousRows ? summarizeQualityDeduction(previousRows) : null,
        previousPeriod,
        startDate: startDate ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "The Quality Deduction Score could not be loaded.",
    };
  }
}
