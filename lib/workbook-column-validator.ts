import { createComparisonKey } from "@/lib/excel-normalization";

export type SheetRow = unknown[];
export type ColumnLookup = Map<string, number>;

export type WorkbookColumnConfig = {
  requiredColumns: readonly string[];
  optionalColumns: readonly string[];
};

export type WorkbookColumnValidationInput = WorkbookColumnConfig & {
  rows: SheetRow[];
};

export type WorkbookColumnValidationResult = {
  columns: ColumnLookup;
  missingRequiredColumns: string[];
  rows: SheetRow[];
};

export function normalizeWorkbookHeader(value: unknown) {
  return createComparisonKey(String(value ?? "")).toLocaleUpperCase("en-US");
}

function buildColumnLookup(headerRow: SheetRow) {
  return headerRow.reduce<ColumnLookup>((columns, header, index) => {
    const normalizedHeader = normalizeWorkbookHeader(header);

    if (normalizedHeader) {
      columns.set(normalizedHeader, index);
    }

    return columns;
  }, new Map());
}

export function getWorkbookColumnValue(
  row: SheetRow,
  columns: ColumnLookup,
  columnName: string,
) {
  const columnIndex = columns.get(normalizeWorkbookHeader(columnName));

  return columnIndex === undefined ? "" : (row[columnIndex] ?? "");
}

export function validateWorkbook({
  optionalColumns,
  requiredColumns,
  rows,
}: WorkbookColumnValidationInput): WorkbookColumnValidationResult {
  const normalizedRows = rows.length > 0 ? rows.map((row) => [...row]) : [[]];
  const headerRow = normalizedRows[0];
  const columns = buildColumnLookup(headerRow);
  const missingRequiredColumns = requiredColumns.filter(
    (column) => !columns.has(normalizeWorkbookHeader(column)),
  );

  for (const optionalColumn of optionalColumns) {
    const normalizedHeader = normalizeWorkbookHeader(optionalColumn);

    if (columns.has(normalizedHeader)) {
      continue;
    }

    const columnIndex = headerRow.length;

    headerRow.push(optionalColumn);
    columns.set(normalizedHeader, columnIndex);

    for (const row of normalizedRows.slice(1)) {
      row[columnIndex] = "";
    }
  }

  return {
    columns,
    missingRequiredColumns,
    rows: normalizedRows,
  };
}
