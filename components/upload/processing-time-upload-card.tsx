"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  ListChecks,
  Timer,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { InvalidRowsTable, UploadValidationSummary } from "@/components/upload/upload-dropzone";
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
  formatProcessingDay,
  formatProcessingMonth,
  isProcessingTimeFileName,
  PROCESSING_TIME_COLUMNS,
  PROCESSING_TIME_SHEET_NAME,
  readProcessingTimeWorkbook,
  validateProcessingTimeWorkbook,
  type ProcessingTimeRosterEntry,
  type ProcessingTimeValidationResult,
} from "@/lib/processing-time-validation";
import { cn } from "@/lib/utils";

type ProcessingTimeImportResult = {
  deletedRows: number;
  errors: string[];
  month: string;
  sourceFile: string;
  status: "success" | "failed";
  successfullyInserted: number;
  totalProcessed: number;
  uploadBatchId: number | null;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SAMPLE_ROWS_SHOWN = 10;

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function toMonth(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function ReadyStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-brand/20 bg-brand/[0.06] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
        <span className="truncate text-sm font-medium text-brand-surface-foreground">{label}</span>
      </div>
      <span className="font-mono text-lg font-semibold text-fg-strong">{value}</span>
    </div>
  );
}

function MonthSelector({
  disabled,
  existingRows,
  month,
  monthConfirmed,
  onChange,
  onConfirmChange,
  result,
  yearOptions,
}: {
  disabled: boolean;
  existingRows: number;
  month: string;
  monthConfirmed: boolean;
  onChange: (month: string) => void;
  onConfirmChange: (confirmed: boolean) => void;
  result: ProcessingTimeValidationResult | null;
  yearOptions: number[];
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const selectClassName =
    "flex h-10 w-full rounded-md border border-field-line bg-field px-3 py-2 text-sm text-fg-strong outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-40";

  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
              Tracker month
            </span>
            <select
              className={selectClassName}
              disabled={disabled}
              onChange={(event) => onChange(toMonth(year, Number(event.target.value)))}
              value={monthNumber}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">Year</span>
            <select
              className={selectClassName}
              disabled={disabled}
              onChange={(event) => onChange(toMonth(Number(event.target.value), monthNumber))}
              value={year}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="max-w-md text-xs leading-5 text-fg-subtle">
          Every date in the file must be in this month. Importing replaces everything already
          stored for the month.
        </p>
      </div>
      {result && !result.hasBlockingErrors ? (
        <label
          className={cn(
            "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
            monthConfirmed
              ? "border-brand/25 bg-brand/[0.06] text-brand-surface-foreground"
              : "border-warning/30 bg-warning/[0.08] text-warning-foreground",
          )}
        >
          <input
            checked={monthConfirmed}
            className="mt-0.5 h-4 w-4 accent-brand"
            disabled={disabled}
            onChange={(event) => onConfirmChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            I confirm this is the <span className="font-semibold">{formatProcessingMonth(month)}</span>{" "}
            tracker.{" "}
            {existingRows > 0
              ? `This will replace the ${formatInteger(existingRows)} rows already stored for ${formatProcessingMonth(month)}.`
              : `Nothing is stored for ${formatProcessingMonth(month)} yet.`}{" "}
            Import stays disabled until this is confirmed.
          </span>
        </label>
      ) : null}
    </div>
  );
}

function IgnoredRows({ result }: { result: ProcessingTimeValidationResult }) {
  if (result.ignoredRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border border-tint/10 bg-inset p-4">
      <h3 className="text-sm font-medium text-fg-strong">Not imported (not task rows)</h3>
      <ul className="space-y-1 text-sm text-fg-muted">
        {result.ignoredRows.map((row) => (
          <li key={row.rowNumber}>
            Row {row.rowNumber}
            {row.values ? <span className="font-mono"> ({row.values})</span> : null}: {row.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Warnings({ result }: { result: ProcessingTimeValidationResult }) {
  if (result.warnings.length === 0) {
    return null;
  }

  return (
    <Alert className="border-warning/30 bg-warning/[0.08] text-warning-foreground">
      <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning" />
      <AlertDescription>
        <ul className="space-y-1">
          {result.warnings.map((warning) => (
            <li key={warning.message}>{warning.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function TaskTypeTotals({ result }: { result: ProcessingTimeValidationResult }) {
  const totals = new Map<string, { actual: number; rows: number; sla: number }>();

  for (const record of result.records) {
    const entry = totals.get(record.taskType) ?? { actual: 0, rows: 0, sla: 0 };

    entry.actual += record.actualMinutes;
    entry.rows += 1;
    entry.sla += record.slaMinutes;
    totals.set(record.taskType, entry);
  }

  if (totals.size === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-tint/10">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-tint/[0.03] text-xs uppercase tracking-normal text-fg-subtle">
          <tr>
            <th className="px-3 py-2 font-medium">Task Type</th>
            <th className="px-3 py-2 text-right font-medium">Rows</th>
            <th className="px-3 py-2 text-right font-medium">SLA Minutes</th>
            <th className="px-3 py-2 text-right font-medium">Actual Minutes</th>
            <th className="px-3 py-2 text-right font-medium">Processing Time</th>
          </tr>
        </thead>
        <tbody>
          {[...totals.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([taskType, entry]) => (
              <tr className="border-t border-tint/10" key={taskType}>
                <td className="px-3 py-2 text-fg-secondary">{taskType}</td>
                <td className="px-3 py-2 text-right font-mono">{formatInteger(entry.rows)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(entry.sla)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(entry.actual)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {((entry.sla / entry.actual) * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleRows({ result }: { result: ProcessingTimeValidationResult }) {
  if (result.records.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-fg-strong">
        First {Math.min(SAMPLE_ROWS_SHOWN, result.records.length)} of{" "}
        {formatInteger(result.records.length)} rows
      </h3>
      <div className="overflow-x-auto rounded-md border border-tint/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-tint/[0.03] text-xs uppercase tracking-normal text-fg-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              {PROCESSING_TIME_COLUMNS.map((column) => (
                <th className="whitespace-nowrap px-3 py-2 font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.records.slice(0, SAMPLE_ROWS_SHOWN).map((record) => (
              <tr className="border-t border-tint/10" key={record.rowNumber}>
                <td className="px-3 py-2 font-mono text-fg-subtle">{record.rowNumber}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatProcessingDay(record.day)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {record.pharmacistName}
                  {record.pharmacistNameRaw !== record.pharmacistName ? (
                    <span className="block text-xs text-fg-subtle">
                      file: {record.pharmacistNameRaw}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono">{record.taskReference}</td>
                <td className="px-3 py-2">{record.taskType}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(record.itemsCompleted)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(record.slaPerItem)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(record.slaMinutes)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(record.actualMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProcessingTimeUploadCard({
  defaultMonth,
  existingRowsByMonth,
  roster,
}: {
  // YYYY-MM.
  defaultMonth: string;
  existingRowsByMonth: Record<string, number>;
  roster: ProcessingTimeRosterEntry[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<ProcessingTimeValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<ProcessingTimeImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [monthConfirmed, setMonthConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentYear = Number(defaultMonth.slice(0, 4));
  const yearOptions = [
    ...new Set([currentYear, currentYear - 1, currentYear - 2, Number(month.slice(0, 4))]),
  ].sort((left, right) => right - left);
  const existingRows = existingRowsByMonth[month] ?? 0;
  const canImport =
    Boolean(selectedFile) &&
    Boolean(validationResult) &&
    !validationResult?.hasBlockingErrors &&
    (validationResult?.records.length ?? 0) > 0 &&
    validationResult?.month === month &&
    monthConfirmed &&
    !isParsing &&
    !isImporting;

  function resetResults() {
    setValidationResult(null);
    setUploadResult(null);
    setError(null);
    setImportError(null);
    setMonthConfirmed(false);
  }

  function selectFile(file: File | undefined) {
    resetResults();

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isProcessingTimeFileName(file.name)) {
      const message = "Select the Excel tracker (.xlsx).";

      setSelectedFile(null);
      setError(message);
      toast({ description: message, title: "Unsupported file", variant: "destructive" });

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

  // The first validation of a file takes the month most of its rows are in;
  // after that, the selected month.
  async function validateFile(file: File, selectedMonth: string | null) {
    setIsParsing(true);
    resetResults();

    try {
      const workbook = readProcessingTimeWorkbook(await file.arrayBuffer());
      let result = validateProcessingTimeWorkbook(workbook, roster, {
        month: selectedMonth ?? undefined,
      });

      if (!selectedMonth && result.detectedMonth) {
        setMonth(result.detectedMonth);
        result = validateProcessingTimeWorkbook(workbook, roster, { month: result.detectedMonth });
      } else if (selectedMonth) {
        setMonth(selectedMonth);
      }

      setValidationResult(result);
      toast({
        description: result.hasBlockingErrors
          ? `${formatInteger(result.invalidRows.length)} row(s) need fixing before the file can be imported.`
          : `${formatInteger(result.records.length)} task rows for ${result.month ? formatProcessingMonth(result.month) : "the file"}.`,
        title: "Tracker validated",
        variant: result.hasBlockingErrors ? "default" : "success",
      });
    } catch {
      const message = "The file could not be read. Confirm it is a valid .xlsx file and try again.";

      setError(message);
      toast({ description: message, title: "Validation failed", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);

    // The month check depends on the selection, so validate again; the
    // confirmation is cleared.
    if (selectedFile && validationResult) {
      void validateFile(selectedFile, nextMonth);
    } else {
      setMonthConfirmed(false);
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
      formData.append("month", month);
      formData.append("monthConfirmed", String(monthConfirmed));

      const response = await fetch("/api/upload/processing-time", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: ProcessingTimeImportResult;
      };

      if (!response.ok || !payload.result || payload.result.status !== "success") {
        const message =
          payload.error ??
          payload.result?.errors.join(" ") ??
          "The tracker could not be imported. Nothing was changed.";

        setImportError(message);
        toast({ description: message, title: "Import failed", variant: "destructive" });
        return;
      }

      setUploadResult(payload.result);
      setMonthConfirmed(false);
      toast({
        description: `${formatInteger(payload.result.successfullyInserted)} rows saved for ${formatProcessingMonth(payload.result.month)}${
          payload.result.deletedRows > 0
            ? `, replacing ${formatInteger(payload.result.deletedRows)} earlier rows`
            : ""
        }.`,
        title: "Import complete",
        variant: "success",
      });
      router.refresh();
    } catch {
      const message =
        "The tracker could not be imported. Check the database connection and try again.";

      setImportError(message);
      toast({ description: message, title: "Import failed", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }

  const stats = validationResult?.stats;

  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="text-fg-strong">Processing Time Tracker</CardTitle>
        <CardDescription className="leading-6">
          The monthly daily work log (.xlsx, sheet{" "}
          <span className="font-mono">{PROCESSING_TIME_SHEET_NAME}</span>) with the columns{" "}
          {PROCESSING_TIME_COLUMNS.join(", ")}. One row per task line; Actual Time is in minutes.
          Pharmacist names are matched to Settings → Clinical Pharmacists. Any invalid row blocks
          the import. Uploading a month again replaces that month; nothing is counted twice.
        </CardDescription>
        <div>
          <a
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-2 border-tint/15 bg-tint/5 text-fg-strong hover:bg-tint/10",
            )}
            href="/api/upload/processing-time/template"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download template
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-brand-vivid/30 bg-brand-vivid/[0.03] px-6 py-8 text-center transition-colors hover:border-brand/60 hover:bg-brand-vivid/[0.06]"
          htmlFor="processing-time-file"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand-strong">
            <Timer aria-hidden="true" className="h-6 w-6" />
          </span>
          <span className="text-base font-medium text-fg-strong">
            Drag and drop the monthly tracker here
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-fg-muted">
            For example Tracking_System_July.xlsx.
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
            id="processing-time-file"
            name="processing-time-file"
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
        </label>

        <MonthSelector
          disabled={isParsing || isImporting}
          existingRows={existingRows}
          month={month}
          monthConfirmed={monthConfirmed}
          onChange={changeMonth}
          onConfirmChange={setMonthConfirmed}
          result={validationResult}
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
              onClick={() => selectedFile && validateFile(selectedFile, validationResult ? month : null)}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isParsing ? "Validating" : "Validate Tracker"}
            </Button>
            <Button disabled={!canImport} onClick={importSelectedFile} type="button" variant="outline">
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

        {uploadResult ? (
          <Alert className="border-brand/25 bg-brand/10 text-brand-foreground">
            <Database aria-hidden="true" className="h-4 w-4 text-brand" />
            <AlertDescription>
              {formatProcessingMonth(uploadResult.month)} imported:{" "}
              {formatInteger(uploadResult.successfullyInserted)} rows saved
              {uploadResult.deletedRows > 0
                ? `, ${formatInteger(uploadResult.deletedRows)} earlier rows replaced`
                : ""}
              . Upload batch ID <span className="font-mono">{uploadResult.uploadBatchId}</span>.
            </AlertDescription>
          </Alert>
        ) : null}

        {validationResult && stats ? (
          <div className="space-y-5">
            <UploadValidationSummary result={validationResult} />
            {!validationResult.hasBlockingErrors ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadyStat
                    icon={ListChecks}
                    label="Task rows ready"
                    value={formatInteger(validationResult.records.length)}
                  />
                  <ReadyStat
                    icon={Users}
                    label="Pharmacists"
                    value={formatInteger(stats.pharmacists.length)}
                  />
                  <ReadyStat
                    icon={Database}
                    label="Task types"
                    value={formatInteger(stats.taskTypes.length)}
                  />
                  <ReadyStat icon={Timer} label="SLA minutes" value={formatMinutes(stats.slaMinutes)} />
                  <ReadyStat
                    icon={Clock}
                    label="Actual minutes"
                    value={formatMinutes(stats.actualMinutes)}
                  />
                  <ReadyStat
                    icon={CalendarDays}
                    label="Processing Time"
                    value={
                      stats.actualMinutes > 0
                        ? `${((stats.slaMinutes / stats.actualMinutes) * 100).toFixed(2)}%`
                        : "—"
                    }
                  />
                </div>
                <p className="text-xs text-fg-subtle">
                  Dates in this file:{" "}
                  {stats.firstDay && stats.lastDay
                    ? `${formatProcessingDay(stats.firstDay)} – ${formatProcessingDay(stats.lastDay)}`
                    : "none"}{" "}
                  · Pharmacists: {stats.pharmacists.join(", ")}
                </p>
              </>
            ) : null}
            <Warnings result={validationResult} />
            <InvalidRowsTable result={validationResult} />
            <IgnoredRows result={validationResult} />
            <TaskTypeTotals result={validationResult} />
            <SampleRows result={validationResult} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
