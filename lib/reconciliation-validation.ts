import type { WorkBook } from "xlsx";

import {
  createComparisonKey,
  removeExtraSpaces,
} from "@/lib/excel-normalization";
import {
  excelSerialDateToDate,
  isEmptyCell,
  parseInteger,
  worksheetToRows,
  type InvalidWorkbookRow,
  type SheetRow,
  type ValidationSummary,
} from "@/lib/excel-validation";
import { getMonthKey } from "@/lib/reconciliation";
import { normalizeWorkbookHeader } from "@/lib/workbook-column-validator";

// Clinical pharmacist as needed for matching tracker headers. aliasKeys are
// the database alias_key values (lower case, single spaces, trimmed).
export type ReconciliationRosterEntry = {
  active: boolean;
  aliasKeys: string[];
  displayName: string;
  id: number;
};

export type ReconciliationColumn = {
  active: boolean;
  columnIndex: number;
  header: string;
  pharmacistId: number;
  pharmacistName: string;
};

export type IgnoredReconciliationColumn = {
  columnIndex: number;
  header: string;
  reason: string;
};

// One record per day and pharmacist; same-day rows are added together.
export type ReconciliationRecord = {
  day: string;
  itemCount: number;
  pharmacistId: number;
  pharmacistName: string;
  pharmacistNameRaw: string;
  taskLabel: string;
};

export type ReconciliationMonthlyTotal = {
  active: boolean;
  itemCount: number;
  month: string;
  pharmacistName: string;
};

export type ReconciliationValidationResult = {
  columns: ReconciliationColumn[];
  combinedRows: number;
  hasBlockingErrors: boolean;
  ignoredColumns: IgnoredReconciliationColumn[];
  invalidRows: InvalidWorkbookRow[];
  monthlyTotals: ReconciliationMonthlyTotal[];
  records: ReconciliationRecord[];
  sheetName: string;
  sheetRows: SheetRow[];
  summary: ValidationSummary;
};

const DAY_HEADER = normalizeWorkbookHeader("DAY");
const TASK_HEADER = normalizeWorkbookHeader("TASK");
const EARLIEST_DAY = "2020-01-01";
const TOTAL_HEADER_PATTERN = /^(grand )?(total|sum)$/i;

function columnLetter(columnIndex: number) {
  let letters = "";

  for (let value = columnIndex + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    letters = String.fromCharCode(65 + ((value - 1) % 26)) + letters;
  }

  return letters;
}

function toDayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLatestAllowedDay(today: Date) {
  return toDayString(
    new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
    ),
  );
}

// DAY must be a real Excel date. Text such as "CCM august" is rejected, and
// any time part is dropped.
function parseTrackerDay(
  value: unknown,
  latestAllowedDay: string,
): { error?: string; value?: string } {
  let serialDate: Date | number;

  if (value instanceof Date || typeof value === "number") {
    serialDate = typeof value === "number" ? Math.floor(value) : value;
  } else {
    const text = removeExtraSpaces(String(value));

    if (!/^\d+(\.\d+)?$/.test(text)) {
      return { error: `DAY must be a real Excel date (found "${text}").` };
    }

    serialDate = Math.floor(Number(text));
  }

  const date = excelSerialDateToDate(serialDate);

  if (!date.value) {
    return { error: "DAY must be a real Excel date." };
  }

  const day = toDayString(date.value);

  if (day < EARLIEST_DAY || day > latestAllowedDay) {
    return {
      error: `DAY ${day} is outside the allowed range (${EARLIEST_DAY} to ${latestAllowedDay}).`,
    };
  }

  return { value: day };
}

function blockingResult(
  sheetName: string,
  sheetRows: SheetRow[],
  reasons: string[],
  columns: ReconciliationColumn[] = [],
  ignoredColumns: IgnoredReconciliationColumn[] = [],
): ReconciliationValidationResult {
  const invalidRows = reasons.map((reason) => ({
    reason,
    rowNumber: 1,
    sheetName,
  }));

  return {
    columns,
    combinedRows: 0,
    hasBlockingErrors: true,
    ignoredColumns,
    invalidRows,
    monthlyTotals: [],
    records: [],
    sheetName,
    sheetRows,
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows: 0,
      totalRows: Math.max(sheetRows.length - 1, 0),
      validRows: 0,
    },
  };
}

