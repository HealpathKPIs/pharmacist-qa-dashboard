import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DashboardDateRangeFilter = {
  startDate?: Date | string;
  endDate?: Date | string;
  pharmacistName?: string;
  issueType?: string;
};

export type DashboardTotals = {
  mostCommonIssue: string | null;
  mostCommonIssueCount: number;
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

export type DailyPatientDetail = {
  id: number;
  day: string;
  patientCount: number;
  sourceFile: string | null;
  uploadedAt: string | null;
};

export type QaErrorDetail = {
  id: number;
  day: string;
  pharmacistName: string;
  pharmacistNameRaw: string | null;
  patientId: string;
  issueType: string;
  score: number;
  issueDetails: string | null;
  sourceFile: string | null;
  uploadedAt: string | null;
};

export type SeverityDistributionPoint = {
  score: number;
  errorCount: number;
};

type DailyPatientRow = {
  day: string;
  patient_count: number;
};

type DailyPatientDetailRow = {
  id: number;
  day: string;
  patient_count: number;
  source_file: string | null;
  uploaded_at: string | null;
};

type QaErrorSummaryRow = {
  day: string;
  pharmacist_name: string;
  issue_type: string;
  score?: number;
};

type QaErrorDetailRow = {
  id: number;
  day: string;
  pharmacist_name: string;
  pharmacist_name_raw: string | null;
  patient_id: string;
  issue_type: string;
  score: number;
  issue_details: string | null;
  source_file: string | null;
  uploaded_at: string | null;
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

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function parseDatabaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateDiffInDays(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / millisecondsPerDay,
  );
}

function getDateOnlyFilters(filters: DashboardDateRangeFilter) {
  return {
    endDate: filters.endDate,
    startDate: filters.startDate,
  };
}

function getMostCommonIssue(rows: QaErrorSummaryRow[]) {
  const issueCounts = new Map<string, number>();

  for (const row of rows) {
    issueCounts.set(row.issue_type, (issueCounts.get(row.issue_type) ?? 0) + 1);
  }

  const [issueType, errorCount] = [...issueCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0] ?? [null, 0];

  return {
    mostCommonIssue: issueType,
    mostCommonIssueCount: errorCount,
  };
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
    .select("day, pharmacist_name, issue_type, score")
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

async function getCurrentDateRange(filters: DashboardDateRangeFilter = {}) {
  const providedStartDate = filters.startDate
    ? toDatabaseDate(filters.startDate)
    : undefined;
  const providedEndDate = filters.endDate ? toDatabaseDate(filters.endDate) : undefined;

  if (providedStartDate && providedEndDate) {
    return {
      endDate: providedEndDate,
      startDate: providedStartDate,
    };
  }

  const [dailyPatientRows, qaErrorRows] = await Promise.all([
    fetchDailyPatientRows(filters),
    fetchQaErrorSummaryRows(filters),
  ]);
  const candidateDays =
    filters.pharmacistName || filters.issueType
      ? qaErrorRows.map((row) => row.day)
      : [
          ...dailyPatientRows.map((row) => row.day),
          ...qaErrorRows.map((row) => row.day),
        ];
  const sortedDays = candidateDays.sort((left, right) => left.localeCompare(right));

  return {
    endDate: providedEndDate ?? sortedDays.at(-1),
    startDate: providedStartDate ?? sortedDays[0],
  };
}

export async function getPreviousPeriodFilters(
  filters: DashboardDateRangeFilter = {},
): Promise<DashboardDateRangeFilter> {
  const currentRange = await getCurrentDateRange(filters);

  if (!currentRange.startDate || !currentRange.endDate) {
    return {
      ...filters,
      endDate: undefined,
      startDate: undefined,
    };
  }

  const currentStartDate = parseDatabaseDate(currentRange.startDate);
  const currentEndDate = parseDatabaseDate(currentRange.endDate);
  const inclusiveDays = Math.max(
    1,
    dateDiffInDays(currentStartDate, currentEndDate) + 1,
  );
  const previousEndDate = addDays(currentStartDate, -1);
  const previousStartDate = addDays(previousEndDate, -(inclusiveDays - 1));

  return {
    ...filters,
    endDate: toDatabaseDate(previousEndDate),
    startDate: toDatabaseDate(previousStartDate),
  };
}

export async function getTotalPatients(
  filters: DashboardDateRangeFilter = {},
) {
  const rows = await fetchDailyPatientRows(getDateOnlyFilters(filters));

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
    fetchDailyPatientRows(getDateOnlyFilters(filters)),
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
  const [dailyPatientRows, qaErrorRows] = await Promise.all([
    fetchDailyPatientRows(getDateOnlyFilters(filters)),
    fetchQaErrorSummaryRows(filters),
  ]);
  const totalPatients = dailyPatientRows.reduce(
    (total, row) => total + row.patient_count,
    0,
  );
  const totalQaErrors = qaErrorRows.length;
  const totalPharmacists = new Set(
    qaErrorRows.map((row) => row.pharmacist_name),
  ).size;
  const mostCommonIssue = getMostCommonIssue(qaErrorRows);

  return {
    ...mostCommonIssue,
    totalPatients,
    totalQaErrors,
    totalPharmacists,
    errorRate: calculateErrorRate(totalQaErrors, totalPatients),
  };
}

export async function getDailyPatientDetails(
  filters: DashboardDateRangeFilter = {},
): Promise<DailyPatientDetail[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("daily_patients")
    .select("id, day, patient_count, source_file, uploaded_at")
    .order("day", { ascending: true });

  if (filters.startDate) {
    query = query.gte("day", toDatabaseDate(filters.startDate));
  }

  if (filters.endDate) {
    query = query.lte("day", toDatabaseDate(filters.endDate));
  }

  const { data, error } = await query.returns<DailyPatientDetailRow[]>();

  if (error) {
    throw new Error(`Failed to fetch daily patient details: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    day: row.day,
    patientCount: row.patient_count,
    sourceFile: row.source_file,
    uploadedAt: row.uploaded_at,
  }));
}

export async function getQaErrorDetails(
  filters: DashboardDateRangeFilter = {},
): Promise<QaErrorDetail[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("qa_errors")
    .select(
      [
        "id",
        "day",
        "pharmacist_name",
        "pharmacist_name_raw",
        "patient_id",
        "issue_type",
        "score",
        "issue_details",
        "source_file",
        "uploaded_at",
      ].join(","),
    )
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

  const { data, error } = await query.returns<QaErrorDetailRow[]>();

  if (error) {
    throw new Error(`Failed to fetch QA error details: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    day: row.day,
    pharmacistName: row.pharmacist_name,
    pharmacistNameRaw: row.pharmacist_name_raw,
    patientId: row.patient_id,
    issueType: row.issue_type,
    score: row.score,
    issueDetails: row.issue_details,
    sourceFile: row.source_file,
    uploadedAt: row.uploaded_at,
  }));
}

export async function getSeverityDistribution(
  filters: DashboardDateRangeFilter = {},
): Promise<SeverityDistributionPoint[]> {
  const rows = await fetchQaErrorSummaryRows(filters);
  const scoreCounts = new Map<number, number>();

  for (const row of rows) {
    if (typeof row.score === "number") {
      scoreCounts.set(row.score, (scoreCounts.get(row.score) ?? 0) + 1);
    }
  }

  return [...scoreCounts.entries()]
    .map(([score, errorCount]) => ({
      errorCount,
      score,
    }))
    .sort((left, right) => left.score - right.score);
}
