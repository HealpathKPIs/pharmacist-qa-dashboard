import "server-only";

import { getActiveClinicalPharmacistNames } from "@/lib/clinical-roster";
import {
  buildProcessingTimeKpi,
  getTaskTypes,
  isSameTaskType,
  summarizeProcessingTime,
  type ProcessingFigures,
  type ProcessingTaskRow,
  type ProcessingTimeKpi,
} from "@/lib/processing-time";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { getUploadHistory } from "@/lib/upload-history";

// Processing Time KPI section (Clinical QA only). Reads the monthly task
// tracker of active pharmacists; nothing else on the page is affected.
// Formula and rules: lib/processing-time.ts.

export type ProcessingTimeFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
  taskType?: string;
};

export type ProcessingTimePeriod = {
  endDate: string;
  startDate: string;
};

export type ProcessingTimeData = ProcessingTimeKpi & {
  hasUploads: boolean;
  lastUploadAt: string | null;
  // Dates the figures cover: the filter, completed by the first and last day
  // with data. null when there is no data and no full date filter.
  period: ProcessingTimePeriod | null;
  pharmacistName: string | null;
  previous: ProcessingFigures | null;
  previousPeriod: ProcessingTimePeriod | null;
  // Selected task type as spelled in the data; null for all task types.
  taskType: string | null;
  // Task types with rows in the selected dates (any active pharmacist).
  taskTypeOptions: string[];
};

export type ProcessingTimeResult =
  | { data: ProcessingTimeData; error: null }
  | { data: null; error: string };

export type ProcessingTimeMonth = {
  actualMinutes: number;
  lastUploadAt: string;
  month: string;
  pharmacists: number;
  rows: number;
  slaMinutes: number;
  sourceFiles: string[];
};

type DayWindow = { from?: string; to?: string };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// Date filter values come from the URL; anything that is not YYYY-MM-DD is ignored.
function toFilterDay(value?: string) {
  return value && DAY_PATTERN.test(value) ? value : undefined;
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getPreviousPeriod({ endDate, startDate }: ProcessingTimePeriod) {
  const length =
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1;

  if (length < 1) {
    return null;
  }

  const previousEnd = addDays(startDate, -1);

  return { endDate: previousEnd, startDate: addDays(previousEnd, -(length - 1)) };
}

// Task rows of active pharmacists in the window.
async function fetchProcessingTasks({ from, to }: DayWindow): Promise<ProcessingTaskRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await fetchAllPages((rangeFrom, rangeTo) => {
    let query = supabase
      .from("clinical_processing_tasks_resolved")
      .select(
        "id, day, task_reference, task_type, items_completed, sla_minutes, actual_minutes, pharmacist_id, pharmacist_name",
      )
      .eq("pharmacist_active", true);

    if (from) {
      query = query.gte("day", from);
    }

    if (to) {
      query = query.lte("day", to);
    }

    return query.order("id").range(rangeFrom, rangeTo);
  });

  return rows.map((row) => ({
    actualMinutes: Number(row.actual_minutes),
    day: row.day,
    id: row.id,
    itemsCompleted: Number(row.items_completed),
    pharmacistId: row.pharmacist_id,
    pharmacistName: row.pharmacist_name,
    slaMinutes: Number(row.sla_minutes),
    taskReference: row.task_reference,
    taskType: row.task_type,
  }));
}

function pharmacistsWithRows(rows: readonly ProcessingTaskRow[]) {
  return [...new Set(rows.map((row) => row.pharmacistName))].sort((left, right) =>
    left.localeCompare(right),
  );
}

// Active pharmacists with at least one row of the task type in the dates. Used
// for the page's pharmacist filter while a task type is selected.
export async function getProcessingTimePharmacists({
  endDate,
  startDate,
  taskType,
}: {
  endDate?: string;
  startDate?: string;
  taskType: string;
}) {
  const rows = await fetchProcessingTasks({
    from: toFilterDay(startDate),
    to: toFilterDay(endDate),
  });

  return pharmacistsWithRows(rows.filter((row) => isSameTaskType(row.taskType, taskType)));
}