export function validateReconciliationWorkbook(
  workbook: WorkBook,
  roster: ReconciliationRosterEntry[],
  options: { today?: Date } = {},
): ReconciliationValidationResult {
  const sheetName = workbook.SheetNames[0] ?? "First worksheet";
  const sheet = workbook.SheetNames[0]
    ? workbook.Sheets[workbook.SheetNames[0]]
    : undefined;

  if (!sheet) {
    return blockingResult(sheetName, [], [
      "The workbook must contain at least one worksheet.",
    ]);
  }

  const sheetRows = worksheetToRows(sheet);
  const headerRow = sheetRows[0] ?? [];
  const dataRows = sheetRows.slice(1);
  const pharmacistsByAliasKey = new Map<string, ReconciliationRosterEntry>();

  for (const pharmacist of roster) {
    for (const aliasKey of pharmacist.aliasKeys) {
      pharmacistsByAliasKey.set(aliasKey, pharmacist);
    }
  }

  const columns: ReconciliationColumn[] = [];
  const ignoredColumns: IgnoredReconciliationColumn[] = [];
  const structureErrors: string[] = [];
  const columnsByPharmacist = new Map<number, ReconciliationColumn>();
  const columnCount = dataRows.reduce(
    (count, row) => Math.max(count, row.length),
    headerRow.length,
  );
  let dayColumn = -1;
  let taskColumn = -1;

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const rawHeader = headerRow[columnIndex];
    const header = isEmptyCell(rawHeader) ? "" : removeExtraSpaces(String(rawHeader));
    const normalizedHeader = normalizeWorkbookHeader(header);

    if (!header) {
      if (dataRows.some((row) => !isEmptyCell(row[columnIndex]))) {
        ignoredColumns.push({
          columnIndex,
          header: `Column ${columnLetter(columnIndex)}`,
          reason: "Has values but no header name.",
        });
      }

      continue;
    }

    if (normalizedHeader === DAY_HEADER || normalizedHeader === TASK_HEADER) {
      const isDay = normalizedHeader === DAY_HEADER;

      if ((isDay ? dayColumn : taskColumn) === -1) {
        if (isDay) {
          dayColumn = columnIndex;
        } else {
          taskColumn = columnIndex;
        }
      } else {
        ignoredColumns.push({
          columnIndex,
          header,
          reason: `Duplicate ${isDay ? "DAY" : "TASK"} column.`,
        });
      }

      continue;
    }

    if (TOTAL_HEADER_PATTERN.test(header)) {
      ignoredColumns.push({ columnIndex, header, reason: "Total column." });
      continue;
    }

    const pharmacist = pharmacistsByAliasKey.get(createComparisonKey(header));

    if (!pharmacist) {
      ignoredColumns.push({
        columnIndex,
        header,
        reason:
          "Not in the Clinical pharmacist list. Add it as an alias in Settings > Clinical Pharmacists, then upload again.",
      });
      continue;
    }

    const existingColumn = columnsByPharmacist.get(pharmacist.id);

    if (existingColumn) {
      structureErrors.push(
        `Columns "${existingColumn.header}" and "${header}" both belong to ${pharmacist.displayName}. Keep only one of them.`,
      );
      continue;
    }

    const column = {
      active: pharmacist.active,
      columnIndex,
      header,
      pharmacistId: pharmacist.id,
      pharmacistName: pharmacist.displayName,
    };

    columnsByPharmacist.set(pharmacist.id, column);
    columns.push(column);
  }

  if (dayColumn === -1) {
    structureErrors.unshift('Missing required column "DAY".');
  }

  if (columns.length === 0) {
    structureErrors.push(
      "No column matches a Clinical pharmacist. Check the header names against Settings > Clinical Pharmacists.",
    );
  }

  if (structureErrors.length > 0) {
    return blockingResult(
      sheetName,
      sheetRows,
      structureErrors,
      columns,
      ignoredColumns,
    );
  }

  const latestAllowedDay = getLatestAllowedDay(options.today ?? new Date());
  const recordsByKey = new Map<
    string,
    Omit<ReconciliationRecord, "taskLabel"> & { taskLabels: Set<string> }
  >();
  const invalidRows: InvalidWorkbookRow[] = [];
  const seenDays = new Set<string>();
  let combinedRows = 0;
  let skippedEmptyRows = 0;
  let validRows = 0;

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const countCells = columns
      .map((column) => ({ column, value: row[column.columnIndex] }))
      .filter(({ value }) => !isEmptyCell(value));

    // Rows without any pharmacist count (for example separator rows) have
    // nothing to import.
    if (countCells.length === 0) {
      skippedEmptyRows += 1;
      continue;
    }

    const errors: string[] = [];
    const dayValue = row[dayColumn];
    let day: string | undefined;

    if (isEmptyCell(dayValue)) {
      errors.push("DAY is required.");
    } else {
      const parsedDay = parseTrackerDay(dayValue, latestAllowedDay);

      if (parsedDay.error) {
        errors.push(parsedDay.error);
      }

      day = parsedDay.value;
    }

    const counts: Array<{ column: ReconciliationColumn; itemCount: number }> = [];

    for (const { column, value } of countCells) {
      const parsedCount = parseInteger(value, column.header, { minimum: 0 });

      if (parsedCount.error || parsedCount.value === undefined) {
        errors.push(parsedCount.error ?? `${column.header} must be an integer.`);
        continue;
      }

      counts.push({ column, itemCount: parsedCount.value });
    }

    if (errors.length > 0 || !day) {
      invalidRows.push({ reason: errors.join(" "), rowNumber, sheetName });
      continue;
    }

    validRows += 1;

    if (seenDays.has(day)) {
      combinedRows += 1;
    } else {
      seenDays.add(day);
    }

    const taskLabel =
      taskColumn === -1 || isEmptyCell(row[taskColumn])
        ? ""
        : removeExtraSpaces(String(row[taskColumn]));

    for (const { column, itemCount } of counts) {
      const key = `${day}|${column.pharmacistId}`;
      const existingRecord = recordsByKey.get(key);

      if (existingRecord) {
        existingRecord.itemCount += itemCount;

        if (taskLabel) {
          existingRecord.taskLabels.add(taskLabel);
        }

        continue;
      }

      recordsByKey.set(key, {
        day,
        itemCount,
        pharmacistId: column.pharmacistId,
        pharmacistName: column.pharmacistName,
        pharmacistNameRaw: column.header,
        taskLabels: new Set(taskLabel ? [taskLabel] : []),
      });
    }
  }

  const records = [...recordsByKey.values()]
    .map(({ taskLabels, ...record }) => ({
      ...record,
      taskLabel: [...taskLabels].join(" | "),
    }))
    .sort(
      (left, right) =>
        left.day.localeCompare(right.day) ||
        left.pharmacistName.localeCompare(right.pharmacistName),
    );
  const activeByPharmacist = new Map(
    columns.map((column) => [column.pharmacistId, column.active]),
  );
  const monthlyTotalsByKey = new Map<string, ReconciliationMonthlyTotal>();

  for (const record of records) {
    const month = getMonthKey(record.day);
    const key = `${month}|${record.pharmacistId}`;
    const existingTotal = monthlyTotalsByKey.get(key);

    if (existingTotal) {
      existingTotal.itemCount += record.itemCount;
      continue;
    }

    monthlyTotalsByKey.set(key, {
      active: activeByPharmacist.get(record.pharmacistId) ?? true,
      itemCount: record.itemCount,
      month,
      pharmacistName: record.pharmacistName,
    });
  }

  const monthlyTotals = [...monthlyTotalsByKey.values()].sort(
    (left, right) =>
      left.month.localeCompare(right.month) ||
      left.pharmacistName.localeCompare(right.pharmacistName),
  );

  return {
    columns,
    combinedRows,
    hasBlockingErrors: false,
    ignoredColumns,
    invalidRows,
    monthlyTotals,
    records,
    sheetName,
    sheetRows,
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows,
      totalRows: dataRows.length,
      validRows,
    },
  };
}
