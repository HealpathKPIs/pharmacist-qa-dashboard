"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Table2,
  UploadCloud,
  X,
} from "lucide-react";
import { read } from "xlsx";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import type { SheetRow, WorkbookValidationResult } from "@/lib/excel-validation";
import { excelSerialDateToDate, validateWorkbook } from "@/lib/excel-validation";
import { cn } from "@/lib/utils";

type ImportUploadResult = {
  sourceFile: string;
  status: "success" | "partial" | "failed";
  totalProcessed: number;
  successfullyInserted: number;
  failed: number;
  skipped: number;
  insertedDailyPatients: number;
  insertedQaErrors: number;
  failedDailyPatients: number;
  failedQaErrors: number;
  failedValidationRows: number;
  uploadBatchId: number | null;
  errors: string[];
};

function isXlsxFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function isDayColumn(header: unknown) {
  return String(header ?? "").trim().toLocaleUpperCase("en-US") === "DAY";
}

function formatCellValue(value: unknown, options?: { dateColumn?: boolean }) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (options?.dateColumn) {
    const date = excelSerialDateToDate(value);

    if (date.value) {
      return formatDate(date.value);
    }
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
}

function getColumnCount(rows: SheetRow[]) {
  return Math.max(1, ...rows.slice(0, 5).map((row) => row.length));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(value);
}

function PreviewTable({
  rows,
  sheetName,
}: {
  rows: SheetRow[];
  sheetName: string;
}) {
  const previewRows = rows.slice(0, 5);
  const headerRow = rows[0] ?? [];
  const columnCount = getColumnCount(previewRows);

  return (
    <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-white">{sheetName}</h3>
        <p className="font-mono text-xs text-zinc-500">{rows.length} rows</p>
      </div>
      {previewRows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="min-w-full border-collapse text-left text-sm">
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr className="border-b border-white/10 last:border-b-0" key={rowIndex}>
                  {Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <td
                      className="max-w-64 border-r border-white/10 px-3 py-2 text-zinc-300 last:border-r-0"
                      key={columnIndex}
                    >
                      <span className="line-clamp-2 break-words">
                        {formatCellValue(row[columnIndex], {
                          dateColumn: rowIndex > 0 && isDayColumn(headerRow[columnIndex]),
                        })}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
          No rows found.
        </div>
      )}
    </div>
  );
}

