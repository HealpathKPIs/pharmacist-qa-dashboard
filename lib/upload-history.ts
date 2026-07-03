import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type UploadHistoryItem = {
  id: number;
  fileName: string;
  uploadedAt: string | null;
  status: string;
  insertedRows: number;
  failedRows: number;
  skippedRows: number;
};

type UploadBatchRow = {
  id: number;
  file_name: string;
  source_file: string | null;
  inserted_daily_patients: number | null;
  inserted_qa_errors: number | null;
  rows_patients_inserted: number | null;
  rows_errors_inserted: number | null;
  skipped_rows: number | null;
  failed_rows: number | null;
  uploaded_at: string | null;
  status: string | null;
};

export async function getUploadHistory(limit = 50): Promise<UploadHistoryItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("upload_batches")
    .select(
      [
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
      ].join(","),
    )
    .order("uploaded_at", { ascending: false })
    .limit(limit)
    .returns<UploadBatchRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const dailyRows = row.inserted_daily_patients ?? row.rows_patients_inserted ?? 0;
    const qaRows = row.inserted_qa_errors ?? row.rows_errors_inserted ?? 0;

    return {
      id: row.id,
      fileName: row.source_file ?? row.file_name,
      uploadedAt: row.uploaded_at,
      status: row.status ?? "unknown",
      insertedRows: dailyRows + qaRows,
      failedRows: row.failed_rows ?? 0,
      skippedRows: row.skipped_rows ?? 0,
    };
  });
}
