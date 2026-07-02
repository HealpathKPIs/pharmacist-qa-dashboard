"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { AlertCircle, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { read, utils } from "xlsx";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SheetRow = unknown[];

type WorkbookPreview = {
  sheet1Rows: SheetRow[];
  sheet2Rows: SheetRow[];
};

const REQUIRED_SHEETS = ["Sheet1", "Sheet2"] as const;

function isXlsxFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  return String(value);
}

function getColumnCount(rows: SheetRow[]) {
  return Math.max(1, ...rows.slice(0, 5).map((row) => row.length));
}

function PreviewTable({
  rows,
  sheetName,
}: {
  rows: SheetRow[];
  sheetName: string;
}) {
  const previewRows = rows.slice(0, 5);
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
                        {formatCellValue(row[columnIndex])}
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

export function UploadDropzone() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(file: File | undefined) {
    setPreview(null);
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isXlsxFile(file)) {
      setSelectedFile(null);
      setError("Select a .xlsx workbook before parsing.");

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
    setPreview(null);
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function parseSelectedFile() {
    if (!selectedFile) {
      return;
    }

    setIsParsing(true);
    setPreview(null);
    setError(null);

    try {
      const workbook = read(await selectedFile.arrayBuffer(), { type: "array" });
      const missingSheet = REQUIRED_SHEETS.find((sheetName) => !workbook.Sheets[sheetName]);

      if (missingSheet) {
        setError(`Could not find ${missingSheet} in this workbook.`);
        return;
      }

      setPreview({
        sheet1Rows: utils.sheet_to_json<SheetRow>(workbook.Sheets.Sheet1, {
          blankrows: true,
          defval: "",
          header: 1,
        }),
        sheet2Rows: utils.sheet_to_json<SheetRow>(workbook.Sheets.Sheet2, {
          blankrows: true,
          defval: "",
          header: 1,
        }),
      });
    } catch {
      setError("The workbook could not be parsed. Check the file and try again.");
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-white">Excel Import</CardTitle>
        <CardDescription>
          Select a .xlsx workbook to preview Sheet1 and Sheet2.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-emerald-400/30 bg-emerald-400/[0.03] px-6 py-10 text-center transition-colors hover:border-emerald-300/60 hover:bg-emerald-400/[0.06]"
          htmlFor="excel-file"
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
            Choose the workbook you want to parse. The preview stays in this
            browser session only.
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
            id="excel-file"
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
            <Button
              disabled={!selectedFile || isParsing}
              onClick={parseSelectedFile}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isParsing ? "Parsing" : "Parse Preview"}
            </Button>
            <Button
              disabled={!selectedFile && !preview && !error}
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

        {preview ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <PreviewTable rows={preview.sheet1Rows} sheetName="Sheet1" />
            <PreviewTable rows={preview.sheet2Rows} sheetName="Sheet2" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
