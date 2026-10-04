import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth-server";
import { importCallCounts } from "@/lib/clinical-calls-import";
import {
  isCallCountFileName,
  readCallCountWorkbook,
  validateCallCountWorkbook,
} from "@/lib/clinical-calls-validation";
import { getClinicalRosterForMatching } from "@/lib/clinical-roster";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Allowance for the multipart form around the file.
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const EARLIEST_YEAR = 2020;

function parseYear(value: FormDataEntryValue | null) {
  const year = typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isInteger(year) &&
    year >= EARLIEST_YEAR &&
    year <= new Date().getUTCFullYear() + 1
    ? year
    : null;
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
      { error: "The file must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const year = parseYear(formData.get("year"));

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A .csv or .xlsx call-count file is required." },
      { status: 400 },
    );
  }

  if (!isCallCountFileName(file.name)) {
    return NextResponse.json(
      { error: "Only .csv or .xlsx call-count files can be imported." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "The file must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  if (year === null) {
    return NextResponse.json(
      { error: "Select the year of the dates in the file." },
      { status: 400 },
    );
  }

  try {
    // Validate again on the server against the current roster, with the year
    // the Admin selected.
    const validationResult = validateCallCountWorkbook(
      readCallCountWorkbook(await file.arrayBuffer()),
      await getClinicalRosterForMatching(),
      { year },
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

    if (validationResult.usesSelectedYear && formData.get("yearConfirmed") !== "true") {
      return NextResponse.json(
        { error: `Confirm that the dates in the file are in ${year} before importing.` },
        { status: 400 },
      );
    }

    if (validationResult.records.length === 0) {
      return NextResponse.json(
        { error: "The file has no valid call counts to import." },
        { status: 400 },
      );
    }

    const importResult = await importCallCounts({
      sourceFile: file.name,
      validationResult,
    });

    return NextResponse.json({
      invalidRows: validationResult.invalidRows,
      result: importResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The call counts could not be imported.",
      },
      { status: 500 },
    );
  }
}
