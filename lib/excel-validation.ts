import { utils, type WorkBook, type WorkSheet } from "xlsx";

import type { AuditType } from "@/lib/audit-types";
import {
  createComparisonKey,
  normalizeIssueName,
  normalizePharmacistName,
  removeExtraSpaces,
  toTitleCase,
} from "@/lib/excel-normalization";
import {
  getWorkbookColumnValue,
  validateWorkbook as validateWorkbookColumns,
  type ColumnLookup,
  type SheetRow,
  type WorkbookColumnConfig,
} from "@/lib/workbook-column-validator";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export const CLINICAL_SHEET1_REQUIRED_COLUMNS = [
  "DAY",
  "NO OF PATIENT",
] as const;
export const CLINICAL_SHEET1_OPTIONAL_COLUMNS = [] as const;
export const CLINICAL_SHEET2_REQUIRED_COLUMNS = [
  "PHARMACIST NAME",
  "DAY",
  "ID",
  "ISSUE",
  "SCORE",
  "ISSUE IN DETAILS",
] as const;
export const CLINICAL_SHEET2_OPTIONAL_COLUMNS = [] as const;

export const NON_MEDICAL_REQUIRED_COLUMNS = [
  "Category",
  "Agent Name",
  "Issue Date",
  "Added Day",
  "Issue type",
  "Issue details",
  "Need Edit",
  "QA Agent",
  "Supervisor Comment",
] as const;
export const NON_MEDICAL_OPTIONAL_COLUMNS = [
  "Appointment Id",
  "Patient ID",
  "Screen / Voice Attached",
] as const;

export const DOCTORS_REQUIRED_COLUMNS = [
  "Category",
  "Doctor Name",
  "Consultation Date",
  "Issue Type",
  "QA Agent",
] as const;
export const DOCTORS_OPTIONAL_COLUMNS = [
  "Patient ID",
  "Attached",
  "Issue Details",
] as const;

export type WorkbookContract = {
  sheet1: WorkbookColumnConfig;
  sheet2?: WorkbookColumnConfig;
};

const WORKBOOK_CONTRACTS: Record<AuditType, WorkbookContract> = {
  clinical: {
    sheet1: {
      optionalColumns: CLINICAL_SHEET1_OPTIONAL_COLUMNS,
      requiredColumns: CLINICAL_SHEET1_REQUIRED_COLUMNS,
    },
    sheet2: {
      optionalColumns: CLINICAL_SHEET2_OPTIONAL_COLUMNS,
      requiredColumns: CLINICAL_SHEET2_REQUIRED_COLUMNS,
    },
  },
  non_medical: {
    sheet1: {
      optionalColumns: NON_MEDICAL_OPTIONAL_COLUMNS,
      requiredColumns: NON_MEDICAL_REQUIRED_COLUMNS,
    },
  },
  doctors: {
    sheet1: {
      optionalColumns: DOCTORS_OPTIONAL_COLUMNS,
      requiredColumns: DOCTORS_REQUIRED_COLUMNS,
    },
  },
};

export function getWorkbookContract(auditType: AuditType) {
  return WORKBOOK_CONTRACTS[auditType];
}

export function getTemplateColumns(config: WorkbookColumnConfig) {
  return [...config.requiredColumns, ...config.optionalColumns];
}

export type { SheetRow } from "@/lib/workbook-column-validator";

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

type PreparedWorksheet = {
  columns: ColumnLookup;
  invalidRows: InvalidWorkbookRow[];
  rows: SheetRow[];
};

type ParsedSingleSheetRow = {
  dailyPatient?: DailyPatientRecord;
  errors?: string[];
  qaError?: QaErrorRecord;
};

function worksheetToRows(sheet: WorkSheet) {
  return utils.sheet_to_json<SheetRow>(sheet, {
    blankrows: true,
    defval: "",
    header: 1,
  });
}

function isEmptyCell(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    removeExtraSpaces(String(value)) === ""
  );
}

function isEmptyRow(row: SheetRow) {
  return row.every(isEmptyCell);
}

