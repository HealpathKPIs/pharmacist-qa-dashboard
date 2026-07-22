import { utils, type WorkBook, type WorkSheet } from "xlsx";

import type { AuditType } from "@/lib/audit-types";
import {
  createComparisonKey,
  normalizeIssueName,
  normalizePharmacistName,
  removeExtraSpaces,
  toTitleCase,
} from "@/lib/excel-normalization";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

const REQUIRED_SHEET_NAMES = ["Sheet1", "Sheet2"] as const;

export type WorkbookContract = {
  actorColumn: string;
  idColumn: string;
  idMustBeNumeric: boolean;
  scoreColumn: string;
  scoreMaximum?: number;
  sheet1Columns: readonly string[];
  sheet2Columns: readonly string[];
  workloadColumn: string;
};

const WORKBOOK_CONTRACTS: Record<AuditType, WorkbookContract> = {
  clinical: {
    actorColumn: "PHARMACIST NAME",
    idColumn: "ID",
    idMustBeNumeric: true,
    scoreColumn: "SCORE",
    sheet1Columns: ["DAY", "NO OF PATIENT"],
    sheet2Columns: [
      "PHARMACIST NAME",
      "DAY",
      "ID",
      "ISSUE",
      "SCORE",
      "ISSUE IN DETAILS",
    ],
    workloadColumn: "NO OF PATIENT",
  },
  non_medical: {
    actorColumn: "AGENT NAME",
    idColumn: "CASE ID",
    idMustBeNumeric: false,
    scoreColumn: "SEVERITY SCORE",
    scoreMaximum: 100,
    sheet1Columns: ["DAY", "CASES REVIEWED"],
    sheet2Columns: [
      "AGENT NAME",
      "DAY",
      "CASE ID",
      "ISSUE",
      "SEVERITY SCORE",
      "ISSUE IN DETAILS",
    ],
    workloadColumn: "CASES REVIEWED",
  },
};

export function getWorkbookContract(auditType: AuditType) {
  return WORKBOOK_CONTRACTS[auditType];
}

export type SheetRow = unknown[];

export type DailyPatientRecord = {
  day: Date;
  patientCount: number;
};

export type QaErrorRecord = {
  pharmacistName: string;
  pharmacistNameRaw: string;
  day: Date;
  patientId: string;
  issueType: string;
  score: number;
  issueDetails: string;
};

export type InvalidWorkbookRow = {
  sheetName: string;
  rowNumber: number;
  reason: string;
};

export type ValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedEmptyRows: number;
};

export type WorkbookValidationResult = {
  sheet1Rows: SheetRow[];
  sheet2Rows: SheetRow[];
  dailyPatients: DailyPatientRecord[];
  qaErrors: QaErrorRecord[];
  invalidRows: InvalidWorkbookRow[];
  summary: ValidationSummary;
};

type ColumnLookup = Map<string, number>;

function normalizeHeader(value: unknown) {
  return createComparisonKey(String(value ?? "")).toLocaleUpperCase("en-US");
}

function worksheetToRows(sheet: WorkSheet) {
  return utils.sheet_to_json<SheetRow>(sheet, {
    blankrows: true,
    defval: "",
    header: 1,
  });
}

function isEmptyCell(value: unknown) {
  return value === null || value === undefined || removeExtraSpaces(String(value)) === "";
}

function isEmptyRow(row: SheetRow) {
  return row.every(isEmptyCell);
}

function buildColumnLookup(headerRow: SheetRow) {
  return headerRow.reduce<ColumnLookup>((columns, header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader) {
      columns.set(normalizedHeader, index);
    }

    return columns;
  }, new Map());
}

function getMissingColumns(columns: ColumnLookup, requiredColumns: readonly string[]) {
  return requiredColumns.filter((column) => !columns.has(normalizeHeader(column)));
}

function getRequiredValue(
  row: SheetRow,
  columns: ColumnLookup,
  columnName: string,
) {
  const columnIndex = columns.get(normalizeHeader(columnName));
  return columnIndex === undefined ? "" : row[columnIndex];
}

function parseInteger(
  value: unknown,
  label: string,
  options?: { maximum?: number; minimum?: number },
) {
  if (isEmptyCell(value)) {
    return { error: `${label} is required.` };
  }

  const numericValue =
    typeof value === "number" ? value : Number(removeExtraSpaces(String(value)));

  if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue)) {
    return { error: `${label} must be an integer.` };
  }

  if (options?.minimum !== undefined && numericValue < options.minimum) {
    return { error: `${label} must be ${options.minimum} or greater.` };
  }

  if (options?.maximum !== undefined && numericValue > options.maximum) {
    return { error: `${label} must be ${options.maximum} or less.` };
  }

  return { value: numericValue };
}

