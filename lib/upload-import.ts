import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { WorkbookValidationResult } from "@/lib/excel-validation";
import type { Database } from "@/types/database";

const INSERT_CHUNK_SIZE = 500;

type DailyPatientInsert = Database["public"]["Tables"]["daily_patients"]["Insert"];
type QaErrorInsert = Database["public"]["Tables"]["qa_errors"]["Insert"];
type UploadBatchInsert = Database["public"]["Tables"]["upload_batches"]["Insert"];
type UploadStatus = "success" | "partial" | "failed";

export type ImportUploadResult = {
  sourceFile: string;
  status: UploadStatus;
  totalProcessed: number;
  successfullyInserted: number;
  failed: number;
  skipped: number;
  insertedDailyPatients: number;
  insertedQaErrors: number;
  failedDailyPatients: number;
  failedQaErrors: number;
  failedValidationRows: number;
  uploadBatchId: number | null;
  errors: string[];
};

type InsertRowsResult = {
  insertedRows: number;
  failedRows: number;
  errors: string[];
};

function toDatabaseDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getImportStatus(insertedRows: number, failedRows: number): UploadStatus {
  if (failedRows === 0) {
    return "success";
  }

  return insertedRows > 0 ? "partial" : "failed";
}

function getErrorMessage(error: PostgrestError | Error | null) {
  return error?.message ?? "Unknown database error.";
}

async function insertDailyPatientRows(
  rows: DailyPatientInsert[],
): Promise<InsertRowsResult> {
  const supabase = getSupabaseAdminClient();
  let insertedRows = 0;
  let failedRows = 0;
  const errors: string[] = [];

  for (let startIndex = 0; startIndex < rows.length; startIndex += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(startIndex, startIndex + INSERT_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("daily_patients")
      .insert(chunk)
      .select("id");

    if (error) {
      failedRows += chunk.length;
      errors.push(`daily_patients: ${getErrorMessage(error)}`);
      continue;
    }

    insertedRows += data?.length ?? chunk.length;
  }

  return {
    insertedRows,
    failedRows,
    errors,
  };
}

async function insertQaErrorRows(rows: QaErrorInsert[]): Promise<InsertRowsResult> {
  const supabase = getSupabaseAdminClient();
  let insertedRows = 0;
  let failedRows = 0;
  const errors: string[] = [];

  for (let startIndex = 0; startIndex < rows.length; startIndex += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(startIndex, startIndex + INSERT_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("qa_errors")
      .insert(chunk)
      .select("id");

    if (error) {
      failedRows += chunk.length;
      errors.push(`qa_errors: ${getErrorMessage(error)}`);
      continue;
    }

    insertedRows += data?.length ?? chunk.length;
  }

  return {
    insertedRows,
    failedRows,
    errors,
  };
}

async function recordUploadBatch(batch: UploadBatchInsert) {
  const { data, error } = await getSupabaseAdminClient()
    .from("upload_batches")
    .insert(batch)
    .select("id")
    .single();

  return {
    id: data?.id ?? null,
    error,
  };
}

export async function importValidatedWorkbook({
  sourceFile,
  validationResult,
}: {
  sourceFile: string;
  validationResult: WorkbookValidationResult;
}): Promise<ImportUploadResult> {
  const dailyPatientRows: DailyPatientInsert[] = validationResult.dailyPatients.map(
    (row) => ({
      day: toDatabaseDate(row.day),
      patient_count: row.patientCount,
      source_file: sourceFile,
    }),
  );
  const qaErrorRows: QaErrorInsert[] = validationResult.qaErrors.map((row) => ({
    pharmacist_name: row.pharmacistName,
    pharmacist_name_raw: row.pharmacistNameRaw,
    day: toDatabaseDate(row.day),
    patient_id: row.patientId,
    issue_type: row.issueType,
    score: row.score,
    issue_details: row.issueDetails || null,
    source_file: sourceFile,
  }));

  const [dailyPatientsInsert, qaErrorsInsert] = await Promise.all([
    insertDailyPatientRows(dailyPatientRows),
    insertQaErrorRows(qaErrorRows),
  ]);
  const insertedDailyPatients = dailyPatientsInsert.insertedRows;
  const insertedQaErrors = qaErrorsInsert.insertedRows;
  const failedDailyPatients = dailyPatientsInsert.failedRows;
  const failedQaErrors = qaErrorsInsert.failedRows;
  const failedValidationRows = validationResult.invalidRows.length;
  const successfullyInserted = insertedDailyPatients + insertedQaErrors;
  const failed =
    failedDailyPatients + failedQaErrors + failedValidationRows;
  const skipped = validationResult.summary.skippedEmptyRows;
  const status = getImportStatus(successfullyInserted, failed);
  const uploadBatch = await recordUploadBatch({
    file_name: sourceFile,
    source_file: sourceFile,
    inserted_daily_patients: insertedDailyPatients,
    inserted_qa_errors: insertedQaErrors,
    rows_patients_inserted: insertedDailyPatients,
    rows_errors_inserted: insertedQaErrors,
    skipped_rows: skipped,
    failed_rows: failed,
    status,
  });
  const errors = [...dailyPatientsInsert.errors, ...qaErrorsInsert.errors];

  if (uploadBatch.error) {
    errors.push(`upload_batches: ${getErrorMessage(uploadBatch.error)}`);
  }

  return {
    sourceFile,
    status: uploadBatch.error ? "partial" : status,
    totalProcessed: validationResult.summary.totalRows,
    successfullyInserted,
    failed,
    skipped,
    insertedDailyPatients,
    insertedQaErrors,
    failedDailyPatients,
    failedQaErrors,
    failedValidationRows,
    uploadBatchId: uploadBatch.id,
    errors,
  };
}