function prepareWorksheet(
  rows: SheetRow[],
  sheetName: string,
  config: WorkbookColumnConfig,
): PreparedWorksheet {
  const validation = validateWorkbookColumns({
    optionalColumns: config.optionalColumns,
    requiredColumns: config.requiredColumns,
    rows,
  });
  const invalidRows =
    validation.missingRequiredColumns.length > 0
      ? [
          {
            reason: `Missing required column(s): ${validation.missingRequiredColumns.join(", ")}.`,
            rowNumber: 1,
            sheetName,
          },
        ]
      : [];

  return {
    columns: validation.columns,
    invalidRows,
    rows: validation.rows,
  };
}

function emptyValidationResult(
  invalidRows: InvalidWorkbookRow[],
): WorkbookValidationResult {
  return {
    dailyPatients: [],
    invalidRows,
    qaErrors: [],
    sheet1Rows: [],
    sheet2Rows: [],
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows: 0,
      totalRows: 0,
      validRows: 0,
    },
  };
}

function validateSingleSheetWorkbook({
  config,
  parseRow,
  workbook,
}: {
  config: WorkbookColumnConfig;
  parseRow: (row: SheetRow, columns: ColumnLookup) => ParsedSingleSheetRow;
  workbook: WorkBook;
}): WorkbookValidationResult {
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName
    ? workbook.Sheets[firstSheetName]
    : undefined;

  if (!firstSheet) {
    return emptyValidationResult([
      {
        reason: "The workbook must contain at least one worksheet.",
        rowNumber: 0,
        sheetName: firstSheetName ?? "First worksheet",
      },
    ]);
  }

  const prepared = prepareWorksheet(
    worksheetToRows(firstSheet),
    firstSheetName,
    config,
  );
  const dailyPatients: DailyPatientRecord[] = [];
  const qaErrors: QaErrorRecord[] = [];
  const invalidRows = [...prepared.invalidRows];
  let skippedEmptyRows = 0;
  let validRows = 0;

  if (prepared.invalidRows.length === 0) {
    for (const [index, row] of prepared.rows.slice(1).entries()) {
      const rowNumber = index + 2;

      if (isEmptyRow(row)) {
        skippedEmptyRows += 1;
        continue;
      }

      const parsedRow = parseRow(row, prepared.columns);
      const errors = parsedRow.errors ?? [];

      if (errors.length > 0) {
        invalidRows.push({
          reason: errors.join(" "),
          rowNumber,
          sheetName: firstSheetName,
        });
        continue;
      }

      if (parsedRow.dailyPatient) {
        dailyPatients.push(parsedRow.dailyPatient);
      }

      if (parsedRow.qaError) {
        qaErrors.push(parsedRow.qaError);
      }

      validRows += 1;
    }
  }

  return {
    dailyPatients,
    invalidRows,
    qaErrors,
    sheet1Rows: prepared.rows,
    sheet2Rows: [],
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows,
      totalRows: Math.max(prepared.rows.length - 1, 0),
      validRows,
    },
  };
}

function parseWorksheetDate(
  value: unknown,
  label: string,
): { error?: string; value?: Date } {
  if (isEmptyCell(value)) {
    return { error: `${label} is required.` };
  }

  const excelDate = excelSerialDateToDate(value);

  if (excelDate.value) {
    return excelDate;
  }

  const stringValue = removeExtraSpaces(String(value));

  if (
    value instanceof Date ||
    typeof value === "number" ||
    /^-?\d+(?:\.\d+)?$/.test(stringValue)
  ) {
    return { error: `${label} must be a valid Excel date.` };
  }

  const parsedDate = new Date(stringValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      error: `${label} must be a valid Excel date or calendar date.`,
    };
  }

  return {
    value: new Date(
      Date.UTC(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate(),
      ),
    ),
  };
}

function formatIssueDetails(
  row: SheetRow,
  columns: ColumnLookup,
  fields: ReadonlyArray<readonly [label: string, columnName: string]>,
) {
  return fields
    .map(
      ([label, columnName]) =>
        [label, getWorkbookColumnValue(row, columns, columnName)] as const,
    )
    .filter(([, value]) => !isEmptyCell(value))
    .map(([label, value]) => `${label}: ${removeExtraSpaces(String(value))}`)
    .join(" | ");
}

