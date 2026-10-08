import { read, type WorkBook } from "xlsx";

import { createComparisonKey, removeExtraSpaces } from "@/lib/excel-normalization";
import {
  excelSerialDateToDate,
  isEmptyCell,
  worksheetToRows,
  type InvalidWorkbookRow,
  type SheetRow,
  type ValidationSummary,
} from "@/lib/excel-validation";

// Monthly Processing Time tracker (sheet DAILY_WORK_LOG): one row per task
// line with Date, Pharmacist, Task Reference, Task Type, Items Completed,
// SLA per item, SLA minutes and Actual Time (minutes). One file per month; an
// import replaces the whole selected month. Strict: any invalid task row blocks
// the import, nothing is guessed or recomputed.

export const PROCESSING_TIME_SHEET_NAME = "DAILY_WORK_LOG";

export const PROCESSING_TIME_COLUMNS = [
  "Date",
  "Pharmacist",
  "Task Reference",
  "Task Type",
  "Items Completed",
  "SLA per item",
  "SLA minutes",
  "Actual Time",
] as const;

// Clinical pharmacist as needed for matching names. aliasKeys are the database
// alias_key values (lower case, single spaces, trimmed).
export type ProcessingTimeRosterEntry = {
  active: boolean;
  aliasKeys: string[];
  displayName: string;
  id: number;
};

export type ProcessingTimeRecord = {
  actualMinutes: number;
  active: boolean;
  day: string;
  itemsCompleted: number;
  pharmacistId: number;
  pharmacistName: string;
  pharmacistNameRaw: string;
  rowNumber: number;
  slaMinutes: number;
  slaPerItem: number;
  taskReference: string;
  taskType: string;
};

// Rows that are not task lines (for example a summary number under the data):
// listed in the preview, never imported.
export type IgnoredProcessingTimeRow = {
  reason: string;
  rowNumber: number;
  values: string;
};

export type ProcessingTimeWarning = {
  message: string;
  rowNumbers: number[];
};

export type ProcessingTimeStats = {
  actualMinutes: number;
  firstDay: string | null;
  inactivePharmacists: string[];
  lastDay: string | null;
  pharmacists: string[];
  slaMinutes: number;
  taskTypes: string[];
};

export type ProcessingTimeValidationResult = {
  // Month most rows fall in (YYYY-MM); null when no row has a valid date.
  detectedMonth: string | null;
  hasBlockingErrors: boolean;
  ignoredRows: IgnoredProcessingTimeRow[];
  invalidRows: InvalidWorkbookRow[];
  // Month the rows were checked against (YYYY-MM).
  month: string | null;
  records: ProcessingTimeRecord[];
  sheetName: string;
  stats: ProcessingTimeStats;
  summary: ValidationSummary;
  warnings: ProcessingTimeWarning[];
};

type ColumnKey =
  | "actual"
  | "date"
  | "items"
  | "pharmacist"
  | "slaMinutes"
  | "slaPerItem"
  | "taskReference"
  | "taskType";

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  actual: ["actual time", "actual minutes", "actual time (min)", "actual time (minutes)"],
  date: ["date", "day"],
  items: ["items completed", "items"],
  pharmacist: ["pharmacist", "pharmacist name"],
  slaMinutes: ["sla minutes", "sla (min)", "sla time"],
  slaPerItem: ["sla per item"],
  taskReference: ["task reference", "task ref", "task id"],
  taskType: ["task type", "task"],
};
const REQUIRED_COLUMNS: ColumnKey[] = [
  "date",
  "pharmacist",
  "taskType",
  "items",
  "slaPerItem",
  "slaMinutes",
  "actual",
];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  actual: "Actual Time",
  date: "Date",
  items: "Items Completed",
  pharmacist: "Pharmacist",
  slaMinutes: "SLA minutes",
  slaPerItem: "SLA per item",
  taskReference: "Task Reference",
  taskType: "Task Type",
};
const HEADER_SEARCH_ROWS = 10;
const SLA_TOLERANCE = 0.01;
const EARLIEST_DAY = "2020-01-01";
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MONTH_YEAR_PATTERN = /^(\d{1,2})[\s-]+([a-z]+)\.?[\s,-]+(\d{4})$/i;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function readProcessingTimeWorkbook(data: ArrayBuffer): WorkBook {
  return read(data, { raw: true, type: "array" });
}

export function isProcessingTimeFileName(fileName: string) {
  return /\.xlsx$/i.test(fileName);
}

