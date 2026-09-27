"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Database,
  FileSpreadsheet,
  Pill,
  UploadCloud,
  X,
} from "lucide-react";
import { read } from "xlsx";

import {
  InvalidRowsTable,
  PreviewTable,
  UploadResultSummary,
  UploadValidationSummary,
} from "@/components/upload/upload-dropzone";
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
import { formatMonthLabel } from "@/lib/reconciliation";
import {
  validateReconciliationWorkbook,
  type ReconciliationRosterEntry,
  type ReconciliationValidationResult,
} from "@/lib/reconciliation-validation";
import { cn } from "@/lib/utils";

type ReconciliationImportResult = {
  sourceFile: string;
  status: "success" | "partial" | "failed";
  totalProcessed: number;
  successfullyInserted: number;
  failed: number;
  skipped: number;
  failedRecords: number;
  failedValidationRows: number;
  uploadBatchId: number | null;
  errors: string[];
};

function isXlsxFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function ReadyStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-brand/20 bg-brand/[0.06] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
        <span className="truncate text-sm font-medium text-brand-surface-foreground">{label}</span>
      </div>
      <span className="font-mono text-lg font-semibold text-fg-strong">
        {formatInteger(value)}
      </span>
    </div>
  );
}

function ColumnMatches({ result }: { result: ReconciliationValidationResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
        <h3 className="text-sm font-medium text-fg-strong">Imported columns</h3>
        {result.columns.length === 0 ? (
          <p className="text-sm text-fg-subtle">No column matches a Clinical pharmacist.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {result.columns.map((column) => (
              <li
                className="flex items-center justify-between gap-3"
                key={column.columnIndex}
              >
                <span className="truncate text-fg-muted">{column.header}</span>
                <span className="flex items-center gap-2 text-right text-foreground">
                  {column.pharmacistName}
                  {column.active ? null : (
                    <span className="rounded-md border border-zinc-500/25 bg-zinc-500/10 px-2 py-0.5 text-xs text-fg-muted">
                      Inactive: saved, not counted
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
        <h3 className="text-sm font-medium text-fg-strong">Ignored columns</h3>
        {result.ignoredColumns.length === 0 ? (
          <p className="text-sm text-fg-subtle">No columns were ignored.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {result.ignoredColumns.map((column) => (
              <li
                className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2"
                key={column.columnIndex}
              >
                <p className="font-medium text-warning-foreground">{column.header}</p>
                <p className="mt-1 text-xs leading-5 text-warning-foreground/70">{column.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MonthlyTotalsTable({ result }: { result: ReconciliationValidationResult }) {
  if (result.monthlyTotals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-fg-strong">Monthly totals in this file</h3>
        <p className="text-xs text-fg-subtle">Check these against the tracker before importing.</p>
      </div>
      <div className="max-h-80 overflow-auto rounded-md border border-tint/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-tint/[0.03] text-xs uppercase tracking-normal text-fg-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="px-3 py-2 font-medium">Pharmacist</th>
              <th className="px-3 py-2 text-right font-medium">Medications</th>
            </tr>
          </thead>
          <tbody>
            {result.monthlyTotals.map((total) => (
              <tr
                className="border-t border-tint/10 text-fg-tertiary"
                key={`${total.month}-${total.pharmacistName}`}
              >
                <td className="whitespace-nowrap px-3 py-2">{formatMonthLabel(total.month)}</td>
                <td className="px-3 py-2">
                  {total.pharmacistName}
                  {total.active ? null : (
                    <span className="ml-2 text-xs text-fg-subtle">(inactive)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatInteger(total.itemCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReconciliationUploadCard({
  roster,
}: {
  roster: ReconciliationRosterEntry[];
}) {
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<ReconciliationValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<ReconciliationImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const totalMedications =
    validationResult?.records.reduce((total, record) => total + record.itemCount, 0) ?? 0;
  const trackerDays = new Set(validationResult?.records.map((record) => record.day)).size;
  const canImport =
    Boolean(selectedFile) &&
    Boolean(validationResult) &&
    !validationResult?.hasBlockingErrors &&
    (validationResult?.records.length ?? 0) > 0 &&
    !isParsing &&
    !isImporting;

  function resetResults() {
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);
  }

  function selectFile(file: File | undefined) {
    resetResults();

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
    resetResults();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function parseSelectedFile() {
    if (!selectedFile) {
      return;
    }

    setIsParsing(true);
    resetResults();

    try {
      const workbook = read(await selectedFile.arrayBuffer(), { type: "array" });
      const result = validateReconciliationWorkbook(workbook, roster);

      setValidationResult(result);
      toast({
        description: result.hasBlockingErrors
          ? "The tracker layout needs fixing before it can be imported."
          : `${result.records.length} day-and-pharmacist records ready, ${result.summary.invalidRows} invalid rows, ${result.ignoredColumns.length} ignored columns.`,
        title: "Tracker validated",
        variant:
          result.hasBlockingErrors || result.summary.invalidRows > 0 ? "default" : "success",
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

      const response = await fetch("/api/upload/reconciliation", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: ReconciliationImportResult;
      };

      if (!response.ok || !payload.result) {
        const message =
          payload.error ??
          "The tracker could not be imported. Review the result and try again.";

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
        description: `${payload.result.successfullyInserted} records saved, ${payload.result.failed} failed, ${payload.result.skipped} skipped.`,
        title:
          payload.result.status === "success"
            ? "Import complete"
            : "Import completed with issues",
        variant: payload.result.status === "success" ? "success" : "default",
      });
    } catch {
      const message =
        "The tracker could not be imported. Check the database connection and try again.";

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
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="text-fg-strong">Medication Reconciliation Tracker</CardTitle>
        <CardDescription className="leading-6">
          First worksheet: column A <span className="font-mono">DAY</span> (a real Excel
          date), column B <span className="font-mono">TASK</span> (optional), then one column
          per pharmacist with the number of medications reconciled that day. Uploading a day
          again replaces it; nothing is counted twice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-brand-vivid/30 bg-brand-vivid/[0.03] px-6 py-8 text-center transition-colors hover:border-brand/60 hover:bg-brand-vivid/[0.06]"
          htmlFor="clinical-reconciliation-file"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand-strong">
            <Pill aria-hidden="true" className="h-6 w-6" />
          </span>
          <span className="text-base font-medium text-fg-strong">
            Drag and drop the reconciliation tracker here
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-fg-muted">
            Only columns that match an active or inactive Clinical pharmacist are imported.
          </span>
          <span
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-5 border-tint/15 bg-tint/5 text-fg-strong hover:bg-tint/10",
            )}
          >
            Choose File
          </span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            id="clinical-reconciliation-file"
            name="reconciliation-file"
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
        </label>

        <div className="flex flex-col gap-4 rounded-md border border-tint/10 bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg-strong">Selected file</p>
              <p className="truncate text-sm text-fg-muted">
                {selectedFile?.name ?? "No file selected"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!selectedFile || isParsing || isImporting}
              onClick={parseSelectedFile}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isParsing ? "Validating" : "Validate Tracker"}
            </Button>
            <Button
              disabled={!canImport}
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
            <UploadValidationSummary result={validationResult} />
            {!validationResult.hasBlockingErrors ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <ReadyStat
                  icon={Database}
                  label="Records ready"
                  value={validationResult.records.length}
                />
                <ReadyStat icon={Pill} label="Medications" value={totalMedications} />
                <ReadyStat icon={CalendarDays} label="Days" value={trackerDays} />
              </div>
            ) : null}
            {validationResult.combinedRows > 0 ? (
              <p className="rounded-md border border-tint/10 bg-inset px-3 py-2 text-sm text-fg-muted">
                {validationResult.combinedRows} row(s) share a date with another row; their
                counts were added together per pharmacist.
              </p>
            ) : null}
            {uploadResult ? (
              <div className="space-y-2">
                <UploadResultSummary result={uploadResult} />
                {uploadResult.uploadBatchId ? (
                  <p className="text-xs text-fg-subtle">
                    Upload batch ID: <span className="font-mono">{uploadResult.uploadBatchId}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            <InvalidRowsTable result={validationResult} />
            <ColumnMatches result={validationResult} />
            <MonthlyTotalsTable result={validationResult} />
            <PreviewTable
              rows={validationResult.sheetRows}
              sheetName={validationResult.sheetName}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