function parseRecordId(value: unknown, contract: WorkbookContract) {
  if (isEmptyCell(value)) {
    return { error: `${contract.idColumn} is required.` };
  }

  const recordId = removeExtraSpaces(String(value));

  if (contract.idMustBeNumeric && !Number.isFinite(Number(recordId))) {
    return { error: `${contract.idColumn} must be numeric.` };
  }

  return { value: recordId };
}

export function excelSerialDateToDate(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { error: "DAY must be a valid date." };
    }

    return {
      value: new Date(
        Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
      ),
    };
  }

  if (isEmptyCell(value)) {
    return { error: "DAY is required." };
  }

  const serialDate =
    typeof value === "number" ? value : Number(removeExtraSpaces(String(value)));

  if (!Number.isFinite(serialDate) || !Number.isInteger(serialDate) || serialDate <= 0) {
    return { error: "DAY must be a valid Excel serial date." };
  }

  return { value: new Date(EXCEL_EPOCH_UTC + serialDate * MILLISECONDS_PER_DAY) };
}

function collectSheetStructureErrors(
  workbook: WorkBook,
  sheet1Rows: SheetRow[],
  sheet2Rows: SheetRow[],
  contract: WorkbookContract,
) {
  const invalidRows: InvalidWorkbookRow[] = [];

  for (const sheetName of REQUIRED_SHEET_NAMES) {
    if (!workbook.Sheets[sheetName]) {
      invalidRows.push({
        sheetName,
        rowNumber: 0,
        reason: `${sheetName} is missing.`,
      });
    }
  }

  if (workbook.Sheets.Sheet1) {
    const sheet1Columns = buildColumnLookup(sheet1Rows[0] ?? []);
    const missingColumns = getMissingColumns(sheet1Columns, contract.sheet1Columns);

    if (missingColumns.length > 0) {
      invalidRows.push({
        sheetName: "Sheet1",
        rowNumber: 1,
        reason: `Missing required column(s): ${missingColumns.join(", ")}.`,
      });
    }
  }

  if (workbook.Sheets.Sheet2) {
    const sheet2Columns = buildColumnLookup(sheet2Rows[0] ?? []);
    const missingColumns = getMissingColumns(sheet2Columns, contract.sheet2Columns);

    if (missingColumns.length > 0) {
      invalidRows.push({
        sheetName: "Sheet2",
        rowNumber: 1,
        reason: `Missing required column(s): ${missingColumns.join(", ")}.`,
      });
    }
  }

  return invalidRows;
}

function validateDailyPatientsRows(rows: SheetRow[], contract: WorkbookContract) {
  const dailyPatients: DailyPatientRecord[] = [];
  const invalidRows: InvalidWorkbookRow[] = [];
  let skippedEmptyRows = 0;
  const columns = buildColumnLookup(rows[0] ?? []);

  for (const [index, row] of rows.slice(1).entries()) {
    const rowNumber = index + 2;
    const dayValue = getRequiredValue(row, columns, "DAY");
    const patientCountValue = getRequiredValue(row, columns, contract.workloadColumn);

    if (isEmptyRow(row) || (isEmptyCell(patientCountValue) && !isEmptyCell(dayValue))) {
      skippedEmptyRows += 1;
      continue;
    }

    const rowErrors: string[] = [];
    const day = excelSerialDateToDate(dayValue);
    const patientCount = parseInteger(patientCountValue, contract.workloadColumn, {
      minimum: 0,
    });

    if (day.error) {
      rowErrors.push(day.error);
    }

    if (patientCount.error) {
      rowErrors.push(patientCount.error);
    }

    if (rowErrors.length > 0 || !day.value || patientCount.value === undefined) {
      invalidRows.push({
        sheetName: "Sheet1",
        rowNumber,
        reason: rowErrors.join(" "),
      });
      continue;
    }

    dailyPatients.push({
      day: day.value,
      patientCount: patientCount.value,
    });
  }

  return { dailyPatients, invalidRows, skippedEmptyRows };
}