function ValidationSummary({ result }: { result: WorkbookValidationResult }) {
  const summaryItems = [
    {
      label: "Total rows",
      value: result.summary.totalRows,
    },
    {
      label: "Valid rows",
      value: result.summary.validRows,
    },
    {
      label: "Invalid rows",
      value: result.summary.invalidRows,
    },
    {
      label: "Skipped empty rows",
      value: result.summary.skippedEmptyRows,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {summaryItems.map((item) => (
        <div
          className="rounded-md border border-white/10 bg-black/20 p-4"
          key={item.label}
        >
          <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function CleanDatasetSummary({
  auditType,
  result,
}: {
  auditType: AuditType;
  result: WorkbookValidationResult;
}) {
  const moduleConfig = getAuditModule(auditType);
  const readyItems = [
    {
      label: `${moduleConfig.workloadLabel} Ready`,
      value: result.dailyPatients.length,
      icon: Database,
    },
    {
      label: "QA Errors Ready",
      value: result.qaErrors.length,
      icon: Table2,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {readyItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            className="flex items-center justify-between gap-4 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3"
            key={item.label}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
              <span className="truncate text-sm font-medium text-emerald-50">
                {item.label}
              </span>
            </div>
            <span className="font-mono text-lg font-semibold text-white">
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InvalidRowsTable({ result }: { result: WorkbookValidationResult }) {
  if (result.invalidRows.length === 0) {
    return (
      <Alert className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-300" />
        <AlertDescription>No invalid rows detected.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <AlertCircle aria-hidden="true" className="h-4 w-4 text-red-300" />
        <h3 className="text-sm font-medium text-white">Invalid Rows</h3>
      </div>
      <div className="overflow-x-auto rounded-md border border-white/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-normal text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Sheet</th>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {result.invalidRows.map((row, index) => (
              <tr
                className="border-t border-white/10 text-zinc-300"
                key={`${row.sheetName}-${row.rowNumber}-${index}`}
              >
                <td className="whitespace-nowrap px-3 py-2">{row.sheetName}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {row.rowNumber === 0 ? "-" : row.rowNumber}
                </td>
                <td className="min-w-80 px-3 py-2 text-zinc-400">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadResultSummary({ result }: { result: ImportUploadResult }) {
  const summaryItems = [
    {
      label: "Total processed",
      value: result.totalProcessed,
    },
    {
      label: "Successfully inserted",
      value: result.successfullyInserted,
    },
    {
      label: "Failed",
      value: result.failed,
    },
    {
      label: "Skipped",
      value: result.skipped,
    },
  ];

  return (
    <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-white">Upload Result</h3>
        <span className="font-mono text-xs uppercase tracking-normal text-emerald-300">
          {result.status}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            className="rounded-md border border-white/10 bg-white/[0.03] p-3"
            key={item.label}
          >
            <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>
      {result.errors.length > 0 ? (
        <div className="space-y-2 rounded-md border border-red-300/20 bg-red-300/[0.06] p-3">
          {result.errors.map((message, index) => (
            <p className="text-sm text-red-100" key={`${message}-${index}`}>
              {message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function UploadDropzone({ auditType }: { auditType: AuditType }) {
  const moduleConfig = getAuditModule(auditType);
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<WorkbookValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<ImportUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(file: File | undefined) {
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isXlsxFile(file)) {
      const message = "Select an Excel workbook with the .xlsx file extension.";

      setSelectedFile(null);
      setError(message);
      toast({
        description: message,
        title: "Unsupported file",
        variant: "destructive",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0]);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function parseSelectedFile() {
    if (!selectedFile) {
      return;
    }

    setIsParsing(true);
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);

    try {
      const workbook = read(await selectedFile.arrayBuffer(), { type: "array" });
      const result = validateWorkbook(workbook, auditType);

      setValidationResult(result);
      toast({
        description: `${result.summary.validRows} valid rows, ${result.summary.invalidRows} invalid rows, ${result.summary.skippedEmptyRows} skipped rows.`,
        title: "Workbook validated",
        variant: result.summary.invalidRows > 0 ? "default" : "success",
      });
    } catch {
      const message =
        "The workbook could not be parsed. Confirm it is a valid .xlsx file and try again.";

      setError(message);
      toast({
        description: message,
        title: "Validation failed",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  }

  async function importSelectedFile() {
    if (!selectedFile || !validationResult) {
      return;
    }

    setIsImporting(true);
    setUploadResult(null);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("auditType", auditType);
      const response = await fetch("/api/upload/import", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json()) as {
        result?: ImportUploadResult;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        const message =
          payload.error ??
          "The workbook could not be imported. Review the upload result and try again.";

        setImportError(message);
        toast({
          description: message,
          title: "Import failed",
          variant: "destructive",
        });
        return;
      }

      setUploadResult(payload.result);
      toast({
        description: `${payload.result.successfullyInserted} inserted, ${payload.result.failed} failed, ${payload.result.skipped} skipped.`,
        title:
          payload.result.status === "success"
            ? "Import complete"
            : "Import completed with issues",
        variant: payload.result.status === "success" ? "success" : "default",
      });
    } catch {
      const message =
        "The workbook could not be imported. Check the database connection and try again.";

      setImportError(message);
      toast({
        description: message,
        title: "Import failed",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-white">{moduleConfig.moduleLabel} Excel Import</CardTitle>
        <CardDescription>
          {auditType === "non_medical"
            ? "Headers are read from row 1 of the first worksheet; data begins on row 2."
            : `Use the ${moduleConfig.moduleLabel} template to preview and validate Sheet1 and Sheet2.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-emerald-400/30 bg-emerald-400/[0.03] px-6 py-10 text-center transition-colors hover:border-emerald-300/60 hover:bg-emerald-400/[0.06]"
          htmlFor={`${auditType}-excel-file`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
            <UploadCloud aria-hidden="true" className="h-7 w-7" />
          </span>
          <span className="text-base font-medium text-white">
            Drag and drop an Excel file here
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
            Choose the {moduleConfig.moduleLabel} workbook you want to validate. Its
            columns and validation rules are isolated from the other QA product.
          </span>
          <span
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-6 border-white/15 bg-white/5 text-white hover:bg-white/10",
            )}
          >
            Choose File
          </span>
          <input
            className="sr-only"
            id={`${auditType}-excel-file`}
            name="excel-file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
        </label>

        <div className="flex flex-col gap-4 rounded-md border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-300"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Selected file</p>
              <p className="truncate text-sm text-zinc-400">
                {selectedFile?.name ?? "No file selected"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-white/15 bg-white/5 text-white hover:bg-white/10",
              )}
              href={`/api/upload/template?auditType=${auditType}`}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Download Template
            </a>
            <Button
              disabled={!selectedFile || isParsing || isImporting}
              onClick={parseSelectedFile}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isParsing ? "Validating" : "Validate Workbook"}
            </Button>
            <Button
              disabled={!selectedFile || !validationResult || isParsing || isImporting}
              onClick={importSelectedFile}
              type="button"
              variant="outline"
            >
              <Database aria-hidden="true" className="h-4 w-4" />
              {isImporting ? "Importing" : "Import to Supabase"}
            </Button>
            <Button
              disabled={!selectedFile && !validationResult && !error && !uploadResult}
              onClick={clearSelectedFile}
              type="button"
              variant="outline"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {importError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        ) : null}

        {validationResult ? (
          <div className="space-y-5">
            <ValidationSummary result={validationResult} />
            <CleanDatasetSummary auditType={auditType} result={validationResult} />
            {uploadResult ? <UploadResultSummary result={uploadResult} /> : null}
            <InvalidRowsTable result={validationResult} />
            <div className={cn("grid gap-4", auditType === "clinical" && "lg:grid-cols-2")}>
              <PreviewTable rows={validationResult.sheet1Rows} sheetName="Sheet1" />
              {auditType === "clinical" ? (
                <PreviewTable rows={validationResult.sheet2Rows} sheetName="Sheet2" />
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
