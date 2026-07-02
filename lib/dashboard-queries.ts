import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DashboardDateRangeFilter = {
  startDate?: Date | string;
  endDate?: Date | string;
  pharmacistName?: string;
  issueType?: string;
};

export type DashboardTotals = {
  totalPatients: number;
  totalQaErrors: number;
  totalPharmacists: number;
  errorRate: number;
};

export type ErrorsByPharmacist = {
  pharmacistName: string;
  errorCount: number;
};

export type ErrorsByIssue = {
  issueType: string;
  errorCount: number;
};

export type DailyTrendPoint = {
  day: string;
  patientCount: number;
  errorCount: number;
  errorRate: number;
};

type DailyPatientRow = {
  day: string;
  patient_count: number;
};

type QaErrorSummaryRow = {
  day: string;
  pharmacist_name: string;
  issue_type: string;
};

function toDatabaseDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function calculateErrorRate(errorCount: number, patientCount: number) {
  if (patientCount === 0) {
    return 0;
  }

  return (errorCount / patientCount) * 100;
}

async function fetchDailyPatientRows(
  filters: DashboardDateRangeFilter = {},
): Promise<DailyPatientRow[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("daily_patients")
    .select("day, patient_count")
    .order("day", { ascending: true });

  if (filters.startDate) {
    query = query.gte("day", toDatabaseDate(filters.startDate));
  }

  if (filters.endDate) {
    query = query.lte("day", toDatabaseDate(filters.endDate));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch daily patients: ${error.message}`);
  }

  return data ?? [];
}

async function fetchQaErrorSummaryRows(
  filters: DashboardDateRangeFilter = {},
): Promise<QaErrorSummaryRow[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("qa_errors")
    .select("day, pharmacist_name, issue_type")
    .order("day", { ascending: true });

  if (filters.startDate) {
    query = query.gte("day", toDatabaseDate(filters.startDate));
  }

  if (filters.endDate) {
    query = query.lte("day", toDatabaseDate(filters.endDate));
  }

  if (filters.pharmacistName) {
    query = query.eq("pharmacist_name", filters.pharmacistName);
  }

  if (filters.issueType) {
    query = query.eq("issue_type", filters.issueType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch QA errors: ${error.message}`);
  }

  return data ?? [];
}

export async function getTotalPatients(
  filters: DashboardDateRangeFilter = {},
) {
  const rows = await fetchDailyPatientRows(filters);

  return rows.reduce((total, row) => total + row.patient_count, 0);
}

export async function getTotalQaErrors(
  filters: DashboardDateRangeFilter = {},
) {
  const rows = await fetchQaErrorSummaryRows(filters);

  return rows.length;
}

export async function getTotalPharmacists(
  filters: DashboardDateRangeFilter = {},
) {
  const rows = await fetchQaErrorSummaryRows(filters);

  return new Set(rows.map((row) => row.pharmacist_name)).size;
}

export async function getErrorRate(filters: DashboardDateRangeFilter = {}) {
  const [totalPatients, totalQaErrors] = await Promise.all([
    getTotalPatients(filters),
    getTotalQaErrors(filters),
  ]);

  return calculateErrorRate(totalQaErrors, totalPatients);
}

export async function getErrorsByPharmacist(
  filters: DashboardDateRangeFilter = {},
): Promise<ErrorsByPharmacist[]> {
  const rows = await fetchQaErrorSummaryRows(filters);
  const groupedRows = new Map<string, number>();

  for (const row of rows) {
    groupedRows.set(
      row.pharmacist_name,
      (groupedRows.get(row.pharmacist_name) ?? 0) + 1,
    );
  }

  return [...groupedRows.entries()]
    .map(([pharmacistName, errorCount]) => ({
      pharmacistName,
      errorCount,
    }))
    .sort((left, right) => right.errorCount - left.errorCount);
}

export async function getErrorsByIssue(
  filters: DashboardDateRangeFilter = {},
): Promise<ErrorsByIssue[]> {
  const rows = await fetchQaErrorSummaryRows(filters);
  const groupedRows = new Map<string, number>();

  for (const row of rows) {
    groupedRows.set(row.issue_type, (groupedRows.get(row.issue_type) ?? 0) + 1);
  }

  return [...groupedRows.entries()]
    .map(([issueType, errorCount]) => ({
      issueType,
      errorCount,
    }))
    .sort((left, right) => right.errorCount - left.errorCount);
}

export async function getDailyTrend(
  filters: DashboardDateRangeFilter = {},
): Promise<DailyTrendPoint[]> {
  const [dailyPatientRows, qaErrorRows] = await Promise.all([
    fetchDailyPatientRows(filters),
    fetchQaErrorSummaryRows(filters),
  ]);
  const trendRows = new Map<string, Omit<DailyTrendPoint, "day" | "errorRate">>();

  for (const row of dailyPatientRows) {
    const existingRow = trendRows.get(row.day) ?? {
      patientCount: 0,
      errorCount: 0,
    };

    trendRows.set(row.day, {
      ...existingRow,
      patientCount: existingRow.patientCount + row.patient_count,
    });
  }

  for (const row of qaErrorRows) {
    const existingRow = trendRows.get(row.day) ?? {
      patientCount: 0,
      errorCount: 0,
    };

    trendRows.set(row.day, {
      ...existingRow,
      errorCount: existingRow.errorCount + 1,
    });
  }

  return [...trendRows.entries()]
    .map(([day, row]) => ({
      day,
      patientCount: row.patientCount,
      errorCount: row.errorCount,
      errorRate: calculateErrorRate(row.errorCount, row.patientCount),
    }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

export async function getDashboardTotals(
  filters: DashboardDateRangeFilter = {},
): Promise<DashboardTotals> {
  const [totalPatients, totalQaErrors, totalPharmacists] = await Promise.all([
    getTotalPatients(filters),
    getTotalQaErrors(filters),
    getTotalPharmacists(filters),
  ]);

  return {
    totalPatients,
    totalQaErrors,
    totalPharmacists,
    errorRate: calculateErrorRate(totalQaErrors, totalPatients),
  };
}