function parseDoctorsRow(
  row: SheetRow,
  columns: ColumnLookup,
): ParsedSingleSheetRow {
  const categoryValue = getWorkbookColumnValue(row, columns, "Category");
  const rawDoctorName = getWorkbookColumnValue(row, columns, "Doctor Name");
  const consultationDateValue = getWorkbookColumnValue(
    row,
    columns,
    "Consultation Date",
  );
  const patientIdValue = getWorkbookColumnValue(row, columns, "Patient ID");
  const issueTypeValue = getWorkbookColumnValue(row, columns, "Issue Type");
  const qaAgentValue = getWorkbookColumnValue(row, columns, "QA Agent");
  const consultationDate = parseWorksheetDate(
    consultationDateValue,
    "Consultation Date",
  );
  const errors: string[] = [];

  if (isEmptyCell(categoryValue)) {
    errors.push("Category is required.");
  }

  if (isEmptyCell(rawDoctorName)) {
    errors.push("Doctor Name is required.");
  }

  if (consultationDate.error) {
    errors.push(consultationDate.error);
  }

  if (isEmptyCell(issueTypeValue)) {
    errors.push("Issue Type is required.");
  }

  if (isEmptyCell(qaAgentValue)) {
    errors.push("QA Agent is required.");
  }

  if (errors.length > 0 || !consultationDate.value) {
    return { errors };
  }

  const doctorNameRaw = removeExtraSpaces(String(rawDoctorName));

  return {
    dailyPatient: {
      day: consultationDate.value,
      patientCount: 1,
    },
    qaError: {
      day: consultationDate.value,
      issueDetails: formatIssueDetails(row, columns, [
        ["Issue Details", "Issue Details"],
        ["Category", "Category"],
        ["Attached", "Attached"],
        ["QA Agent", "QA Agent"],
      ]),
      issueType: normalizeIssueName(String(issueTypeValue)),
      patientId: isEmptyCell(patientIdValue)
        ? ""
        : removeExtraSpaces(String(patientIdValue)),
      pharmacistName: toTitleCase(doctorNameRaw),
      pharmacistNameRaw: doctorNameRaw,
      score: 1,
    },
  };
}

function isAffirmative(value: unknown) {
  const normalizedValue = createComparisonKey(String(value ?? ""));

  return ["1", "true", "yes", "y"].includes(normalizedValue);
}

