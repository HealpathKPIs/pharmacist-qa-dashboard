import { NextResponse } from "next/server";
import { read } from "xlsx";

import { getCurrentProfile } from "@/lib/auth-server";
import { getClinicalRosterForMatching } from "@/lib/clinical-roster";
import { importReconciliationWorkload } from "@/lib/reconciliation-import";
import { validateReconciliationWorkbook } from "@/lib/reconciliation-validation";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Allowance for the multipart form around the file.
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024;

function isXlsxFile(file: File) {
  return file.name.toLocaleLowerCase("en-US").endsWith(".xlsx");
}

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
      { error: "The workbook must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A .xlsx workbook is required." },
      { status: 400 },
    );
  }

  if (!isXlsxFile(file)) {
    return NextResponse.json(
      { error: "Only .xlsx workbooks can be imported." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "The workbook must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  try {
    const workbook = read(await file.arrayBuffer(), { type: "array" });
    // Validate again on the server against the current roster.
    const validationResult = validateReconciliationWorkbook(
      workbook,
      await getClinicalRosterForMatching(),
    );

    if (validationResult.hasBlockingErrors) {
      return NextResponse.json(
        {
          error: validationResult.invalidRows.map((row) => row.reason).join(" "),
          invalidRows: validationResult.invalidRows,
        },
        { status: 400 },
      );
    }

    const importResult = await importReconciliationWorkload({
      sourceFile: file.name,
      validationResult,
    });

    return NextResponse.json({
      result: importResult,
      invalidRows: validationResult.invalidRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The tracker could not be imported.",
      },
      { status: 500 },
    );
  }
}
