import { read, type WorkBook } from "xlsx";

import { createComparisonKey, removeExtraSpaces } from "@/lib/excel-normalization";
import {
  excelSerialDateToDate,
  isEmptyCell,
  parseInteger,
  worksheetToRows,
  type InvalidWorkbookRow,
  type SheetRow,
  type ValidationSummary,
} from "@/lib/excel-validation";

// Call-count tracker for the Clinical Calls KPI: the first worksheet (or the
// CSV), column A the call day, then one column per pharmacist with the number
// of calls evaluated that day. Zero is a valid count. The daily rows are the
// source of truth; a "Total" row is never imported, only checked against them.

// Clinical pharmacist as needed for matching tracker headers. aliasKeys are
// the database alias_key values (lower case, single spaces, trimmed).
export type CallCountRosterEntry = {
  active: boolean;
  aliasKeys: string[];
  displayName: string;
  id: number;
};

export type CallCountColumn = {
  active: boolean;
  columnIndex: number;
  header: string;
  pharmacistId: number;
  pharmacistName: string;
};

export type IgnoredCallCountColumn = {
  // Calls in the column's day rows; null when it has none.
  calls: number | null;
  columnIndex: number;
  header: string;
  reason: string;
};

// One record per day and pharmacist.
export type CallCountRecord = {
  active: boolean;
  calls: number;
  day: string;
  pharmacistId: number;
  pharmacistName: string;
  pharmacistNameRaw: string;
};

export type CallCountBlankCell = {
  day: string;
  pharmacistName: string;
  rowNumber: number;
};

export type CallCountDuplicateDay = {
  day: string;
  rowNumbers: number[];
};

export type CallCountMonthlyTotal = {
  active: boolean;
  calls: number;
  month: string;
  pharmacistName: string;
};

export type CallCountTotalRowColumn = {
  // Sum of the daily rows that will be imported.
  dailyTotal: number;
  matches: boolean;
  pharmacistName: string;
  // The number shown in the Total row; null when the cell is empty or text.
  totalRowValue: number | null;
};

export type CallCountTotalRowCheck = {
  columns: CallCountTotalRowColumn[];
  dailyTotal: number;
  label: string;
  matches: boolean;
  rowNumber: number;
  // The Total row's numbers equal the daily sums but sit this many columns to
  // the right (positive) or left (negative) of their pharmacist.
  shift: number | null;
  // Sum of every number in the Total row.
  totalRowSum: number | null;
};

export type CallCountStats = {
  days: number;
  duplicateRows: number;
  firstDay: string | null;
  lastDay: string | null;
  pharmacistsFound: number;
  totalCalls: number;
  zeroCallEntries: number;
};

export type CallCountValidationResult = {
  blankCells: CallCountBlankCell[];
  columns: CallCountColumn[];
  duplicateDays: CallCountDuplicateDay[];
  // Blocking: the layout is wrong or a day is repeated. Nothing is imported.
  hasBlockingErrors: boolean;
  ignoredColumns: IgnoredCallCountColumn[];
  invalidRows: InvalidWorkbookRow[];
  monthlyTotals: CallCountMonthlyTotal[];
  records: CallCountRecord[];
  sheetName: string;
  sheetRows: SheetRow[];
  stats: CallCountStats;
  summary: ValidationSummary;
  totalRows: CallCountTotalRowCheck[];
  // True when at least one day had no year and took the selected year; the
  // year must then be confirmed before importing.
  usesSelectedYear: boolean;
  year: number;
};

const EARLIEST_DAY = "2020-01-01";
const DAY_HEADER_PATTERN = /\b(day|date)\b/i;
const TOTAL_ROW_PATTERN = /^(grand\s+)?totals?\b/i;
const TOTAL_COLUMN_PATTERN = /^(grand\s+)?(totals?|sum)\b/i;
const DAY_MONTH_PATTERN = /^(\d{1,2})[\s-]+([a-z]+)\.?(?:[\s,-]+(\d{4}|\d{2}))?$/i;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXCEL_SERIAL_PATTERN = /^\d+(\.\d+)?$/;
const SHIFT_OFFSETS = [1, -1, 2, -2, 3, -3];

const MONTH_NUMBERS = new Map<string, number>(
  [
    ["jan", "january"],
    ["feb", "february"],
    ["mar", "march"],
    ["apr", "april"],
    ["may", "may"],
    ["jun", "june"],
    ["jul", "july"],
    ["aug", "august"],
    ["sep", "september"],
    ["oct", "october"],
    ["nov", "november"],
    ["dec", "december"],
  ].flatMap(([short, long], index): Array<[string, number]> => [
    [short, index + 1],
    [long, index + 1],
  ]),
);

MONTH_NUMBERS.set("sept", 9);

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

