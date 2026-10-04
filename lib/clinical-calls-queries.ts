import "server-only";

import {
  buildClinicalCallsKpi,
  CLINICAL_CALLS,
  getApprovedCallIssue,
  getCallErrorSection,
  getCallKey,
  getFixedCallScore,
  getNearMissCallIssue,
  type CallCountRow,
  type CallErrorRow,
  type CallFigures,
  type CallSection,
  type ClinicalCallsKpi,
} from "@/lib/clinical-calls";
import { getActiveClinicalPharmacistNames } from "@/lib/clinical-roster";
import { createComparisonKey, removeExtraSpaces } from "@/lib/excel-normalization";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { getUploadHistory } from "@/lib/upload-history";

// Clinical Calls KPI section (Clinical QA only). It has its own queries and
// only reads: the call counts from the calls tracker and the Clinical QA error
// rows of active pharmacists (through the same roster view as the other
// Clinical KPIs). Nothing else on the page is affected. Formula and rules:
// lib/clinical-calls.ts.

export type ClinicalCallsFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
};

export type ClinicalCallsPeriod = {
  endDate: string;
  startDate: string;
};

export type ClinicalCallsChecks = {
  // Days with calls after the latest day of any Clinical QA row: no QA upload
  // covers them yet, so their calls currently count as clean.
  callsAfterLatestQaDay: { calls: number; days: number };
  // Days with calls but no Clinical QA row of any type (any pharmacist).
  callDaysWithoutQaRows: Array<{ calls: number; day: string }>;
  // Call issues stored with more than one SCORE in the period, among the
  // issues scored from the stored SCORE (a fixed severity ignores it). Each row
  // keeps its own SCORE; this is reported for QA consistency only.
  inconsistentScores: Array<{ issueType: string; scores: Array<{ rows: number; score: number }> }>;
  // Latest day of any Clinical QA row in the period (any issue type).
  latestQaDay: string | null;
  // Issue types spelled like an approved call issue but not exactly (spacing or
  // punctuation), and not an approved alternative spelling. A warning only:
  // never counted or scored.
  nearMissIssueTypes: Array<{
    approvedIssueType: string;
    calls: number;
    issueType: string;
    rows: number;
    section: CallSection;
  }>;
  // Other Clinical issue types of the period (not call-specific): left out of
  // this KPI only.
  otherIssueTypes: Array<{ issueType: string; rows: number }>;
  // Calls on which the same issue type is listed more than once.
  repeatedIssueCalls: number;
  // Call-specific errors without a severity: the stored SCORE is not 20, 10 or
  // 3 and the issue has no fixed severity.
  unmatchedSeverities: Array<{ issueType: string; rows: number; score: number }>;
  // Call-specific error rows under names that match no Clinical pharmacist;
  // null when the check could not run.
  unrosteredCallErrors: Array<{ calls: number; pharmacistName: string; rows: number }> | null;
};

export type ClinicalCallsData = ClinicalCallsKpi & {
  checks: ClinicalCallsChecks;
  // At least one calls tracker upload exists (any dates).
  hasCallCountUploads: boolean;
  lastUploadAt: string | null;
  // Dates the figures cover: the filter, completed by the first and last day
  // with data. null when there is no data and no full date filter.
  period: ClinicalCallsPeriod | null;
  pharmacistName: string | null;
  // Valid figures of the previous period of the same length.
  previous: CallFigures | null;
  previousPeriod: ClinicalCallsPeriod | null;
};

export type ClinicalCallsResult =
  | { data: ClinicalCallsData; error: null }
  | { data: null; error: string };

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

function getPreviousPeriod({ endDate, startDate }: ClinicalCallsPeriod) {
  const length =
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1;

  if (length < 1) {
    return null;
  }

  const previousEnd = addDays(startDate, -1);

  return { endDate: previousEnd, startDate: addDays(previousEnd, -(length - 1)) };
}

async function fetchCallCounts({ from, to }: DayWindow): Promise<CallCountRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await fetchAllPages((rangeFrom, rangeTo) => {
    let query = supabase
      .from("clinical_workload_resolved")
      .select("id, day, item_count, pharmacist_id, pharmacist_name")
      .eq("workload_type", CLINICAL_CALLS)
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
    calls: row.item_count,
    day: row.day,
    pharmacistId: row.pharmacist_id,
    pharmacistName: row.pharmacist_name,
  }));
}

// Every Clinical QA error row of active pharmacists in the window, any issue
// type: the call-specific rows feed the KPI, the rest only the data checks.
async function fetchClinicalErrorRows({ from, to }: DayWindow): Promise<CallErrorRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await fetchAllPages((rangeFrom, rangeTo) => {
    let query = supabase
      .from("clinical_qa_errors_resolved")
      .select("id, day, issue_type, patient_id, pharmacist_id, pharmacist_name, score")
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
    day: row.day,
    id: row.id,
    issueType: row.issue_type,
    patientId: row.patient_id,
    pharmacistId: row.pharmacist_id,
    pharmacistName: row.pharmacist_name,
    score: row.score,
  }));
}