export function isProcessingMonth(value: string) {
  const match = MONTH_PATTERN.exec(value);

  return Boolean(match) && Number(match?.[2]) >= 1 && Number(match?.[2]) <= 12;
}

// "2026-07" -> "July 2026".
export function formatProcessingMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

export function formatProcessingDay(day: string) {
  return dayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

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

function toCalendarDay(year: number, month: number, dayOfMonth: number) {
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === dayOfMonth
    ? toDayString(date)
    : null;
}

function getLatestAllowedDay(today: Date) {
  return toDayString(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)),
  );
}

function cellText(value: unknown) {
  return isEmptyCell(value) ? "" : removeExtraSpaces(String(value));
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = cellText(value);

  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : null;
}

// Accepted: an Excel date, 2026-07-01 or 1-Jul-2026. Slash dates are refused:
// 1/7 could be 1 July or 7 January.
function parseDay(value: unknown, latestAllowedDay: string): { error?: string; value?: string } {
  let day: string | null = null;

  if (value instanceof Date || typeof value === "number") {
    const parsed = excelSerialDateToDate(
      typeof value === "number" ? Math.floor(value) : value,
    );

    day = parsed.value ? toDayString(parsed.value) : null;

    if (!day) {
      return { error: "Date must be a valid Excel date." };
    }
  } else {
    const text = cellText(value);
    const isoMatch = ISO_DAY_PATTERN.exec(text);
    const dayMonthYearMatch = DAY_MONTH_YEAR_PATTERN.exec(text);

    if (/^\d+(\.\d+)?$/.test(text)) {
      return parseDay(Number(text), latestAllowedDay);
    }

    if (isoMatch) {
      day = toCalendarDay(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    } else if (dayMonthYearMatch) {
      const monthIndex = MONTHS.indexOf(dayMonthYearMatch[2].slice(0, 3).toLowerCase());

      day =
        monthIndex >= 0
          ? toCalendarDay(Number(dayMonthYearMatch[3]), monthIndex + 1, Number(dayMonthYearMatch[1]))
          : null;
    } else {
      return {
        error: `Date must be an Excel date, 2026-07-01 or 1-Jul-2026 (found "${text}").`,
      };
    }

    if (!day) {
      return { error: `"${text}" is not a valid calendar date.` };
    }
  }

  if (day < EARLIEST_DAY || day > latestAllowedDay) {
    return {
      error: `${formatProcessingDay(day)} is outside the allowed range (${formatProcessingDay(EARLIEST_DAY)} to ${formatProcessingDay(latestAllowedDay)}).`,
    };
  }

  return { value: day };
}

function findHeader(rows: SheetRow[]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SEARCH_ROWS); rowIndex += 1) {
    const columns = new Map<ColumnKey, number>();

    (rows[rowIndex] ?? []).forEach((cell, columnIndex) => {
      const key = createComparisonKey(String(cell ?? ""));

      for (const [columnKey, aliases] of Object.entries(HEADER_ALIASES) as Array<
        [ColumnKey, string[]]
      >) {
        if (!columns.has(columnKey) && aliases.includes(key)) {
          columns.set(columnKey, columnIndex);
        }
      }
    });

    if (columns.has("pharmacist") && columns.has("actual")) {
      return { columns, rowIndex };
    }
  }

  return null;
}

function emptyStats(): ProcessingTimeStats {
  return {
    actualMinutes: 0,
    firstDay: null,
    inactivePharmacists: [],
    lastDay: null,
    pharmacists: [],
    slaMinutes: 0,
    taskTypes: [],
  };
}

function blockingResult(sheetName: string, reason: string): ProcessingTimeValidationResult {
  return {
    detectedMonth: null,
    hasBlockingErrors: true,
    ignoredRows: [],
    invalidRows: [{ reason, rowNumber: 1, sheetName }],
    month: null,
    records: [],
    sheetName,
    stats: emptyStats(),
    summary: { invalidRows: 1, skippedEmptyRows: 0, totalRows: 0, validRows: 0 },
    warnings: [],
  };
}

function pickSheetName(workbook: WorkBook) {
  return (
    workbook.SheetNames.find(
      (name) => createComparisonKey(name) === createComparisonKey(PROCESSING_TIME_SHEET_NAME),
    ) ?? workbook.SheetNames[0]
  );
}