export async function getProcessingTimeKpi(
  filters: ProcessingTimeFilters,
): Promise<ProcessingTimeResult> {
  try {
    const startDate = toFilterDay(filters.startDate);
    const endDate = toFilterDay(filters.endDate);
    const pharmacistName = filters.pharmacistName || undefined;
    const [allRows, activePharmacists, lastUpload] = await Promise.all([
      fetchProcessingTasks({ from: startDate, to: endDate }),
      getActiveClinicalPharmacistNames(),
      getUploadHistory("clinical", 1, { uploadKind: "processing_time" }),
    ]);
    const taskTypeOptions = getTaskTypes(allRows);
    // A task type that has no rows in the dates still filters (to nothing).
    const taskType = filters.taskType
      ? (taskTypeOptions.find((option) => isSameTaskType(option, filters.taskType ?? "")) ??
        filters.taskType)
      : null;
    const matches = (row: ProcessingTaskRow) =>
      (!taskType || isSameTaskType(row.taskType, taskType)) &&
      (!pharmacistName || row.pharmacistName === pharmacistName);
    const rows = allRows.filter(matches);
    // All task types: the full active roster. A task type: only pharmacists
    // with rows of that type in the dates.
    const tablePharmacists = (
      taskType ? pharmacistsWithRows(allRows.filter(matches)) : activePharmacists
    ).filter((name) => !pharmacistName || name === pharmacistName);
    const kpi = buildProcessingTimeKpi({ pharmacists: tablePharmacists, rows });
    const dataDays = rows.map((row) => row.day).sort();
    const periodStart = startDate ?? dataDays[0];
    const periodEnd = endDate ?? dataDays.at(-1);
    const period = periodStart && periodEnd ? { endDate: periodEnd, startDate: periodStart } : null;
    const previousPeriod = period ? getPreviousPeriod(period) : null;
    let previous: ProcessingFigures | null = null;

    if (previousPeriod) {
      const previousRows = await fetchProcessingTasks({
        from: previousPeriod.startDate,
        to: previousPeriod.endDate,
      });

      previous = summarizeProcessingTime(previousRows.filter(matches));
    }

    return {
      data: {
        ...kpi,
        hasUploads: lastUpload.length > 0 || allRows.length > 0,
        lastUploadAt: lastUpload[0]?.uploadedAt ?? null,
        period,
        pharmacistName: pharmacistName ?? null,
        previous,
        previousPeriod,
        taskType,
        taskTypeOptions,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "The Processing Time KPI could not be loaded.",
    };
  }
}

// Months stored in the tracker table (all pharmacists, active or not), newest
// first, for the upload page.
export async function getProcessingTimeMonths(): Promise<ProcessingTimeMonth[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from("clinical_processing_tasks")
      .select("id, day, pharmacist_id, sla_minutes, actual_minutes, source_file, uploaded_at")
      .order("id")
      .range(from, to),
  );
  const months = new Map<
    string,
    ProcessingTimeMonth & { pharmacistIds: Set<number>; files: Set<string> }
  >();

  for (const row of rows) {
    const month = row.day.slice(0, 7);
    const entry = months.get(month) ?? {
      actualMinutes: 0,
      files: new Set<string>(),
      lastUploadAt: row.uploaded_at,
      month,
      pharmacistIds: new Set<number>(),
      pharmacists: 0,
      rows: 0,
      slaMinutes: 0,
      sourceFiles: [],
    };

    entry.rows += 1;
    entry.actualMinutes += Number(row.actual_minutes);
    entry.slaMinutes += Number(row.sla_minutes);
    entry.pharmacistIds.add(row.pharmacist_id);

    if (row.source_file) {
      entry.files.add(row.source_file);
    }

    if (row.uploaded_at > entry.lastUploadAt) {
      entry.lastUploadAt = row.uploaded_at;
    }

    months.set(month, entry);
  }

  return [...months.values()]
    .map(({ files, pharmacistIds, ...entry }) => ({
      ...entry,
      pharmacists: pharmacistIds.size,
      sourceFiles: [...files].sort(),
    }))
    .sort((left, right) => right.month.localeCompare(left.month));
}