// Call-specific errors stored under names that match no Clinical pharmacist
// (Settings > Clinical Pharmacists lists those names). They cannot be matched
// to a call count, so they are reported, never scored.
async function fetchUnrosteredCallErrors({
  from,
  to,
}: DayWindow): Promise<ClinicalCallsChecks["unrosteredCallErrors"]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: names, error } = await supabase
      .from("clinical_unmatched_names")
      .select("pharmacist_name");

    if (error) {
      throw new Error(error.message);
    }

    if (!names || names.length === 0) {
      return [];
    }

    const rows = await fetchAllPages((rangeFrom, rangeTo) => {
      let query = supabase
        .from("qa_errors")
        .select("id, day, issue_type, patient_id, pharmacist_name")
        .eq("audit_type", "clinical")
        .in(
          "pharmacist_name",
          names.map((name) => name.pharmacist_name),
        );

      if (from) {
        query = query.gte("day", from);
      }

      if (to) {
        query = query.lte("day", to);
      }

      return query.order("id").range(rangeFrom, rangeTo);
    });
    const byName = new Map<string, { calls: Set<string>; rows: number }>();

    for (const row of rows) {
      if (!getCallErrorSection(row.issue_type)) {
        continue;
      }

      const entry = byName.get(row.pharmacist_name) ?? { calls: new Set<string>(), rows: 0 };

      entry.rows += 1;
      entry.calls.add(`${row.day}|${removeExtraSpaces(row.patient_id)}`);
      byName.set(row.pharmacist_name, entry);
    }

    return [...byName.entries()]
      .map(([pharmacistName, entry]) => ({
        calls: entry.calls.size,
        pharmacistName,
        rows: entry.rows,
      }))
      .sort((left, right) => right.rows - left.rows);
  } catch {
    return null;
  }
}

