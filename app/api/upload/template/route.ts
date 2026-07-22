import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { utils, write } from "xlsx";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getAuditModule, isAuditType } from "@/lib/audit-types";
import { getWorkbookContract } from "@/lib/excel-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const isAuthenticated = await verifySessionToken(
    cookieStore.get(AUTH_COOKIE_NAME)?.value,
  );

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const auditType = new URL(request.url).searchParams.get("auditType");

  if (!isAuditType(auditType)) {
    return NextResponse.json(
      { error: "A valid audit type is required." },
      { status: 400 },
    );
  }

  const contract = getWorkbookContract(auditType);
  const moduleConfig = getAuditModule(auditType);
  const workbook = utils.book_new();
  const workloadSheet = utils.aoa_to_sheet([[...contract.sheet1Columns]]);
  const errorsSheet = utils.aoa_to_sheet([[...contract.sheet2Columns]]);

  workloadSheet["!cols"] = contract.sheet1Columns.map(() => ({ wch: 22 }));
  errorsSheet["!cols"] = contract.sheet2Columns.map(() => ({ wch: 24 }));
  utils.book_append_sheet(workbook, workloadSheet, "Sheet1");
  utils.book_append_sheet(workbook, errorsSheet, "Sheet2");

  const fileName = `${moduleConfig.moduleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-upload-template.xlsx`;
  const file = write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(file, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
