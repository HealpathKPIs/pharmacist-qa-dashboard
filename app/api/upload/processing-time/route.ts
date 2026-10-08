import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth-server";
import { getClinicalRosterForMatching } from "@/lib/clinical-roster";
import { importProcessingTasks } from "@/lib/processing-time-import";
import {
  formatProcessingMonth,
  isProcessingMonth,
  isProcessingTimeFileName,
  readProcessingTimeWorkbook,
  validateProcessingTimeWorkbook,
} from "@/lib/processing-time-validation";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Allowance for the multipart form around the file.
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024;

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!profile.active || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "The file must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const month = String(formData.get("month") ?? "");

  if (!(file instanceof File) || !isProcessingTimeFileName(file.name)) {
    return NextResponse.json(
      { error: "An .xlsx Processing Time tracker file is required." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "The file must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  if (!isProcessingMonth(month)) {
    return NextResponse.json(
      { error: "Select the month of the tracker." },
      { status: 400 },
    );
  }

  if (formData.get("monthConfirmed") !== "true") {
    return NextResponse.json(
      { error: `Confirm that the file is the ${formatProcessingMonth(month)} tracker before importing.` },
      { status: 400 },
    );
  }

  try {
    // Validate again on the server against the current roster and the
    // selected month.
    const validationResult = validateProcessingTimeWorkbook(
      readProcessingTimeWorkbook(await file.arrayBuffer()),
      await getClinicalRosterForMatching(),
      { month },
    );

    if (validationResult.hasBlockingErrors) {
      return NextResponse.json(
        {
          error: validationResult.invalidRows
            .slice(0, 5)
            .map((row) => `Row ${row.rowNumber}: ${row.reason}`)
            .join(" "),
          invalidRows: validationResult.invalidRows,
        },
        { status: 400 },
      );
    }

    if (validationResult.records.length === 0) {
      return NextResponse.json(
        { error: "The file has no task rows to import." },
        { status: 400 },
      );
    }

    const result = await importProcessingTasks({
      month,
      sourceFile: file.name,
      validationResult,
    });

    return NextResponse.json({ result }, { status: result.status === "success" ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Processing Time tracker could not be imported.",
      },
      { status: 500 },
    );
  }
}