// CSV values stay text, so a day such as "1-Sep" is never turned into a date
// by the spreadsheet library with a guessed year. Excel workbooks keep their
// real date cells.
export function readCallCountWorkbook(data: ArrayBuffer): WorkBook {
  return read(data, { raw: true, type: "array" });
}

export function isCallCountFileName(fileName: string) {
  return /\.(xlsx|csv)$/i.test(fileName);
}

export function formatCallCountDay(day: string) {
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

function getLatestAllowedDay(today: Date) {
  return toDayString(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)),
  );
}

// null when the parts are not a real calendar date (for example 31 Sep).
function toCalendarDay(year: number, month: number, dayOfMonth: number) {
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === dayOfMonth
    ? toDayString(date)
    : null;
}

function fromExcelSerial(value: Date | number) {
  const date = excelSerialDateToDate(typeof value === "number" ? Math.floor(value) : value);

  return date.value ? toDayString(date.value) : null;
}

// Accepted: an Excel date, 2026-09-01, 1-Sep-2026, 1-Sep-26, and 1-Sep (the
// year then comes from the selected year). Slash dates are refused: 1/9 could
// be 1 September or 9 January.
function parseCallDay(
  value: unknown,
  { latestAllowedDay, year }: { latestAllowedDay: string; year: number },
): { error?: string; usedSelectedYear?: boolean; value?: string } {
  let day: string | null;
  let usedSelectedYear = false;

  if (value instanceof Date || typeof value === "number") {
    day = fromExcelSerial(value);

    if (!day) {
      return { error: "Day must be a valid Excel date." };
    }
  } else {
    const text = removeExtraSpaces(String(value));
    const isoMatch = ISO_DAY_PATTERN.exec(text);
    const dayMonthMatch = DAY_MONTH_PATTERN.exec(text);

    if (EXCEL_SERIAL_PATTERN.test(text)) {
      day = fromExcelSerial(Number(text));
    } else if (isoMatch) {
      day = toCalendarDay(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    } else if (dayMonthMatch) {
      const month = MONTH_NUMBERS.get(dayMonthMatch[2].toLocaleLowerCase("en-US"));
      const yearText = dayMonthMatch[3];

      usedSelectedYear = !yearText;
      day = month
        ? toCalendarDay(
            yearText ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)) : year,
            month,
            Number(dayMonthMatch[1]),
          )
        : null;
    } else {
      return {
        error: `Day must be a date such as 1-Sep, 1-Sep-2026, 2026-09-01 or an Excel date (found "${text}").`,
      };
    }

    if (!day) {
      return { error: `"${text}" is not a valid calendar date.` };
    }
  }

  if (day < EARLIEST_DAY || day > latestAllowedDay) {
    return {
      error: `${formatCallCountDay(day)} is outside the allowed range (${formatCallCountDay(EARLIEST_DAY)} to ${formatCallCountDay(latestAllowedDay)})${
        usedSelectedYear ? "; check the selected year" : ""
      }.`,
    };
  }

  return { usedSelectedYear, value: day };
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = removeExtraSpaces(String(value ?? ""));

  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : null;
}

function sumNumbers(values: unknown[]) {
  const numbers = values.map(toNumber).filter((value): value is number => value !== null);

  return numbers.length > 0 ? numbers.reduce((total, value) => total + value, 0) : null;
}

function emptyStats(): CallCountStats {
  return {
    days: 0,
    duplicateRows: 0,
    firstDay: null,
    lastDay: null,
    pharmacistsFound: 0,
    totalCalls: 0,
    zeroCallEntries: 0,
  };
}

function blockingResult(
  sheetName: string,
  sheetRows: SheetRow[],
  reasons: string[],
  year: number,
  columns: CallCountColumn[] = [],
  ignoredColumns: IgnoredCallCountColumn[] = [],
): CallCountValidationResult {
  const invalidRows = reasons.map((reason) => ({ reason, rowNumber: 1, sheetName }));

  return {
    blankCells: [],
    columns,
    duplicateDays: [],
    hasBlockingErrors: true,
    ignoredColumns,
    invalidRows,
    monthlyTotals: [],
    records: [],
    sheetName,
    sheetRows,
    stats: { ...emptyStats(), pharmacistsFound: columns.length },
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows: 0,
      totalRows: Math.max(sheetRows.length - 1, 0),
      validRows: 0,
    },
    totalRows: [],
    usesSelectedYear: false,
    year,
  };
}

