import "server-only";

import { getActiveClinicalPharmacistNames } from "@/lib/clinical-roster";
import type { QaErrorDetail } from "@/lib/dashboard-queries";
import {
  addMonths,
  buildMonthlyReconciliation,
  getMonthEndDay,
  getMonthKey,
  getMonthStartDay,
  listMonths,
  MEDICATION_RECONCILIATION,
  RECONCILIATION_ERROR_ISSUE_TYPES,
  type MonthKey,
  type ReconciliationMonth,
} from "@/lib/reconciliation";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { getUploadHistory } from "@/lib/upload-history";

// Monthly Medication Reconciliation section (Clinical QA only). It has its own
// queries and never changes the existing Clinical dashboard calculations.

export type ReconciliationMonthlyFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
};

export type ReconciliationMonthlyData = {
  currentMonth: MonthKey;
  // Reconciliation error rows of the shown months, for drill-down.
  errorRows: QaErrorDetail[];
  lastTrackerUploadAt: string | null;
  // Shown months, oldest first.
  months: ReconciliationMonth[];
  pharmacists: string[];
  // The month before the latest shown month (month-over-month comparison).
  previousMonth: ReconciliationMonth | null;
};

export type ReconciliationMonthlyResult =
  | { data: ReconciliationMonthlyData; error: null }
  | { data: null; error: string };

const MAX_MONTHS_WITHOUT_DATE_RANGE = 12;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toValidDay(value?: string) {
  return value && DAY_PATTERN.test(value) ? value : undefined;
}

async function fetchWorkloadRows({ from, to }: { from?: string; to?: string }) {
  const supabase = getSupabaseAdminClient();

  return fetchAllPages((rangeFrom, rangeTo) => {
    let query = supabase
      .from("clinical_workload_resolved")
      .select("id, day, item_count, pharmacist_name")
      .eq("workload_type", MEDICATION_RECONCILIATION)
      .eq("pharmacist_active", true);

    if (from) {
      query = query.gte("day", from);
    }

    if (to) {
      query = query.lte("day", to);
    }

    return query.order("id").range(rangeFrom, rangeTo);
  });
}

async function fetchReconciliationErrorRows({ from, to }: { from: string; to: string }) {
  const supabase = getSupabaseAdminClient();

  return fetchAllPages((rangeFrom, rangeTo) =>
    supabase
      .from("clinical_qa_errors_resolved")
      .select(
        "id, day, pharmacist_name, pharmacist_name_raw, patient_id, issue_type, score, issue_details, source_file, uploaded_at",
      )
      .eq("pharmacist_active", true)
      .in("issue_type", [...RECONCILIATION_ERROR_ISSUE_TYPES])
      .gte("day", from)
      .lte("day", to)
      .order("id")
      .range(rangeFrom, rangeTo),
  );
}

export async function getReconciliationMonthly(
  filters: ReconciliationMonthlyFilters,
): Promise<ReconciliationMonthlyResult> {
  try {
    const startDate = toValidDay(filters.startDate);
    const endDate = toValidDay(filters.endDate);
    const startMonth = startDate ? getMonthKey(startDate) : undefined;
    const endMonth = endDate ? getMonthKey(endDate) : undefined;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [workloadRows, activePharmacists, lastTrackerUpload] = await Promise.all([
      fetchWorkloadRows({
        // One extra month before the range for the month-over-month comparison.
        from: startMonth ? getMonthStartDay(addMonths(startMonth, -1)) : undefined,
        to: endMonth ? getMonthEndDay(endMonth) : undefined,
      }),
      getActiveClinicalPharmacistNames(),
      getUploadHistory("clinical", 1, { uploadKind: "reconciliation_workload" }),
    ]);
    const pharmacists = filters.pharmacistName
      ? activePharmacists.filter((name) => name === filters.pharmacistName)
      : activePharmacists;
    const workload = workloadRows
      .filter((row) => pharmacists.includes(row.pharmacist_name))
      .map((row) => ({
        day: row.day,
        itemCount: row.item_count,
        pharmacistName: row.pharmacist_name,
      }));
    const dataMonths = [...new Set(workload.map((row) => getMonthKey(row.day)))].sort();
    // A full date range shows every calendar month it touches, in full.
    // Otherwise: the latest months that have tracker data.
    const shownMonths =
      startMonth && endMonth
        ? listMonths(startMonth, endMonth)
        : dataMonths
            .filter(
              (month) =>
                (!startMonth || month >= startMonth) &&
                (!endMonth || month <= endMonth),
            )
            .slice(-MAX_MONTHS_WITHOUT_DATE_RANGE);
    const lastTrackerUploadAt = lastTrackerUpload[0]?.uploadedAt ?? null;

    if (shownMonths.length === 0) {
      return {
        data: {
          currentMonth,
          errorRows: [],
          lastTrackerUploadAt,
          months: [],
          pharmacists,
          previousMonth: null,
        },
        error: null,
      };
    }

    const latestMonth = shownMonths[shownMonths.length - 1];
    const previousMonthKey = addMonths(latestMonth, -1);
    const firstNeededMonth =
      previousMonthKey < shownMonths[0] ? previousMonthKey : shownMonths[0];
    const errorRows = (
      await fetchReconciliationErrorRows({
        from: getMonthStartDay(firstNeededMonth),
        to: getMonthEndDay(latestMonth),
      })
    ).filter((row) => pharmacists.includes(row.pharmacist_name));
    const computedMonths = buildMonthlyReconciliation({
      errorRows: errorRows.map((row) => ({
        day: row.day,
        pharmacistName: row.pharmacist_name,
      })),
      months: shownMonths.includes(previousMonthKey)
        ? shownMonths
        : [previousMonthKey, ...shownMonths],
      pharmacists,
      workloadRows: workload,
    });
    const shownMonthKeys = new Set(shownMonths);

    return {
      data: {
        currentMonth,
        errorRows: errorRows
          .filter((row) => shownMonthKeys.has(getMonthKey(row.day)))
          .map((row) => ({
            day: row.day,
            id: row.id,
            issueDetails: row.issue_details,
            issueType: row.issue_type,
            patientId: row.patient_id,
            pharmacistName: row.pharmacist_name,
            pharmacistNameRaw: row.pharmacist_name_raw,
            score: row.score,
            sourceFile: row.source_file,
            uploadedAt: row.uploaded_at,
          })),
        lastTrackerUploadAt,
        months: computedMonths.filter((month) => shownMonthKeys.has(month.month)),
        pharmacists,
        previousMonth:
          computedMonths.find((month) => month.month === previousMonthKey) ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "The monthly reconciliation data could not be loaded.",
    };
  }
}
