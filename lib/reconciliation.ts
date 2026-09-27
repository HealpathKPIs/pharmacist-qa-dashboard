import { normalizeIssueName } from "@/lib/excel-normalization";

export const MEDICATION_RECONCILIATION = "medication_reconciliation" as const;

// Clinical QA issue types that count as medication reconciliation errors.
const RECONCILIATION_ERROR_ISSUE_NAMES = [
  "Wrong recommendtion",
  "Comment not written",
  "Wrong comment",
  "Exagerreted protocol not written",
  "Missing interaction documentation",
  "Wrong interaction",
  "No exaggerated protocol",
  "Mild interaction not written",
  "Missing recommendtion",
  "Missing issue documentation",
  "Wrong comment place",
  "Wrong recommendation affecting patient safety And Cost",
  "Severe interaction not written",
  "duplicated issue",
  "Wrong issue place",
  "Contraindicated drug not flagged",
] as const;

// Stored issue types are normalized with normalizeIssueName at import.
export const RECONCILIATION_ERROR_ISSUE_TYPES: readonly string[] =
  RECONCILIATION_ERROR_ISSUE_NAMES.map(normalizeIssueName);

// "YYYY-MM"
export type MonthKey = string;

export type ReconciliationWorkloadRow = {
  day: string;
  itemCount: number;
  pharmacistName: string;
};

export type ReconciliationErrorRow = {
  day: string;
  pharmacistName: string;
};

export type ReconciliationFigures = {
  accuracy: number | null;
  audited: number;
  errorFree: number;
  errors: number;
};

export type ReconciliationCell = ReconciliationFigures & {
  errorsExceedAudited: boolean;
  hasTrackerData: boolean;
};

export type ReconciliationMonth = {
  cells: Record<string, ReconciliationCell>;
  // Errors of pharmacists without tracker numbers that month; they are not
  // part of the team figures.
  excludedErrors: number;
  month: MonthKey;
  team: ReconciliationFigures;
};

function parseMonthKey(month: MonthKey) {
  const [year, monthNumber] = month.split("-").map(Number);

  return { monthNumber, year };
}

export function getMonthKey(day: string): MonthKey {
  return day.slice(0, 7);
}

export function addMonths(month: MonthKey, offset: number): MonthKey {
  const { monthNumber, year } = parseMonthKey(month);

  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export function getMonthStartDay(month: MonthKey) {
  return `${month}-01`;
}

export function getMonthEndDay(month: MonthKey) {
  const { monthNumber, year } = parseMonthKey(month);

  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

export function listMonths(firstMonth: MonthKey, lastMonth: MonthKey) {
  const months: MonthKey[] = [];

  for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
    months.push(month);
  }

  return months;
}

export function formatMonthLabel(
  month: MonthKey,
  monthFormat: "long" | "short" = "long",
) {
  return new Intl.DateTimeFormat("en-US", {
    month: monthFormat,
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

// Accuracy = (audited - errors) / audited x 100, from monthly totals.
export function calculateReconciliationFigures(
  audited: number,
  errors: number,
): ReconciliationFigures {
  const errorFree = Math.max(audited - errors, 0);

  return {
    accuracy: audited > 0 ? (errorFree / audited) * 100 : null,
    audited,
    errorFree,
    errors,
  };
}

// Groups workload and error rows by calendar month and pharmacist. Every
// figure comes from monthly totals; nothing is calculated per day.
export function buildMonthlyReconciliation({
  errorRows,
  months,
  pharmacists,
  workloadRows,
}: {
  errorRows: ReconciliationErrorRow[];
  months: MonthKey[];
  pharmacists: string[];
  workloadRows: ReconciliationWorkloadRow[];
}): ReconciliationMonth[] {
  const auditedByKey = new Map<string, number>();
  const errorsByKey = new Map<string, number>();

  for (const row of workloadRows) {
    const key = `${getMonthKey(row.day)}|${row.pharmacistName}`;

    auditedByKey.set(key, (auditedByKey.get(key) ?? 0) + row.itemCount);
  }

  for (const row of errorRows) {
    const key = `${getMonthKey(row.day)}|${row.pharmacistName}`;

    errorsByKey.set(key, (errorsByKey.get(key) ?? 0) + 1);
  }

  return months.map((month) => {
    const cells: Record<string, ReconciliationCell> = {};
    let excludedErrors = 0;
    let teamAudited = 0;
    let teamErrors = 0;

    for (const pharmacist of pharmacists) {
      const key = `${month}|${pharmacist}`;
      const hasTrackerData = auditedByKey.has(key);
      const audited = auditedByKey.get(key) ?? 0;
      const errors = errorsByKey.get(key) ?? 0;

      cells[pharmacist] = {
        ...calculateReconciliationFigures(audited, errors),
        errorsExceedAudited: hasTrackerData && errors > audited,
        hasTrackerData,
      };

      if (hasTrackerData) {
        teamAudited += audited;
        teamErrors += errors;
      } else {
        excludedErrors += errors;
      }
    }

    return {
      cells,
      excludedErrors,
      month,
      team: calculateReconciliationFigures(teamAudited, teamErrors),
    };
  });
}
