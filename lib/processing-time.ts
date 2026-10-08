import { createComparisonKey, removeExtraSpaces } from "@/lib/excel-normalization";

// Processing Time KPI (Clinical QA only).
//   Processing Time % = SUM(SLA minutes) / SUM(Actual minutes) x 100
// from totals only: never an average of row or pharmacist percentages. 100% is
// on SLA, above 100% faster than SLA, below 100% slower. The stored SLA minutes
// from the tracker are used as uploaded (never recomputed).

export type ProcessingTaskRow = {
  actualMinutes: number;
  day: string;
  id: number;
  itemsCompleted: number;
  pharmacistId: number;
  pharmacistName: string;
  slaMinutes: number;
  taskReference: string;
  taskType: string;
};

export type ProcessingFigures = {
  actualMinutes: number;
  items: number;
  // null when there are no actual minutes (no rows).
  percent: number | null;
  slaMinutes: number;
  tasks: number;
};

export type ProcessingTaskTypeFigures = {
  figures: ProcessingFigures;
  taskType: string;
};

export type ProcessingTimeKpi = {
  byPharmacist: Record<string, ProcessingFigures>;
  // Task types of every pharmacist in the table, best first.
  byPharmacistTaskType: Record<string, ProcessingTaskTypeFigures[]>;
  byTaskType: ProcessingTaskTypeFigures[];
  // Table rows, in display order.
  pharmacists: string[];
  team: ProcessingFigures;
};

export function getTaskTypeKey(taskType: string) {
  return createComparisonKey(taskType);
}

export function isSameTaskType(left: string, right: string) {
  return getTaskTypeKey(left) === getTaskTypeKey(right);
}

export function getProcessingPercent(slaMinutes: number, actualMinutes: number) {
  return actualMinutes > 0 ? (slaMinutes / actualMinutes) * 100 : null;
}

export function summarizeProcessingTime(rows: readonly ProcessingTaskRow[]): ProcessingFigures {
  let actualMinutes = 0;
  let items = 0;
  let slaMinutes = 0;

  for (const row of rows) {
    actualMinutes += row.actualMinutes;
    items += row.itemsCompleted;
    slaMinutes += row.slaMinutes;
  }

  return {
    actualMinutes,
    items,
    percent: getProcessingPercent(slaMinutes, actualMinutes),
    slaMinutes,
    tasks: rows.length,
  };
}

// Distinct task types of the rows, spelled as first seen; spacing and case
// differences are the same task type.
export function getTaskTypes(rows: readonly ProcessingTaskRow[]) {
  const taskTypes = new Map<string, string>();

  for (const row of rows) {
    const key = getTaskTypeKey(row.taskType);

    if (!taskTypes.has(key)) {
      taskTypes.set(key, removeExtraSpaces(row.taskType));
    }
  }

  return [...taskTypes.values()].sort((left, right) => left.localeCompare(right));
}

function byTaskType(rows: readonly ProcessingTaskRow[]): ProcessingTaskTypeFigures[] {
  const groups = new Map<string, { rows: ProcessingTaskRow[]; taskType: string }>();

  for (const row of rows) {
    const key = getTaskTypeKey(row.taskType);
    const group = groups.get(key) ?? { rows: [], taskType: removeExtraSpaces(row.taskType) };

    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({ figures: summarizeProcessingTime(group.rows), taskType: group.taskType }))
    .sort(
      (left, right) =>
        (right.figures.percent ?? -1) - (left.figures.percent ?? -1) ||
        left.taskType.localeCompare(right.taskType),
    );
}

// rows must already be filtered (dates, task type, active pharmacists).
// pharmacists are the table rows: a pharmacist without rows shows no figure.
export function buildProcessingTimeKpi({
  pharmacists,
  rows,
}: {
  pharmacists: readonly string[];
  rows: readonly ProcessingTaskRow[];
}): ProcessingTimeKpi {
  const rowsByPharmacist = new Map<string, ProcessingTaskRow[]>();

  for (const row of rows) {
    rowsByPharmacist.set(row.pharmacistName, [
      ...(rowsByPharmacist.get(row.pharmacistName) ?? []),
      row,
    ]);
  }

  const byPharmacist: Record<string, ProcessingFigures> = {};
  const byPharmacistTaskType: Record<string, ProcessingTaskTypeFigures[]> = {};

  for (const pharmacistName of pharmacists) {
    const pharmacistRows = rowsByPharmacist.get(pharmacistName) ?? [];

    byPharmacist[pharmacistName] = summarizeProcessingTime(pharmacistRows);
    byPharmacistTaskType[pharmacistName] = byTaskType(pharmacistRows);
  }

  // Team total covers the table's pharmacists only.
  const tableRows = pharmacists.flatMap((name) => rowsByPharmacist.get(name) ?? []);

  return {
    byPharmacist,
    byPharmacistTaskType,
    byTaskType: byTaskType(tableRows),
    pharmacists: [...pharmacists],
    team: summarizeProcessingTime(tableRows),
  };
}
