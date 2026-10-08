import { NextResponse } from "next/server";
import { utils, write } from "xlsx";

import { getCurrentProfile } from "@/lib/auth-server";
import {
  PROCESSING_TIME_COLUMNS,
  PROCESSING_TIME_SHEET_NAME,
} from "@/lib/processing-time-validation";

export const runtime = "nodejs";

// Empty monthly tracker with the same sheet name and headers as the daily
// work log.
export async function GET() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!profile.active || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet([[...PROCESSING_TIME_COLUMNS]]);

  sheet["!cols"] = PROCESSING_TIME_COLUMNS.map((column) => ({
    wch: column === "Task Type" ? 36 : 18,
  }));
  utils.book_append_sheet(workbook, sheet, PROCESSING_TIME_SHEET_NAME);

  const file = write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(file, {
    headers: {
      "Content-Disposition": 'attachment; filename="processing-time-tracker-template.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
