import "server-only";

import type { AuditType } from "@/lib/audit-types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type UploadKind = "qa_audit" | "reconciliation_workload";

export type UploadHistoryItem = {
  id: number;
  fileName: string;
  uploadedAt: string | null;
  status: string;
  insertedRows: number;
  failedRows: number;
  skippedRows: number;
  uploadKind: UploadKind;
};

type UploadBatchRow = {
  id: number;
  file_name: string;
  source_file: string | null;
  inserted_daily_patients: number | null;
  inserted_qa_errors: number | null;
  inserted_workload_rows?: number | null;
  rows_patients_inserted: number | null;
  rows_errors_inserted: number | null;
  skipped_rows: number | null;
  failed_rows: number | null;
  upload_kind?: UploadKind | null;
  uploaded_at: string | null;
  status: string | null;
};

const UPLOAD_BATCH_COLUMNS = [
  "id",
  "file_name",
  "source_file",
  "inserted_daily_patients",
  "inserted_qa_errors",
  "rows_patients_inserted",
  "rows_errors_inserted",
  "skipped_rows",
  "failed_rows",
  "uploaded_at",
  "status",
];

// Reconciliation tracker batches exist for Clinical QA only, so only the
// Clinical query reads these columns.
const CLINICAL_UPLOAD_BATCH_COLUMNS = [
  ...UPLOAD_BATCH_COLUMNS,
  "upload_kind",
  "inserted_workload_rows",
];

export async function getUploadHistory(
  auditType: AuditType,
  limit = 50,
  options: { uploadKind?: UploadKind } = {},
): Promise<UploadHistoryItem[]> {
  const supabase = getSupabaseAdminClient();
  const isClinical = auditType === "clinical";
  let query = supabase
    .from("upload_batches")
    .select(
      (isClinical ? CLINICAL_UPLOAD_BATCH_COLUMNS : UPLOAD_BATCH_COLUMNS).join(","),
    )
    .eq("audit_type", auditType);

  if (isClinical && options.uploadKind) {
    query = query.eq("upload_kind", options.uploadKind);
  }

  const { data, error } = await query
    .order("uploaded_at", { ascending: false })
    .limit(limit)
    .returns<UploadBatchRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const dailyRows = row.inserted_daily_patients ?? row.rows_patients_inserted ?? 0;
    const qaRows = row.inserted_qa_errors ?? row.rows_errors_inserted ?? 0;
    const workloadRows = row.inserted_workload_rows ?? 0;

    return {
      id: row.id,
      fileName: row.source_file ?? row.file_name,
      uploadedAt: row.uploaded_at,
      status: row.status ?? "unknown",
      insertedRows: dailyRows + qaRows + workloadRows,
      failedRows: row.failed_rows ?? 0,
      skippedRows: row.skipped_rows ?? 0,
      uploadKind: row.upload_kind ?? "qa_audit",
    };
  });
}
