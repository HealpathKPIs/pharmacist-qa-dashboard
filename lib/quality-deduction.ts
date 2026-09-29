import {
  getMonthEndDay,
  getMonthKey,
  getMonthStartDay,
  listMonths,
  type MonthKey,
} from "@/lib/reconciliation";

// Quality Deduction Score (Clinical KPI):
//   Total Severity Score ÷ Total QA Errors = SUM(score) / COUNT(QA error rows)
// Scores are added up first and divided once. Individual scores are never
// averaged, and a team figure is never an average of pharmacist scores.

export type QualityDeductionFigures = {
  // Number of QA error rows.
  errors: number;
  // Severity points per QA error; null when there are no QA errors.
  score: number | null;
  // Sum of the rows' severity scores.
  severity: number;
};

export type QualityDeductionRow = {
  day: string;
  pharmacistName: string;
  score: number;
};

export type QualityDeductionMonth = {
  cells: Record<string, QualityDeductionFigures>;
  // Days of the month inside the date filter, when the filter cuts the month.
  coverage: { from: string; to: string } | null;
  month: MonthKey;
  team: QualityDeductionFigures;
};

export type QualityDeductionTable = {
  months: QualityDeductionMonth[];
  // All shown months together.
  total: {
    cells: Record<string, QualityDeductionFigures>;
    team: QualityDeductionFigures;
  };
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Date filter values come from the URL; anything that is not YYYY-MM-DD is ignored.
export function toFilterDay(value?: string) {
  return value && DAY_PATTERN.test(value) ? value : undefined;
}

export function calculateQualityDeduction(
  severity: number,
  errors: number,
): QualityDeductionFigures {
  return {
    errors,
    score: errors > 0 ? severity / errors : null,
    severity,
  };
}

export function summarizeQualityDeduction(
  rows: readonly { score: number }[],
): QualityDeductionFigures {
  return calculateQualityDeduction(
    rows.reduce((total, row) => total + row.score, 0),
    rows.length,
  );
}

// Rows of the monthly table: the module's active roster (all of it, or only
// the selected name), then any other name in the QA rows, so the table always
// adds up to the totals.
export function listQualityDeductionActors({
  activeNames,
  rows,
  selectedName,
}: {
  activeNames: readonly string[];
  rows: readonly { pharmacistName: string }[];
  selectedName?: string;
}) {
  const rosterNames = selectedName
    ? activeNames.filter((name) => name === selectedName)
    : [...activeNames];
  const listed = new Set(rosterNames);

  return [
    ...rosterNames,
    ...new Set(rows.map((row) => row.pharmacistName).filter((name) => !listed.has(name))),
  ];
}

// Every month of the date filter. Without a full date range: every month from
// the first to the last month that has QA errors.
export function getQualityDeductionMonths({
  endDate,
  rows,
  startDate,
}: {
  endDate?: string;
  rows: readonly { day: string }[];
  startDate?: string;
}): MonthKey[] {
  const dataMonths = rows.map((row) => getMonthKey(row.day)).sort();
  const firstMonth = startDate ? getMonthKey(startDate) : dataMonths[0];
  const lastMonth = endDate ? getMonthKey(endDate) : dataMonths.at(-1);

  return firstMonth && lastMonth ? listMonths(firstMonth, lastMonth) : [];
}

function getMonthCoverage(month: MonthKey, startDate?: string, endDate?: string) {
  const monthStart = getMonthStartDay(month);
  const monthEnd = getMonthEndDay(month);
  const from = startDate && startDate > monthStart ? startDate : monthStart;
  const to = endDate && endDate < monthEnd ? endDate : monthEnd;

  return from === monthStart && to === monthEnd ? null : { from, to };
}

// Adds up severity and QA errors per month and pharmacist. Team figures and
// the period column add the same totals together and divide once.
export function buildQualityDeductionTable({
  endDate,
  months,
  pharmacists,
  rows,
  startDate,
}: {
  endDate?: string;
  months: MonthKey[];
  pharmacists: string[];
  rows: readonly QualityDeductionRow[];
  startDate?: string;
}): QualityDeductionTable {
  const severityByKey = new Map<string, number>();
  const errorsByKey = new Map<string, number>();

  for (const row of rows) {
    const key = `${getMonthKey(row.day)}|${row.pharmacistName}`;

    severityByKey.set(key, (severityByKey.get(key) ?? 0) + row.score);
    errorsByKey.set(key, (errorsByKey.get(key) ?? 0) + 1);
  }

  const periodSeverity = new Map<string, number>();
  const periodErrors = new Map<string, number>();
  let teamSeverity = 0;
  let teamErrors = 0;

  const shownMonths = months.map((month) => {
    const cells: Record<string, QualityDeductionFigures> = {};
    let monthSeverity = 0;
    let monthErrors = 0;

    for (const pharmacist of pharmacists) {
      const key = `${month}|${pharmacist}`;
      const severity = severityByKey.get(key) ?? 0;
      const errors = errorsByKey.get(key) ?? 0;

      cells[pharmacist] = calculateQualityDeduction(severity, errors);
      monthSeverity += severity;
      monthErrors += errors;
      periodSeverity.set(pharmacist, (periodSeverity.get(pharmacist) ?? 0) + severity);
      periodErrors.set(pharmacist, (periodErrors.get(pharmacist) ?? 0) + errors);
    }

    teamSeverity += monthSeverity;
    teamErrors += monthErrors;

    return {
      cells,
      coverage: getMonthCoverage(month, startDate, endDate),
      month,
      team: calculateQualityDeduction(monthSeverity, monthErrors),
    };
  });

  return {
    months: shownMonths,
    total: {
      cells: Object.fromEntries(
        pharmacists.map((pharmacist) => [
          pharmacist,
          calculateQualityDeduction(
            periodSeverity.get(pharmacist) ?? 0,
            periodErrors.get(pharmacist) ?? 0,
          ),
        ]),
      ),
      team: calculateQualityDeduction(teamSeverity, teamErrors),
    },
  };
}