// Issue checks use the selected rows; QA coverage (which days have any
// Clinical QA row) uses every active pharmacist's rows.
function buildChecks({
  callCounts,
  errorRows,
  kpi,
  teamErrorRows,
  unrosteredCallErrors,
}: {
  callCounts: CallCountRow[];
  errorRows: CallErrorRow[];
  kpi: ClinicalCallsKpi;
  teamErrorRows: CallErrorRow[];
  unrosteredCallErrors: ClinicalCallsChecks["unrosteredCallErrors"];
}): ClinicalCallsChecks {
  const qaDays = new Set(teamErrorRows.map((row) => row.day));
  const latestQaDay = [...qaDays].sort().at(-1) ?? null;
  const callsByDay = new Map<string, number>();

  for (const row of callCounts) {
    callsByDay.set(row.day, (callsByDay.get(row.day) ?? 0) + row.calls);
  }

  const daysWithCalls = [...callsByDay.entries()]
    .filter(([, calls]) => calls > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  const daysAfterLatestQaDay = daysWithCalls.filter(
    ([day]) => latestQaDay === null || day > latestQaDay,
  );
  const otherIssueTypes = new Map<string, number>();
  const nearMissIssueTypes = new Map<
    string,
    ClinicalCallsChecks["nearMissIssueTypes"][number] & { callKeys: Set<string> }
  >();
  const scoresByIssue = new Map<string, { issueType: string; scores: Map<number, number> }>();
  const unmatchedSeverities = new Map<string, { issueType: string; rows: number; score: number }>();

  for (const row of errorRows) {
    const issue = getApprovedCallIssue(row.issueType);

    if (issue) {
      // Issues with a fixed severity do not use the stored SCORE.
      if (getFixedCallScore(row.issueType) === undefined) {
        const issueKey = createComparisonKey(issue.issueType);
        const entry = scoresByIssue.get(issueKey) ?? {
          issueType: issue.issueType,
          scores: new Map(),
        };

        entry.scores.set(row.score, (entry.scores.get(row.score) ?? 0) + 1);
        scoresByIssue.set(issueKey, entry);
      }

      continue;
    }

    const nearMiss = getNearMissCallIssue(row.issueType);

    if (!nearMiss) {
      otherIssueTypes.set(row.issueType, (otherIssueTypes.get(row.issueType) ?? 0) + 1);
      continue;
    }

    const entry = nearMissIssueTypes.get(row.issueType) ?? {
      approvedIssueType: nearMiss.issueType,
      callKeys: new Set<string>(),
      calls: 0,
      issueType: row.issueType,
      rows: 0,
      section: nearMiss.section,
    };

    entry.rows += 1;
    entry.callKeys.add(getCallKey(row));
    nearMissIssueTypes.set(row.issueType, entry);
  }

  for (const day of kpi.days) {
    for (const call of day.errorCalls) {
      for (const error of call.errors) {
        if (error.severity) {
          continue;
        }

        const key = `${error.issueType}|${error.score}`;
        const entry = unmatchedSeverities.get(key) ?? {
          issueType: error.issueType,
          rows: 0,
          score: error.score,
        };

        entry.rows += 1;
        unmatchedSeverities.set(key, entry);
      }
    }
  }

  return {
    // Days after the latest QA day are reported in callsAfterLatestQaDay.
    callDaysWithoutQaRows: daysWithCalls
      .filter(([day]) => latestQaDay !== null && day <= latestQaDay && !qaDays.has(day))
      .map(([day, calls]) => ({ calls, day })),
    callsAfterLatestQaDay: {
      calls: daysAfterLatestQaDay.reduce((total, [, calls]) => total + calls, 0),
      days: daysAfterLatestQaDay.length,
    },
    inconsistentScores: [...scoresByIssue.values()]
      .filter((entry) => entry.scores.size > 1)
      .map((entry) => ({
        issueType: entry.issueType,
        scores: [...entry.scores.entries()]
          .map(([score, rows]) => ({ rows, score }))
          .sort((left, right) => right.rows - left.rows),
      })),
    latestQaDay,
    nearMissIssueTypes: [...nearMissIssueTypes.values()]
      .map(({ callKeys, ...entry }) => ({ ...entry, calls: callKeys.size }))
      .sort((left, right) => right.rows - left.rows),
    otherIssueTypes: [...otherIssueTypes.entries()]
      .map(([issueType, rows]) => ({ issueType, rows }))
      .sort((left, right) => right.rows - left.rows || left.issueType.localeCompare(right.issueType)),
    repeatedIssueCalls: kpi.days.reduce(
      (total, day) =>
        total + day.errorCalls.filter((call) => call.repeatedIssueTypes.length > 0).length,
      0,
    ),
    unmatchedSeverities: [...unmatchedSeverities.values()].sort(
      (left, right) => right.rows - left.rows,
    ),
    unrosteredCallErrors,
  };
}

function getDataPeriod(
  { endDate, startDate }: { endDate?: string; startDate?: string },
  kpi: ClinicalCallsKpi,
): ClinicalCallsPeriod | null {
  const dataDays = kpi.days.map((day) => day.day).sort();
  const start = startDate ?? dataDays[0];
  const end = endDate ?? dataDays.at(-1);

  return start && end ? { endDate: end, startDate: start } : null;
}

export async function getClinicalCallsKpi(
  filters: ClinicalCallsFilters,
): Promise<ClinicalCallsResult> {
  try {
    const startDate = toFilterDay(filters.startDate);
    const endDate = toFilterDay(filters.endDate);
    const pharmacistName = filters.pharmacistName || undefined;
    const window = { from: startDate, to: endDate };
    const [allCallCounts, teamErrorRows, activePharmacists, lastUpload, unrosteredCallErrors] =
      await Promise.all([
        fetchCallCounts(window),
        fetchClinicalErrorRows(window),
        getActiveClinicalPharmacistNames(),
        getUploadHistory("clinical", 1, { uploadKind: "calls_workload" }),
        // A selected pharmacist is a roster name, so the check does not apply.
        pharmacistName ? Promise.resolve([]) : fetchUnrosteredCallErrors(window),
      ]);
    const isSelected = (row: { pharmacistName: string }) =>
      !pharmacistName || row.pharmacistName === pharmacistName;
    const callCounts = allCallCounts.filter(isSelected);
    const errorRows = teamErrorRows.filter(isSelected);
    const kpi = buildClinicalCallsKpi({
      activePharmacists,
      callCounts,
      errorRows,
      selectedPharmacist: pharmacistName,
    });
    const period = getDataPeriod({ endDate, startDate }, kpi);
    const previousPeriod = period ? getPreviousPeriod(period) : null;
    let previous: CallFigures | null = null;

    if (previousPeriod) {
      const previousWindow = { from: previousPeriod.startDate, to: previousPeriod.endDate };
      const [previousCallCounts, previousErrorRows] = await Promise.all([
        fetchCallCounts(previousWindow),
        fetchClinicalErrorRows(previousWindow),
      ]);

      previous = buildClinicalCallsKpi({
        activePharmacists,
        callCounts: previousCallCounts.filter(isSelected),
        errorRows: previousErrorRows.filter(isSelected),
        selectedPharmacist: pharmacistName,
      }).team;
    }

    const lastUploadAt = lastUpload[0]?.uploadedAt ?? null;

    return {
      data: {
        ...kpi,
        checks: buildChecks({ callCounts, errorRows, kpi, teamErrorRows, unrosteredCallErrors }),
        hasCallCountUploads: lastUpload.length > 0 || allCallCounts.length > 0,
        lastUploadAt,
        period,
        pharmacistName: pharmacistName ?? null,
        previous,
        previousPeriod,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "The Clinical Calls KPI could not be loaded.",
    };
  }
}
