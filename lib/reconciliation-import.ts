import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { MEDICATION_RECONCILIATION } from "@/lib/reconciliation";
import type { ReconciliationValidationResult } from "@/lib/reconciliation-validation";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Database } from "@/types/database";

const UPSERT_CHUNK_SIZE = 500;

type WorkloadInsert = Database["public"]["Tables"]["pharmacist_workload"]["Insert"];
type UploadStatus = "success" | "partial" | "failed";

export type ReconciliationImportResult = {
  sourceFile: string;
  status: UploadStatus;
  totalProcessed: number;
  // Day-and-pharmacist records saved (new or replacing the same day).
  successfullyInserted: number;
  failed: number;
  skipped: number;
  failedRecords: number;
  failedValidationRows: number;
  uploadBatchId: number | null;
  errors: string[];
};

function getImportStatus(savedRecords: number, failed: number): UploadStatus {
  if (failed === 0) {
    return "success";
  }

  return savedRecords > 0 ? "partial" : "failed";
}

function getErrorMessage(error: PostgrestError | Error | null) {
  return error?.message ?? "Unknown database error.";
}

// Saves the validated tracker records. A day that already exists for a
// pharmacist is replaced (unique workload_type, day, pharmacist_id), so an
// accidental re-upload never double counts.
export async function importReconciliationWorkload({
  sourceFile,
  validationResult,
}: {
  sourceFile: string;
  validationResult: ReconciliationValidationResult;
}): Promise<ReconciliationImportResult> {
  const supabase = getSupabaseAdminClient();
  const failedValidationRows = validationResult.invalidRows.length;
  const skipped = validationResult.summary.skippedEmptyRows;
  const totalProcessed = validationResult.summary.totalRows;
  const { data: batch, error: batchError } = await supabase
    .from("upload_batches")
    .insert({
      audit_type: "clinical",
      failed_rows: 0,
      file_name: sourceFile,
      inserted_daily_patients: 0,
      inserted_qa_errors: 0,
      inserted_workload_rows: 0,
      rows_errors_inserted: 0,
      rows_patients_inserted: 0,
      skipped_rows: skipped,
      source_file: sourceFile,
      status: "processing",
      upload_kind: "reconciliation_workload",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return {
      errors: [`upload_batches: ${getErrorMessage(batchError)}`],
      failed: validationResult.records.length + failedValidationRows,
      failedRecords: validationResult.records.length,
      failedValidationRows,
      skipped,
      sourceFile,
      status: "failed",
      successfullyInserted: 0,
      totalProcessed,
      uploadBatchId: null,
    };
  }

  const uploadedAt = new Date().toISOString();
  const rows: WorkloadInsert[] = validationResult.records.map((record) => ({
    day: record.day,
    item_count: record.itemCount,
    pharmacist_id: record.pharmacistId,
    pharmacist_name_raw: record.pharmacistNameRaw,
    source_file: sourceFile,
    task_label: record.taskLabel,
    upload_batch_id: batch.id,
    uploaded_at: uploadedAt,
    workload_type: MEDICATION_RECONCILIATION,
  }));
  const errors: string[] = [];
  let failedRecords = 0;
  let savedRecords = 0;

  for (let startIndex = 0; startIndex < rows.length; startIndex += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(startIndex, startIndex + UPSERT_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("pharmacist_workload")
      .upsert(chunk, { onConflict: "workload_type,day,pharmacist_id" })
      .select("id");

    if (error) {
      failedRecords += chunk.length;
      errors.push(`pharmacist_workload: ${getErrorMessage(error)}`);
      continue;
    }

    savedRecords += data?.length ?? chunk.length;
  }

  const failed = failedRecords + failedValidationRows;
  const status = getImportStatus(savedRecords, failed);
  const { error: updateError } = await supabase
    .from("upload_batches")
    .update({
      failed_rows: failed,
      inserted_workload_rows: savedRecords,
      skipped_rows: skipped,
      status,
    })
    .eq("id", batch.id);

  if (updateError) {
    errors.push(`upload_batches: ${getErrorMessage(updateError)}`);
  }

  return {
    errors,
    failed,
    failedRecords,
    failedValidationRows,
    skipped,
    sourceFile,
    status: updateError ? "partial" : status,
    successfullyInserted: savedRecords,
    totalProcessed,
    uploadBatchId: batch.id,
  };
}