function checkTotalRow(
  row: SheetRow,
  rowNumber: number,
  columns: CallCountColumn[],
  records: CallCountRecord[],
): CallCountTotalRowCheck {
  const dailyTotals = new Map<number, number>();

  for (const record of records) {
    dailyTotals.set(record.pharmacistId, (dailyTotals.get(record.pharmacistId) ?? 0) + record.calls);
  }

  const dailyTotalOf = (column: CallCountColumn) => dailyTotals.get(column.pharmacistId) ?? 0;
  const checkedColumns = columns.map((column) => {
    const totalRowValue = toNumber(row[column.columnIndex]);

    return {
      dailyTotal: dailyTotalOf(column),
      matches: totalRowValue === dailyTotalOf(column),
      pharmacistName: column.pharmacistName,
      totalRowValue,
    };
  });
  const matches = checkedColumns.every((column) => column.matches);
  const shift =
    matches || !columns.some((column) => dailyTotalOf(column) > 0)
      ? null
      : (SHIFT_OFFSETS.find((offset) =>
          columns.every(
            (column) => toNumber(row[column.columnIndex + offset]) === dailyTotalOf(column),
          ),
        ) ?? null);

  return {
    columns: checkedColumns,
    dailyTotal: records.reduce((total, record) => total + record.calls, 0),
    label: removeExtraSpaces(String(row[0] ?? "")),
    matches,
    rowNumber,
    shift,
    totalRowSum: sumNumbers(row.slice(1)),
  };
}

type ParsedDayRow = {
  blanks: CallCountColumn[];
  counts: Array<{ calls: number; column: CallCountColumn }>;
  day?: string;
  errors: string[];
  rowNumber: number;
};

