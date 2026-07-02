"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadProgressPlaceholder } from "@/components/upload/upload-progress-placeholder";
import { cn } from "@/lib/utils";

export function UploadDropzone() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  function clearSelectedFile() {
    setSelectedFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-white">Excel Import</CardTitle>
        <CardDescription>
          Select the latest QA workbook before starting an import.
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
            Choose the workbook you want to import. Processing will be connected
            in a later phase.
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
            <Button disabled={!selectedFile} type="button">
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              Upload
            </Button>
            <Button
              disabled={!selectedFile}
              onClick={clearSelectedFile}
              type="button"
              variant="outline"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <UploadProgressPlaceholder />
      </CardContent>
    </Card>
  );
}
