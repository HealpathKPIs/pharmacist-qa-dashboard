"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Hash,
  PhoneCall,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

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
import {
  formatCallCountDay,
  isCallCountFileName,
  readCallCountWorkbook,
  validateCallCountWorkbook,
  type CallCountRosterEntry,
  type CallCountTotalRowCheck,
  type CallCountValidationResult,
} from "@/lib/clinical-calls-validation";
import { cn } from "@/lib/utils";

type CallCountImportResult = {
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

const BLANK_CELLS_SHOWN = 12;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDayRange(result: CallCountValidationResult) {
  const { firstDay, lastDay } = result.stats;

  if (!firstDay || !lastDay) {
    return "No valid days";
  }

  return firstDay === lastDay
    ? formatCallCountDay(firstDay)
    : `${formatCallCountDay(firstDay)} – ${formatCallCountDay(lastDay)}`;
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

function YearSelector({
  disabled,
  onChange,
  onConfirmChange,
  result,
  year,
  yearConfirmed,
  yearOptions,
}: {
  disabled: boolean;
  onChange: (year: number) => void;
  onConfirmChange: (confirmed: boolean) => void;
  result: CallCountValidationResult | null;
  year: number;
  yearConfirmed: boolean;
  yearOptions: number[];
}) {
  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
            Year of the dates
          </span>
          <select
            className="flex h-10 w-full rounded-md border border-field-line bg-field px-3 py-2 text-sm text-fg-strong outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-40"
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            value={year}
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <p className="max-w-xl text-xs leading-5 text-fg-subtle">
          Used only for days written without a year, such as 1-Sep. Excel dates and dates
          such as 1-Sep-2026 keep their own year.
        </p>
      </div>
      {result?.usesSelectedYear ? (
        <label
          className={cn(
            "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
            yearConfirmed
              ? "border-brand/25 bg-brand/[0.06] text-brand-surface-foreground"
              : "border-warning/30 bg-warning/[0.08] text-warning-foreground",
          )}
        >
          <input
            checked={yearConfirmed}
            className="mt-0.5 h-4 w-4 accent-brand"
            disabled={disabled}
            onChange={(event) => onConfirmChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            The days in this file have no year. I confirm they are in{" "}
            <span className="font-semibold">{year}</span> ({formatDayRange(result)}). Import
            stays disabled until this is confirmed.
          </span>
        </label>
      ) : null}
    </div>
  );
}

function TotalRowCheck({ check }: { check: CallCountTotalRowCheck }) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-4",
        check.matches ? "border-tint/10 bg-inset" : "border-warning/25 bg-warning/[0.05]",
      )}
    >
      <div className="flex items-start gap-3">
        {check.matches ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        ) : (
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        )}
        <div className="space-y-1 text-sm">
          <p className="font-medium text-fg-strong">
            Row {check.rowNumber} (&quot;{check.label}&quot;) is a Total row: it is not imported.
          </p>
          <p className="text-fg-muted">
            {check.matches
              ? `It matches the daily rows: ${formatInteger(check.dailyTotal)} calls.`
              : check.shift !== null
                ? `Its numbers equal the daily sums but sit ${Math.abs(check.shift)} column(s) to the ${
                    check.shift > 0 ? "right" : "left"
                  } of their pharmacist. The daily rows are used.`
                : "It does not match the daily rows. The daily rows are used; check the file."}{" "}
            Daily rows: <span className="font-mono">{formatInteger(check.dailyTotal)}</span>
            {" · "}Total row sum:{" "}
            <span className="font-mono">
              {check.totalRowSum === null ? "—" : formatInteger(check.totalRowSum)}
            </span>
          </p>
        </div>
      </div>
      {check.matches ? null : (
        <div className="max-h-72 overflow-auto rounded-md border border-tint/10">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-tint/[0.03] text-xs uppercase tracking-normal text-fg-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Pharmacist</th>
                <th className="px-3 py-2 text-right font-medium">Daily rows</th>
                <th className="px-3 py-2 text-right font-medium">Total row</th>
                <th className="px-3 py-2 font-medium">Check</th>
              </tr>
            </thead>
            <tbody>
              {check.columns.map((column) => (
                <tr className="border-t border-tint/10 text-fg-tertiary" key={column.pharmacistName}>
                  <td className="px-3 py-2">{column.pharmacistName}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatInteger(column.dailyTotal)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {column.totalRowValue === null ? "—" : formatInteger(column.totalRowValue)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-xs font-medium",
                      column.matches ? "text-brand" : "text-warning-strong",
                    )}
                  >
                    {column.matches ? "Matches" : "Differs"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ColumnMatches({ result }: { result: CallCountValidationResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
        <h3 className="text-sm font-medium text-fg-strong">
          Pharmacists found ({formatInteger(result.columns.length)})
        </h3>
        {result.columns.length === 0 ? (
          <p className="text-sm text-fg-subtle">No column matches a Clinical pharmacist.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {result.columns.map((column) => (
              <li className="flex items-center justify-between gap-3" key={column.columnIndex}>
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
                <p className="flex items-center justify-between gap-3 font-medium text-warning-foreground">
                  <span className="truncate">{column.header}</span>
                  {column.calls === null ? null : (
                    <span className="shrink-0 font-mono text-xs">
                      {formatInteger(column.calls)} calls not imported
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs leading-5 text-warning-foreground/70">{column.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BlankCells({ result }: { result: CallCountValidationResult }) {
  if (result.blankCells.length === 0) {
    return null;
  }

  const shown = result.blankCells.slice(0, BLANK_CELLS_SHOWN);
  const hidden = result.blankCells.length - shown.length;

  return (
    <div className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
      <p className="font-medium">
        {formatInteger(result.blankCells.length)} blank cell(s): no call count is recorded for
        that pharmacist and day. Enter 0 where there were no calls.
      </p>
      <p className="mt-1 text-xs leading-5 text-warning-foreground/80">
        {shown
          .map(
            (cell) =>
              `Row ${cell.rowNumber}: ${cell.pharmacistName}, ${formatCallCountDay(cell.day)}`,
          )
          .join(" · ")}
        {hidden > 0 ? ` · and ${formatInteger(hidden)} more` : ""}
      </p>
    </div>
  );
}

function MonthlyTotalsTable({ result }: { result: CallCountValidationResult }) {
  if (result.monthlyTotals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-fg-strong">Calls per pharmacist in this file</h3>
        <p className="text-xs text-fg-subtle">
          Final total: {formatInteger(result.stats.totalCalls)} calls. Check these before importing.
        </p>
      </div>
      <div className="max-h-80 overflow-auto rounded-md border border-tint/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-tint/[0.03] text-xs uppercase tracking-normal text-fg-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="px-3 py-2 font-medium">Pharmacist</th>
              <th className="px-3 py-2 text-right font-medium">Calls</th>
            </tr>
          </thead>
          <tbody>
            {result.monthlyTotals.map((total) => (
              <tr
                className="border-t border-tint/10 text-fg-tertiary"
                key={`${total.month}-${total.pharmacistName}`}
              >
                <td className="whitespace-nowrap px-3 py-2">{formatMonth(total.month)}</td>
                <td className="px-3 py-2">
                  {total.pharmacistName}
                  {total.active ? null : (
                    <span className="ml-2 text-xs text-fg-subtle">(inactive)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatInteger(total.calls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CallsUploadCard({
  defaultYear,
  roster,
}: {
  defaultYear: number;
  roster: CallCountRosterEntry[];
}) {
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<CallCountValidationResult | null>(
    null,
  );
  const [uploadResult, setUploadResult] = useState<CallCountImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [year, setYear] = useState(defaultYear);
  const [yearConfirmed, setYearConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const yearOptions = [defaultYear, defaultYear - 1];
  const canImport =
    Boolean(selectedFile) &&
    Boolean(validationResult) &&
    !validationResult?.hasBlockingErrors &&
    (validationResult?.records.length ?? 0) > 0 &&
    (!validationResult?.usesSelectedYear || yearConfirmed) &&
    !isParsing &&
    !isImporting;

  function resetResults() {
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);
    setYearConfirmed(false);
  }

  function selectFile(file: File | undefined) {
    resetResults();

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isCallCountFileName(file.name)) {
      const message = "Select a .csv file or an Excel workbook (.xlsx).";

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

  async function validateFile(file: File, fileYear: number) {
    setIsParsing(true);
    resetResults();

    try {
      const result = validateCallCountWorkbook(
        readCallCountWorkbook(await file.arrayBuffer()),
        roster,
        { year: fileYear },
      );

      setValidationResult(result);
      toast({
        description: result.hasBlockingErrors
          ? "The file needs fixing before it can be imported."
          : `${formatInteger(result.stats.totalCalls)} calls in ${result.records.length} day-and-pharmacist records, ${result.summary.invalidRows} invalid rows, ${result.ignoredColumns.length} ignored columns.`,
        title: "Call counts validated",
        variant:
          result.hasBlockingErrors || result.summary.invalidRows > 0 ? "default" : "success",
      });
    } catch {
      const message =
        "The file could not be read. Confirm it is a valid .csv or .xlsx file and try again.";

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

  function changeYear(nextYear: number) {
    setYear(nextYear);

    // The days depend on the year, so validate again; the confirmation is cleared.
    if (selectedFile && validationResult) {
      void validateFile(selectedFile, nextYear);
    } else {
      setYearConfirmed(false);
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
      formData.append("year", String(year));
      formData.append("yearConfirmed", String(yearConfirmed));

      const response = await fetch("/api/upload/calls", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: CallCountImportResult;
      };

      if (!response.ok || !payload.result) {
        const message =
          payload.error ?? "The call counts could not be imported. Review the result and try again.";

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
          payload.result.status === "success" ? "Import complete" : "Import completed with issues",
        variant: payload.result.status === "success" ? "success" : "default",
      });
    } catch {
      const message =
        "The call counts could not be imported. Check the database connection and try again.";

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
        <CardTitle className="text-fg-strong">Clinical Calls Tracker</CardTitle>
        <CardDescription className="leading-6">
          A .csv file or the first worksheet of an .xlsx workbook: column A the call day (for
          example <span className="font-mono">1-Sep</span> or a real Excel date), then one
          column per pharmacist with the number of calls evaluated that day; 0 means no calls.
          These counts are the total evaluated calls of the Clinical Calls KPI. Uploading a day
          again replaces it; nothing is counted twice. A Total row is checked, never imported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-brand-vivid/30 bg-brand-vivid/[0.03] px-6 py-8 text-center transition-colors hover:border-brand/60 hover:bg-brand-vivid/[0.06]"
          htmlFor="clinical-calls-file"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand-strong">
            <PhoneCall aria-hidden="true" className="h-6 w-6" />
          </span>
          <span className="text-base font-medium text-fg-strong">
            Drag and drop the call-count tracker here
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
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            id="clinical-calls-file"
            name="calls-file"
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
        </label>

        <YearSelector
          disabled={isParsing || isImporting}
          onChange={changeYear}
          onConfirmChange={setYearConfirmed}
          result={validationResult}
          year={year}
          yearConfirmed={yearConfirmed}
          yearOptions={yearOptions}
        />

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
              onClick={() => selectedFile && validateFile(selectedFile, year)}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isParsing ? "Validating" : "Validate Call Counts"}
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
            {validationResult.duplicateDays.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>
                  {validationResult.duplicateDays.length} day(s) appear on more than one row (
                  {formatInteger(validationResult.stats.duplicateRows)} rows). Nothing can be
                  imported until each day has one row.
                </AlertDescription>
              </Alert>
            ) : null}
            {!validationResult.hasBlockingErrors ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadyStat
                    icon={PhoneCall}
                    label="Total calls"
                    value={validationResult.stats.totalCalls}
                  />
                  <ReadyStat
                    icon={Users}
                    label="Pharmacists found"
                    value={validationResult.stats.pharmacistsFound}
                  />
                  <ReadyStat icon={CalendarDays} label="Days" value={validationResult.stats.days} />
                  <ReadyStat
                    icon={Database}
                    label="Records ready"
                    value={validationResult.records.length}
                  />
                  <ReadyStat
                    icon={Hash}
                    label="Zero-call entries"
                    value={validationResult.stats.zeroCallEntries}
                  />
                  <ReadyStat
                    icon={AlertTriangle}
                    label="Duplicate rows"
                    value={validationResult.stats.duplicateRows}
                  />
                </div>
                <p className="text-xs text-fg-subtle">Days in this file: {formatDayRange(validationResult)}</p>
              </>
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
            {validationResult.totalRows.map((check) => (
              <TotalRowCheck check={check} key={check.rowNumber} />
            ))}
            <BlankCells result={validationResult} />
            <InvalidRowsTable result={validationResult} />
            <ColumnMatches result={validationResult} />
            <MonthlyTotalsTable result={validationResult} />
            <PreviewTable rows={validationResult.sheetRows} sheetName={validationResult.sheetName} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