export function validateCallCountWorkbook(
  workbook: WorkBook,
  roster: CallCountRosterEntry[],
  options: { today?: Date; year: number },
): CallCountValidationResult {
  const { year } = options;
  const sheetName = workbook.SheetNames[0] ?? "First worksheet";
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;

  if (!sheet) {
    return blockingResult(sheetName, [], ["The file must contain at least one worksheet."], year);
  }

  const sheetRows = worksheetToRows(sheet);
  const headerRow = sheetRows[0] ?? [];
  const dataRows = sheetRows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }));
  const blankRows = dataRows.filter(({ row }) => row.every(isEmptyCell));
  const totalRowEntries = dataRows.filter(
    ({ row }) => !row.every(isEmptyCell) && TOTAL_ROW_PATTERN.test(removeExtraSpaces(String(row[0] ?? ""))),
  );
  const dayRows = dataRows.filter(
    (entry) => !blankRows.includes(entry) && !totalRowEntries.includes(entry),
  );
  const pharmacistsByAliasKey = new Map<string, CallCountRosterEntry>();

  for (const pharmacist of roster) {
    for (const aliasKey of pharmacist.aliasKeys) {
      pharmacistsByAliasKey.set(aliasKey, pharmacist);
    }
  }

  const columns: CallCountColumn[] = [];
  const ignoredColumns: IgnoredCallCountColumn[] = [];
  const structureErrors: string[] = [];
  const columnsByPharmacist = new Map<number, CallCountColumn>();
  const columnCount = sheetRows.reduce((total, row) => Math.max(total, row.length), 0);
  const dayHeader = isEmptyCell(headerRow[0]) ? "" : removeExtraSpaces(String(headerRow[0]));

  if (!DAY_HEADER_PATTERN.test(dayHeader)) {
    structureErrors.push(
      `Column A must be the call day; its header should contain "day" (found "${dayHeader}").`,
    );
  }

  for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
    const rawHeader = headerRow[columnIndex];
    const header = isEmptyCell(rawHeader) ? "" : removeExtraSpaces(String(rawHeader));
    const values = dayRows.map(({ row }) => row[columnIndex]).filter((value) => !isEmptyCell(value));

    if (!header) {
      if (values.length > 0) {
        ignoredColumns.push({
          calls: sumNumbers(values),
          columnIndex,
          header: `Column ${columnLetter(columnIndex)}`,
          reason: "Has values but no header name.",
        });
      }

      continue;
    }

    if (TOTAL_COLUMN_PATTERN.test(header)) {
      ignoredColumns.push({
        calls: sumNumbers(values),
        columnIndex,
        header,
        reason: "Total column: not imported.",
      });
      continue;
    }

    const pharmacist = pharmacistsByAliasKey.get(createComparisonKey(header));

    if (!pharmacist) {
      ignoredColumns.push(
        values.length > 0
          ? {
              calls: sumNumbers(values),
              columnIndex,
              header,
              reason:
                "Not in the Clinical pharmacist list. Add it as an alias in Settings > Clinical Pharmacists, then upload again.",
            }
          : { calls: null, columnIndex, header, reason: "Empty column: no counts." },
      );
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

  if (columns.length === 0) {
    structureErrors.push(
      "No column matches a Clinical pharmacist. Check the header names against Settings > Clinical Pharmacists.",
    );
  }

  if (structureErrors.length > 0) {
    return blockingResult(sheetName, sheetRows, structureErrors, year, columns, ignoredColumns);
  }

  const latestAllowedDay = getLatestAllowedDay(options.today ?? new Date());
  const parsedRows: ParsedDayRow[] = [];
  const rowsByDay = new Map<string, number[]>();
  let usesSelectedYear = false;

  for (const { row, rowNumber } of dayRows) {
    const parsedRow: ParsedDayRow = { blanks: [], counts: [], errors: [], rowNumber };

    if (isEmptyCell(row[0])) {
      parsedRow.errors.push("Day is required.");
    } else {
      const parsedDay = parseCallDay(row[0], { latestAllowedDay, year });

      if (parsedDay.error) {
        parsedRow.errors.push(parsedDay.error);
      } else if (parsedDay.value) {
        parsedRow.day = parsedDay.value;
        usesSelectedYear ||= parsedDay.usedSelectedYear === true;
        rowsByDay.set(parsedDay.value, [...(rowsByDay.get(parsedDay.value) ?? []), rowNumber]);
      }
    }

    for (const column of columns) {
      const value = row[column.columnIndex];

      if (isEmptyCell(value)) {
        parsedRow.blanks.push(column);
        continue;
      }

      const parsedCount = parseInteger(value, column.header, { minimum: 0 });

      if (parsedCount.error || parsedCount.value === undefined) {
        parsedRow.errors.push(parsedCount.error ?? `${column.header} must be an integer.`);
        continue;
      }

      parsedRow.counts.push({ calls: parsedCount.value, column });
    }

    if (parsedRow.errors.length === 0 && parsedRow.counts.length === 0) {
      parsedRow.errors.push("Every pharmacist cell is blank. Enter 0 for a pharmacist with no calls.");
    }

    parsedRows.push(parsedRow);
  }

  const duplicateDays = [...rowsByDay.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([day, rowNumbers]) => ({ day, rowNumbers }));

  for (const { day, rowNumbers } of duplicateDays) {
    for (const parsedRow of parsedRows) {
      if (parsedRow.day === day) {
        parsedRow.errors.push(
          `${formatCallCountDay(day)} appears on rows ${rowNumbers.join(", ")}. Keep one row per day.`,
        );
      }
    }
  }

  const invalidRows: InvalidWorkbookRow[] = [];
  const records: CallCountRecord[] = [];
  const blankCells: CallCountBlankCell[] = [];

  for (const parsedRow of parsedRows) {
    if (parsedRow.errors.length > 0 || !parsedRow.day) {
      invalidRows.push({
        reason: parsedRow.errors.join(" "),
        rowNumber: parsedRow.rowNumber,
        sheetName,
      });
      continue;
    }

    for (const { calls, column } of parsedRow.counts) {
      records.push({
        active: column.active,
        calls,
        day: parsedRow.day,
        pharmacistId: column.pharmacistId,
        pharmacistName: column.pharmacistName,
        pharmacistNameRaw: column.header,
      });
    }

    for (const column of parsedRow.blanks) {
      blankCells.push({
        day: parsedRow.day,
        pharmacistName: column.pharmacistName,
        rowNumber: parsedRow.rowNumber,
      });
    }
  }

  records.sort(
    (left, right) =>
      left.day.localeCompare(right.day) || left.pharmacistName.localeCompare(right.pharmacistName),
  );

  const monthlyTotalsByKey = new Map<string, CallCountMonthlyTotal>();

  for (const record of records) {
    const month = record.day.slice(0, 7);
    const key = `${month}|${record.pharmacistId}`;
    const existingTotal = monthlyTotalsByKey.get(key);

    if (existingTotal) {
      existingTotal.calls += record.calls;
    } else {
      monthlyTotalsByKey.set(key, {
        active: record.active,
        calls: record.calls,
        month,
        pharmacistName: record.pharmacistName,
      });
    }
  }

  const days = [...new Set(records.map((record) => record.day))].sort();
  const validRows = parsedRows.length - invalidRows.length;

  return {
    blankCells,
    columns,
    duplicateDays,
    hasBlockingErrors: duplicateDays.length > 0,
    ignoredColumns,
    invalidRows,
    monthlyTotals: [...monthlyTotalsByKey.values()].sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        left.pharmacistName.localeCompare(right.pharmacistName),
    ),
    records,
    sheetName,
    sheetRows,
    stats: {
      days: days.length,
      duplicateRows: duplicateDays.reduce((total, { rowNumbers }) => total + rowNumbers.length, 0),
      firstDay: days[0] ?? null,
      lastDay: days.at(-1) ?? null,
      pharmacistsFound: columns.length,
      totalCalls: records.reduce((total, record) => total + record.calls, 0),
      zeroCallEntries: records.filter((record) => record.calls === 0).length,
    },
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows: blankRows.length,
      totalRows: dataRows.length,
      validRows,
    },
    totalRows: totalRowEntries.map(({ row, rowNumber }) =>
      checkTotalRow(row, rowNumber, columns, records),
    ),
    usesSelectedYear,
    year,
  };
}