function validateQaErrorRows(
  rows: SheetRow[],
  auditType: AuditType,
  contract: WorkbookContract,
) {
  const qaErrors: QaErrorRecord[] = [];
  const invalidRows: InvalidWorkbookRow[] = [];
  let skippedEmptyRows = 0;
  const columns = buildColumnLookup(rows[0] ?? []);

  for (const [index, row] of rows.slice(1).entries()) {
    const rowNumber = index + 2;

    if (isEmptyRow(row)) {
      skippedEmptyRows += 1;
      continue;
    }

    const rowErrors: string[] = [];
    const rawPharmacistName = getRequiredValue(row, columns, contract.actorColumn);
    const dayValue = getRequiredValue(row, columns, "DAY");
    const patientIdValue = getRequiredValue(row, columns, contract.idColumn);
    const issueValue = getRequiredValue(row, columns, "ISSUE");
    const scoreValue = getRequiredValue(row, columns, contract.scoreColumn);
    const issueDetailsValue = getRequiredValue(row, columns, "ISSUE IN DETAILS");

    const day = excelSerialDateToDate(dayValue);
    const patientId = parseRecordId(patientIdValue, contract);
    const score = parseInteger(scoreValue, contract.scoreColumn, {
      maximum: contract.scoreMaximum,
      minimum: 0,
    });

    if (isEmptyCell(rawPharmacistName)) {
      rowErrors.push(`${contract.actorColumn} is required.`);
    }

    if (day.error) {
      rowErrors.push(day.error);
    }

    if (patientId.error) {
      rowErrors.push(patientId.error);
    }

    if (isEmptyCell(issueValue)) {
      rowErrors.push("ISSUE is required.");
    }

    if (score.error) {
      rowErrors.push(score.error);
    }

    if (rowErrors.length > 0 || !day.value || !patientId.value || score.value === undefined) {
      invalidRows.push({
        sheetName: "Sheet2",
        rowNumber,
        reason: rowErrors.join(" "),
      });
      continue;
    }

    const pharmacistNameRaw = removeExtraSpaces(String(rawPharmacistName));
    const issueType = normalizeIssueName(String(issueValue));

    qaErrors.push({
      pharmacistName:
        auditType === "clinical"
          ? normalizePharmacistName(pharmacistNameRaw)
          : toTitleCase(pharmacistNameRaw),
      pharmacistNameRaw,
      day: day.value,
      patientId: patientId.value,
      issueType,
      score: score.value,
      issueDetails: isEmptyCell(issueDetailsValue)
        ? ""
        : removeExtraSpaces(String(issueDetailsValue)),
    });
  }

  return { qaErrors, invalidRows, skippedEmptyRows };
}

export function validateWorkbook(
  workbook: WorkBook,
  auditType: AuditType,
): WorkbookValidationResult {
  const contract = getWorkbookContract(auditType);
  const sheet1Rows = workbook.Sheets.Sheet1
    ? worksheetToRows(workbook.Sheets.Sheet1)
    : [];
  const sheet2Rows = workbook.Sheets.Sheet2
    ? worksheetToRows(workbook.Sheets.Sheet2)
    : [];
  const structureErrors = collectSheetStructureErrors(
    workbook,
    sheet1Rows,
    sheet2Rows,
    contract,
  );
  const canValidateRows = structureErrors.length === 0;
  const dailyPatientsValidation = canValidateRows
    ? validateDailyPatientsRows(sheet1Rows, contract)
    : { dailyPatients: [], invalidRows: [], skippedEmptyRows: 0 };
  const qaErrorsValidation = canValidateRows
    ? validateQaErrorRows(sheet2Rows, auditType, contract)
    : { qaErrors: [], invalidRows: [], skippedEmptyRows: 0 };
  const invalidRows = [
    ...structureErrors,
    ...dailyPatientsValidation.invalidRows,
    ...qaErrorsValidation.invalidRows,
  ];
  const totalRows = Math.max(sheet1Rows.length - 1, 0) + Math.max(sheet2Rows.length - 1, 0);
  const validRows =
    dailyPatientsValidation.dailyPatients.length + qaErrorsValidation.qaErrors.length;
  const skippedEmptyRows =
    dailyPatientsValidation.skippedEmptyRows + qaErrorsValidation.skippedEmptyRows;

  return {
    sheet1Rows,
    sheet2Rows,
    dailyPatients: dailyPatientsValidation.dailyPatients,
    qaErrors: qaErrorsValidation.qaErrors,
    invalidRows,
    summary: {
      totalRows,
      validRows,
      invalidRows: invalidRows.length,
      skippedEmptyRows,
    },
  };
}
