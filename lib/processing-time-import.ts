import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import type { ProcessingTimeValidationResult } from "@/lib/processing-time-validation";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type UploadStatus = "success" | "failed";

export type ProcessingTimeImportResult = {
  // Rows of the month removed by this upload (a re-upload replaces the month).
  deletedRows: number;
  errors: string[];
  month: string;
  sourceFile: string;
  status: UploadStatus;
  successfullyInserted: number;
  totalProcessed: number;
  uploadBatchId: number | null;
};

function getErrorMessage(error: PostgrestError | Error | null) {
  return error?.message ?? "Unknown database error.";
}

// Number of rows already stored for the month (YYYY-MM).
export async function countProcessingMonthRows(month: string) {
  const supabase = getSupabaseAdminClient();
  const start = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("clinical_processing_tasks")
    .select("id", { count: "exact", head: true })
    .gte("day", start)
    .lt("day", nextMonth);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

// Replaces the whole month with the validated rows. Delete and insert run in
// one database function, so a failure keeps the month as it was.
export async function importProcessingTasks({
  month,
  sourceFile,
  validationResult,
}: {
  month: string;
  sourceFile: string;
  validationResult: ProcessingTimeValidationResult;
}): Promise<ProcessingTimeImportResult> {
  const supabase = getSupabaseAdminClient();
  const totalProcessed = validationResult.summary.totalRows;
  const skipped = validationResult.summary.skippedEmptyRows + validationResult.ignoredRows.length;
  const failedResult = (errors: string[], uploadBatchId: number | null) => ({
    deletedRows: 0,
    errors,
    month,
    sourceFile,
    status: "failed" as const,
    successfullyInserted: 0,
    totalProcessed,
    uploadBatchId,
  });
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
      upload_kind: "processing_time",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return failedResult([`upload_batches: ${getErrorMessage(batchError)}`], null);
  }

  const { data, error } = await supabase.rpc("qa_replace_processing_month", {
    p_batch_id: batch.id,
    p_month: `${month}-01`,
    p_rows: validationResult.records.map((record) => ({
      actual_minutes: record.actualMinutes,
      day: record.day,
      items_completed: record.itemsCompleted,
      pharmacist_id: record.pharmacistId,
      pharmacist_name_raw: record.pharmacistNameRaw,
      sla_minutes: record.slaMinutes,
      sla_per_item: record.slaPerItem,
      source_file: sourceFile,
      source_row: record.rowNumber,
      task_reference: record.taskReference,
      task_type: record.taskType,
    })),
  });
  const counts = data?.[0];
  const errors: string[] = [];

  if (error || !counts) {
    errors.push(`clinical_processing_tasks: ${getErrorMessage(error)}`);
  }

  const status: UploadStatus = errors.length === 0 ? "success" : "failed";
  const inserted = counts?.inserted_rows ?? 0;
  const { error: updateError } = await supabase
    .from("upload_batches")
    .update({
      failed_rows: status === "success" ? 0 : validationResult.records.length,
      inserted_workload_rows: inserted,
      skipped_rows: skipped,
      status,
    })
    .eq("id", batch.id);

  if (updateError) {
    errors.push(`upload_batches: ${getErrorMessage(updateError)}`);
  }

  if (status === "failed") {
    return failedResult(errors, batch.id);
  }

  return {
    deletedRows: counts?.deleted_rows ?? 0,
    errors,
    month,
    sourceFile,
    status,
    successfullyInserted: inserted,
    totalProcessed,
    uploadBatchId: batch.id,
  };
}
