import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { read } from "xlsx";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { validateWorkbook } from "@/lib/excel-validation";
import { importValidatedWorkbook } from "@/lib/upload-import";

export const runtime = "nodejs";

function isXlsxFile(file: File) {
  return file.name.toLocaleLowerCase("en-US").endsWith(".xlsx");
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const isAuthenticated = await verifySessionToken(
    cookieStore.get(AUTH_COOKIE_NAME)?.value,
  );

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

  try {
    const workbook = read(await file.arrayBuffer(), { type: "array" });
    const validationResult = validateWorkbook(workbook);
    const importResult = await importValidatedWorkbook({
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
            : "The workbook could not be imported.",
      },
      { status: 500 },
    );
  }
}