// month (YYYY-MM) is the month the Admin selected. Without it (first preview)
// the month most rows fall in is used. Every row must be inside the month.
export function validateProcessingTimeWorkbook(
  workbook: WorkBook,
  roster: ProcessingTimeRosterEntry[],
  { month, today = new Date() }: { month?: string; today?: Date } = {},
): ProcessingTimeValidationResult {
  const sheetName = pickSheetName(workbook);

  if (!sheetName) {
    return blockingResult("Workbook", "The workbook has no worksheet.");
  }

  const rows = worksheetToRows(workbook.Sheets[sheetName]);
  const header = findHeader(rows);

  if (!header) {
    return blockingResult(
      sheetName,
      `No header row found. The sheet needs the columns ${PROCESSING_TIME_COLUMNS.join(", ")}.`,
    );
  }

  const missingColumns = REQUIRED_COLUMNS.filter((key) => !header.columns.has(key));

  if (missingColumns.length > 0) {
    return blockingResult(
      sheetName,
      `Missing required column(s): ${missingColumns.map((key) => COLUMN_LABELS[key]).join(", ")}.`,
    );
  }

  const pharmacistsByAliasKey = new Map<string, ProcessingTimeRosterEntry>();

  for (const entry of roster) {
    for (const aliasKey of entry.aliasKeys) {
      pharmacistsByAliasKey.set(aliasKey, entry);
    }
  }

  const latestAllowedDay = getLatestAllowedDay(today);
  const column = (row: SheetRow, key: ColumnKey) => {
    const index = header.columns.get(key);

    return index === undefined ? "" : row[index];
  };
  const parsed: Array<{ errors: string[]; record: Partial<ProcessingTimeRecord> & { rowNumber: number } }> = [];
  const ignoredRows: IgnoredProcessingTimeRow[] = [];
  let skippedEmptyRows = 0;
  let totalRows = 0;

  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rowNumber = rowIndex + 1;

    if (row.every(isEmptyCell)) {
      skippedEmptyRows += 1;
      continue;
    }

    const dateValue = column(row, "date");
    const pharmacistText = cellText(column(row, "pharmacist"));
    const taskType = cellText(column(row, "taskType"));

    // A number under the data with no date, pharmacist or task (for example an
    // average) is not a task line.
    if (isEmptyCell(dateValue) && !pharmacistText && !taskType) {
      ignoredRows.push({
        reason: "No date, pharmacist or task type: not a task row (for example a summary cell).",
        rowNumber,
        values: row
          .map((value, index) => (isEmptyCell(value) ? null : `${columnLetter(index)}: ${cellText(value)}`))
          .filter(Boolean)
          .slice(0, 6)
          .join(", "),
      });
      continue;
    }

    totalRows += 1;

    const errors: string[] = [];
    const record: Partial<ProcessingTimeRecord> & { rowNumber: number } = {
      rowNumber,
      taskReference: cellText(column(row, "taskReference")),
      taskType,
    };

    if (isEmptyCell(dateValue)) {
      errors.push("Date is required.");
    } else {
      const day = parseDay(dateValue, latestAllowedDay);

      if (day.error) {
        errors.push(day.error);
      } else {
        record.day = day.value;
      }
    }

    if (!pharmacistText) {
      errors.push("Pharmacist is required.");
    } else {
      const pharmacist = pharmacistsByAliasKey.get(createComparisonKey(pharmacistText));

      if (!pharmacist) {
        errors.push(
          `"${pharmacistText}" is not in the Clinical pharmacist list. Add it as an alias in Settings > Clinical Pharmacists, then upload again.`,
        );
      } else {
        record.active = pharmacist.active;
        record.pharmacistId = pharmacist.id;
        record.pharmacistName = pharmacist.displayName;
        record.pharmacistNameRaw = pharmacistText;
      }
    }

    if (!taskType) {
      errors.push("Task Type is required.");
    }

    const numbers: Array<[ColumnKey, "itemsCompleted" | "slaPerItem" | "slaMinutes" | "actualMinutes"]> = [
      ["items", "itemsCompleted"],
      ["slaPerItem", "slaPerItem"],
      ["slaMinutes", "slaMinutes"],
      ["actual", "actualMinutes"],
    ];

    for (const [columnKey, field] of numbers) {
      const raw = column(row, columnKey);
      const value = toNumber(raw);

      if (isEmptyCell(raw)) {
        errors.push(`${COLUMN_LABELS[columnKey]} is blank.`);
      } else if (value === null) {
        errors.push(`${COLUMN_LABELS[columnKey]} must be a number (found "${cellText(raw)}").`);
      } else if (field === "actualMinutes" ? value <= 0 : value < 0) {
        errors.push(
          field === "actualMinutes"
            ? `Actual Time must be more than 0 (found ${value}).`
            : `${COLUMN_LABELS[columnKey]} cannot be negative (found ${value}).`,
        );
      } else {
        record[field] = value;
      }
    }

    if (
      record.itemsCompleted !== undefined &&
      record.slaPerItem !== undefined &&
      record.slaMinutes !== undefined &&
      Math.abs(record.itemsCompleted * record.slaPerItem - record.slaMinutes) > SLA_TOLERANCE
    ) {
      errors.push(
        `SLA minutes (${record.slaMinutes}) does not equal Items Completed × SLA per item (${record.itemsCompleted} × ${record.slaPerItem} = ${Math.round(record.itemsCompleted * record.slaPerItem * 100) / 100}).`,
      );
    }

    parsed.push({ errors, record });
  }

  const monthCounts = new Map<string, number>();

  for (const { record } of parsed) {
    if (record.day) {
      const rowMonth = record.day.slice(0, 7);

      monthCounts.set(rowMonth, (monthCounts.get(rowMonth) ?? 0) + 1);
    }
  }

  const detectedMonth =
    [...monthCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ??
    null;
  const checkedMonth = month && isProcessingMonth(month) ? month : detectedMonth;

  if (checkedMonth) {
    for (const entry of parsed) {
      if (entry.record.day && entry.record.day.slice(0, 7) !== checkedMonth) {
        entry.errors.push(
          `${formatProcessingDay(entry.record.day)} is not in ${formatProcessingMonth(checkedMonth)}, the month being imported.`,
        );
      }
    }
  }

  const invalidRows: InvalidWorkbookRow[] = parsed
    .filter((entry) => entry.errors.length > 0)
    .map((entry) => ({ reason: entry.errors.join(" "), rowNumber: entry.record.rowNumber, sheetName }));
  const records = parsed
    .filter((entry) => entry.errors.length === 0)
    .map((entry) => entry.record as ProcessingTimeRecord);
  const warnings: ProcessingTimeWarning[] = [];
  const duplicates = new Map<string, number[]>();

  for (const record of records) {
    const key = [
      record.day,
      record.pharmacistId,
      createComparisonKey(record.taskReference),
      createComparisonKey(record.taskType),
      record.itemsCompleted,
      record.slaMinutes,
      record.actualMinutes,
    ].join("|");

    duplicates.set(key, [...(duplicates.get(key) ?? []), record.rowNumber]);
  }

  for (const rowNumbers of duplicates.values()) {
    if (rowNumbers.length > 1) {
      warnings.push({
        message: `Rows ${rowNumbers.join(", ")} are identical (same date, pharmacist, task and minutes). All are imported; remove the extra rows if they were entered twice.`,
        rowNumbers,
      });
    }
  }

  const inactivePharmacists = [
    ...new Set(records.filter((record) => !record.active).map((record) => record.pharmacistName)),
  ].sort();

  if (inactivePharmacists.length > 0) {
    warnings.push({
      message: `Inactive pharmacist(s): ${inactivePharmacists.join(", ")}. Their rows are saved but do not count in the KPI while they are inactive.`,
      rowNumbers: records.filter((record) => !record.active).map((record) => record.rowNumber),
    });
  }

  if (parsed.length === 0) {
    invalidRows.push({ reason: "The sheet has no task rows.", rowNumber: header.rowIndex + 1, sheetName });
  }

  const days = records.map((record) => record.day).sort();

  return {
    detectedMonth,
    hasBlockingErrors: invalidRows.length > 0,
    ignoredRows,
    invalidRows,
    month: checkedMonth,
    records,
    sheetName,
    stats: {
      actualMinutes: records.reduce((total, record) => total + record.actualMinutes, 0),
      firstDay: days[0] ?? null,
      inactivePharmacists,
      lastDay: days.at(-1) ?? null,
      pharmacists: [...new Set(records.map((record) => record.pharmacistName))].sort(),
      slaMinutes: records.reduce((total, record) => total + record.slaMinutes, 0),
      taskTypes: [...new Set(records.map((record) => record.taskType))].sort(),
    },
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows,
      totalRows,
      validRows: records.length,
    },
    warnings,
  };
}