function parseNonMedicalRow(
  row: SheetRow,
  columns: ColumnLookup,
): ParsedSingleSheetRow {
  const rawAgentName = getWorkbookColumnValue(row, columns, "Agent Name");
  const issueDateValue = getWorkbookColumnValue(row, columns, "Issue Date");
  const appointmentIdValue = getWorkbookColumnValue(
    row,
    columns,
    "Appointment Id",
  );
  const patientIdValue = getWorkbookColumnValue(row, columns, "Patient ID");
  const issueTypeValue = getWorkbookColumnValue(row, columns, "Issue type");
  const needEditValue = getWorkbookColumnValue(row, columns, "Need Edit");
  const issueDate = parseWorksheetDate(issueDateValue, "Issue Date");
  const errors: string[] = [];

  if (isEmptyCell(rawAgentName)) {
    errors.push("Agent Name is required.");
  }

  if (issueDate.error) {
    errors.push(issueDate.error);
  }

  if (errors.length > 0 || !issueDate.value) {
    return { errors };
  }

  const agentNameRaw = removeExtraSpaces(String(rawAgentName));
  const appointmentId = isEmptyCell(appointmentIdValue)
    ? ""
    : removeExtraSpaces(String(appointmentIdValue));
  const parsedRow: ParsedSingleSheetRow = {
    dailyPatient: {
      day: issueDate.value,
      patientCount: 1,
    },
  };

  if (!isEmptyCell(issueTypeValue)) {
    parsedRow.qaError = {
      day: issueDate.value,
      issueDetails: formatIssueDetails(row, columns, [
        ["Issue details", "Issue details"],
        ["Category", "Category"],
        ["Screen / Voice Attached", "Screen / Voice Attached"],
        ["Added Day", "Added Day"],
        ["Need Edit", "Need Edit"],
        ["QA Agent", "QA Agent"],
        ["Supervisor Comment", "Supervisor Comment"],
      ]),
      issueType: normalizeIssueName(String(issueTypeValue)),
      patientId: isEmptyCell(patientIdValue)
        ? appointmentId
        : removeExtraSpaces(String(patientIdValue)),
      pharmacistName: toTitleCase(agentNameRaw),
      pharmacistNameRaw: agentNameRaw,
      score: isAffirmative(needEditValue) ? 1 : 0,
    };
  }

  return parsedRow;
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
    typeof value === "number"
      ? value
      : Number(removeExtraSpaces(String(value)));

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

function parseClinicalRecordId(value: unknown) {
  if (isEmptyCell(value)) {
    return { error: "ID is required." };
  }

  const recordId = removeExtraSpaces(String(value));

  if (!Number.isFinite(Number(recordId))) {
    return { error: "ID must be numeric." };
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
    typeof value === "number"
      ? value
      : Number(removeExtraSpaces(String(value)));

  if (
    !Number.isFinite(serialDate) ||
    !Number.isInteger(serialDate) ||
    serialDate <= 0
  ) {
    return { error: "DAY must be a valid Excel serial date." };
  }

  return {
    value: new Date(EXCEL_EPOCH_UTC + serialDate * MILLISECONDS_PER_DAY),
  };
}

function validateClinicalDailyPatientRows(
  prepared: PreparedWorksheet,
): {
  dailyPatients: DailyPatientRecord[];
  invalidRows: InvalidWorkbookRow[];
  skippedEmptyRows: number;
} {
  const dailyPatients: DailyPatientRecord[] = [];
  const invalidRows: InvalidWorkbookRow[] = [];
  let skippedEmptyRows = 0;

  for (const [index, row] of prepared.rows.slice(1).entries()) {
    const rowNumber = index + 2;
    const dayValue = getWorkbookColumnValue(row, prepared.columns, "DAY");
    const patientCountValue = getWorkbookColumnValue(
      row,
      prepared.columns,
      "NO OF PATIENT",
    );

    if (
      isEmptyRow(row) ||
      (isEmptyCell(patientCountValue) && !isEmptyCell(dayValue))
    ) {
      skippedEmptyRows += 1;
      continue;
    }

    const errors: string[] = [];
    const day = excelSerialDateToDate(dayValue);
    const patientCount = parseInteger(patientCountValue, "NO OF PATIENT", {
      minimum: 0,
    });

    if (day.error) {
      errors.push(day.error);
    }

    if (patientCount.error) {
      errors.push(patientCount.error);
    }

    if (errors.length > 0 || !day.value || patientCount.value === undefined) {
      invalidRows.push({
        reason: errors.join(" "),
        rowNumber,
        sheetName: "Sheet1",
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

function validateClinicalQaErrorRows(
  prepared: PreparedWorksheet,
): {
  invalidRows: InvalidWorkbookRow[];
  qaErrors: QaErrorRecord[];
  skippedEmptyRows: number;
} {
  const qaErrors: QaErrorRecord[] = [];
  const invalidRows: InvalidWorkbookRow[] = [];
  let skippedEmptyRows = 0;

  for (const [index, row] of prepared.rows.slice(1).entries()) {
    const rowNumber = index + 2;

    if (isEmptyRow(row)) {
      skippedEmptyRows += 1;
      continue;
    }

    const errors: string[] = [];
    const rawPharmacistName = getWorkbookColumnValue(
      row,
      prepared.columns,
      "PHARMACIST NAME",
    );
    const dayValue = getWorkbookColumnValue(row, prepared.columns, "DAY");
    const patientIdValue = getWorkbookColumnValue(
      row,
      prepared.columns,
      "ID",
    );
    const issueValue = getWorkbookColumnValue(
      row,
      prepared.columns,
      "ISSUE",
    );
    const scoreValue = getWorkbookColumnValue(
      row,
      prepared.columns,
      "SCORE",
    );
    const issueDetailsValue = getWorkbookColumnValue(
      row,
      prepared.columns,
      "ISSUE IN DETAILS",
    );
    const day = excelSerialDateToDate(dayValue);
    const patientId = parseClinicalRecordId(patientIdValue);
    const score = parseInteger(scoreValue, "SCORE", { minimum: 0 });

    if (isEmptyCell(rawPharmacistName)) {
      errors.push("PHARMACIST NAME is required.");
    }

    if (day.error) {
      errors.push(day.error);
    }

    if (patientId.error) {
      errors.push(patientId.error);
    }

    if (isEmptyCell(issueValue)) {
      errors.push("ISSUE is required.");
    }

    if (score.error) {
      errors.push(score.error);
    }

    if (
      errors.length > 0 ||
      !day.value ||
      !patientId.value ||
      score.value === undefined
    ) {
      invalidRows.push({
        reason: errors.join(" "),
        rowNumber,
        sheetName: "Sheet2",
      });
      continue;
    }

    const pharmacistNameRaw = removeExtraSpaces(String(rawPharmacistName));

    qaErrors.push({
      day: day.value,
      issueDetails: isEmptyCell(issueDetailsValue)
        ? ""
        : removeExtraSpaces(String(issueDetailsValue)),
      issueType: normalizeIssueName(String(issueValue)),
      patientId: patientId.value,
      pharmacistName: normalizePharmacistName(pharmacistNameRaw),
      pharmacistNameRaw,
      score: score.value,
    });
  }

  return { invalidRows, qaErrors, skippedEmptyRows };
}

function validateClinicalWorkbook(workbook: WorkBook): WorkbookValidationResult {
  const contract = getWorkbookContract("clinical");
  const missingSheetErrors: InvalidWorkbookRow[] = [];

  if (!workbook.Sheets.Sheet1) {
    missingSheetErrors.push({
      reason: "Sheet1 is missing.",
      rowNumber: 0,
      sheetName: "Sheet1",
    });
  }

  if (!workbook.Sheets.Sheet2) {
    missingSheetErrors.push({
      reason: "Sheet2 is missing.",
      rowNumber: 0,
      sheetName: "Sheet2",
    });
  }

  const preparedSheet1 = workbook.Sheets.Sheet1
    ? prepareWorksheet(
        worksheetToRows(workbook.Sheets.Sheet1),
        "Sheet1",
        contract.sheet1,
      )
    : { columns: new Map(), invalidRows: [], rows: [] };
  const preparedSheet2 =
    workbook.Sheets.Sheet2 && contract.sheet2
      ? prepareWorksheet(
          worksheetToRows(workbook.Sheets.Sheet2),
          "Sheet2",
          contract.sheet2,
        )
      : { columns: new Map(), invalidRows: [], rows: [] };
  const structureErrors = [
    ...missingSheetErrors,
    ...preparedSheet1.invalidRows,
    ...preparedSheet2.invalidRows,
  ];
  const canValidateRows = structureErrors.length === 0;
  const dailyPatientsValidation = canValidateRows
    ? validateClinicalDailyPatientRows(preparedSheet1)
    : { dailyPatients: [], invalidRows: [], skippedEmptyRows: 0 };
  const qaErrorsValidation = canValidateRows
    ? validateClinicalQaErrorRows(preparedSheet2)
    : { invalidRows: [], qaErrors: [], skippedEmptyRows: 0 };
  const invalidRows = [
    ...structureErrors,
    ...dailyPatientsValidation.invalidRows,
    ...qaErrorsValidation.invalidRows,
  ];

  return {
    dailyPatients: dailyPatientsValidation.dailyPatients,
    invalidRows,
    qaErrors: qaErrorsValidation.qaErrors,
    sheet1Rows: preparedSheet1.rows,
    sheet2Rows: preparedSheet2.rows,
    summary: {
      invalidRows: invalidRows.length,
      skippedEmptyRows:
        dailyPatientsValidation.skippedEmptyRows +
        qaErrorsValidation.skippedEmptyRows,
      totalRows:
        Math.max(preparedSheet1.rows.length - 1, 0) +
        Math.max(preparedSheet2.rows.length - 1, 0),
      validRows:
        dailyPatientsValidation.dailyPatients.length +
        qaErrorsValidation.qaErrors.length,
    },
  };
}

export function validateQaWorkbook(
  workbook: WorkBook,
  auditType: AuditType,
): WorkbookValidationResult {
  const contract = getWorkbookContract(auditType);

  if (auditType === "clinical") {
    return validateClinicalWorkbook(workbook);
  }

  return validateSingleSheetWorkbook({
    config: contract.sheet1,
    parseRow:
      auditType === "non_medical" ? parseNonMedicalRow : parseDoctorsRow,
    workbook,
  });
}
