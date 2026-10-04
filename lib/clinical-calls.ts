import { createComparisonKey, removeExtraSpaces } from "@/lib/excel-normalization";

// Clinical Calls KPI (Clinical QA only).
//
// A call is one Pharmacist + Day + ID. The call-count tracker gives the number
// of evaluated calls per pharmacist and day; the Clinical QA error rows only
// say which of those calls had call-specific errors. Rows that share a
// Pharmacist + Day + ID are one call with several errors; the same ID on
// another day, or under another pharmacist, is another call.
//
// Every evaluated call starts at 20 points: Form 10 + Inside Call 10. A call
// without a call-specific error keeps all 20 (100%).
//
// Severity is the SCORE stored on each Clinical error row: 20 Fatal,
// 10 Moderate, 3 Coaching (any other value has no severity), except for the
// issues whose severity is fixed for this KPI (CALL_ISSUE_FIXED_SCORES). The
// stored SCORE is never changed and keeps feeding every other KPI. It is a
// weight, not points to subtract:
//   error penalty   = section maximum × (weight ÷ 20) × 0.50
//   section penalty = MIN(section maximum × 0.80, SUM(error penalties))
// so a section keeps at least 20% of its points and a call stays within 0–20.
//
// Error calls that cannot be matched to a call count (no count for that
// pharmacist and day, or more error calls than counted calls) are a data
// mismatch: that pharmacist-day is left out of every KPI figure, its error
// calls are never treated as clean, and it is reported as unresolved.

// pharmacist_workload.workload_type of call-count tracker rows.
export const CLINICAL_CALLS = "clinical_calls" as const;

export const CALL_SECTION_MAX = 10;
export const CALL_MAX_SCORE = 2 * CALL_SECTION_MAX;
export const CALL_PENALTY_FACTOR = 0.5;
export const CALL_SECTION_PENALTY_CAP = 0.8;
const SEVERITY_WEIGHT_SCALE = 20;

export type CallSection = "form" | "inside_call";

export const CALL_SECTION_LABELS: Record<CallSection, string> = {
  form: "Form",
  inside_call: "Inside Call",
};

// Approved call-specific issue types, as written in the approved list. Any
// other Clinical issue type is not part of this KPI.
export const CALL_ERROR_ISSUES: ReadonlyArray<
  readonly [issueType: string, section: CallSection]
> = [
  ["Incorrect or incomplete form of calls", "form"],
  ["missing documentation of info in the out bound form", "form"],
  ["Wrong data documentation in form", "form"],
  ["No form for the out bound call", "form"],
  ["Long Silence", "inside_call"],
  ["Unprofessional Tone", "inside_call"],
  ['No patient validation "didint ask about name or ID"', "inside_call"],
  ["missed question during call", "inside_call"],
  ["Inappropriate Pre-Call Conduct", "inside_call"],
  ["Not talking to patient her/himself", "inside_call"],
  ["not provding medical information about the medication", "inside_call"],
  ["Unprofessional Behavior", "inside_call"],
];

// Approved alternative spellings (decided 2026-10-04). An alternative spelling
// counts exactly like the approved issue it names, for this KPI only. Only the
// spellings listed here are matched; nothing is matched by similarity.
export const CALL_ERROR_ISSUE_ALIASES: ReadonlyArray<
  readonly [alternativeSpelling: string, issueType: string]
> = [
  [
    "Missing Documentation Of Info In The Outbound Form",
    "missing documentation of info in the out bound form",
  ],
];

// Severity fixed for this KPI whatever SCORE the row stores (decided
// 2026-10-04). The stored SCORE is not changed; the Clinical Quality Deduction
// Score and the dashboards keep using it.
export const CALL_ISSUE_FIXED_SCORES: ReadonlyArray<readonly [issueType: string, score: number]> = [
  ["Incorrect or incomplete form of calls", 10],
];

export const CALL_SEVERITY_LEVELS = ["Fatal", "Moderate", "Coaching"] as const;

export type CallSeverityLevel = (typeof CALL_SEVERITY_LEVELS)[number];

export type CallSeverity = {
  level: CallSeverityLevel;
  weight: number;
};

// Clinical row SCORE -> severity level.
const SEVERITY_LEVEL_BY_SCORE: ReadonlyMap<number, CallSeverityLevel> = new Map([
  [20, "Fatal"],
  [10, "Moderate"],
  [3, "Coaching"],
]);

export type ApprovedCallIssue = {
  // The approved name, also when the row uses an approved alternative spelling.
  issueType: string;
  section: CallSection;
};

// Stored issue types are title-cased at import, so names are compared with the
// upload's comparison key (trimmed, single spaces, lower case). Nothing else is
// matched: any other spelling is not a call-specific issue.
const APPROVED_ISSUE_BY_KEY = new Map<string, ApprovedCallIssue>(
  CALL_ERROR_ISSUES.map(([issueType, section]) => [
    createComparisonKey(issueType),
    { issueType, section },
  ]),
);

// Looked up only after the approved names, so an alternative spelling can never
// change an approved issue. One that names a missing issue adds nothing.
const ALIAS_ISSUE_BY_KEY = new Map<string, ApprovedCallIssue>(
  CALL_ERROR_ISSUE_ALIASES.flatMap(([alternativeSpelling, issueType]) => {
    const issue = APPROVED_ISSUE_BY_KEY.get(createComparisonKey(issueType));

    return issue ? [[createComparisonKey(alternativeSpelling), issue] as const] : [];
  }),
);

const FIXED_SCORE_BY_ISSUE_KEY = new Map(
  CALL_ISSUE_FIXED_SCORES.map(([issueType, score]) => [createComparisonKey(issueType), score]),
);

export function getApprovedCallIssue(issueType: string): ApprovedCallIssue | null {
  const key = createComparisonKey(issueType);

  return APPROVED_ISSUE_BY_KEY.get(key) ?? ALIAS_ISSUE_BY_KEY.get(key) ?? null;
}

export function getCallErrorSection(issueType: string): CallSection | null {
  return getApprovedCallIssue(issueType)?.section ?? null;
}

// Letters and digits only, so "Outbound" and "out bound", or curly and
// straight quotes, give the same key.
function getCompactIssueKey(issueType: string) {
  return createComparisonKey(issueType).replace(/[^a-z0-9]/g, "");
}

const APPROVED_ISSUE_BY_COMPACT_KEY = new Map(
  CALL_ERROR_ISSUES.map(([issueType, section]) => [
    getCompactIssueKey(issueType),
    { issueType, section },
  ]),
);

// A warning only: an issue type that is neither an approved call issue nor an
// approved alternative spelling, but differs from an approved issue only in
// spacing or punctuation. It is reported so the spelling can be reviewed; it is
// never counted or scored.
export function getNearMissCallIssue(issueType: string): ApprovedCallIssue | null {
  if (getApprovedCallIssue(issueType)) {
    return null;
  }

  const compactKey = getCompactIssueKey(issueType);

  return compactKey ? (APPROVED_ISSUE_BY_COMPACT_KEY.get(compactKey) ?? null) : null;
}

// null: the SCORE is not 20, 10 or 3, so the error has no severity.
export function getCallSeverity(score: number): CallSeverity | null {
  const level = SEVERITY_LEVEL_BY_SCORE.get(score);

  return level ? { level, weight: score } : null;
}

// The SCORE an approved call issue is fixed at for this KPI; undefined when
// the row's stored SCORE is used.
export function getFixedCallScore(issueType: string) {
  const issue = getApprovedCallIssue(issueType);

  return issue ? FIXED_SCORE_BY_ISSUE_KEY.get(createComparisonKey(issue.issueType)) : undefined;
}

export function calculateErrorPenalty(weight: number) {
  return CALL_SECTION_MAX * (weight / SEVERITY_WEIGHT_SCALE) * CALL_PENALTY_FACTOR;
}

export type CallScore = {
  // SUM of the severity weights of the call's errors; may exceed 20. It is
  // reported, never used as the call score.
  rawSeverityWeight: number;
  formPenalty: number;
  insideCallPenalty: number;
  formScore: number;
  insideCallScore: number;
  // Form Score + Inside Call Score, 0–20.
  finalCallScore: number;
  // Final Call Score ÷ 20 × 100.
  callQualityPercent: number;
};

function getSectionPenalty(penalties: number) {
  return Math.min(CALL_SECTION_MAX * CALL_SECTION_PENALTY_CAP, Math.max(0, penalties));
}

// Each error lowers only its own section. Errors without a severity add
// nothing.
export function scoreCallErrors(
  errors: readonly { section: CallSection; severity: CallSeverity | null }[],
): CallScore {
  let rawSeverityWeight = 0;
  let formPenalties = 0;
  let insideCallPenalties = 0;

  for (const { section, severity } of errors) {
    if (!severity) {
      continue;
    }

    rawSeverityWeight += severity.weight;

    if (section === "form") {
      formPenalties += calculateErrorPenalty(severity.weight);
    } else {
      insideCallPenalties += calculateErrorPenalty(severity.weight);
    }
  }

  const formPenalty = getSectionPenalty(formPenalties);
  const insideCallPenalty = getSectionPenalty(insideCallPenalties);
  const formScore = CALL_SECTION_MAX - formPenalty;
  const insideCallScore = CALL_SECTION_MAX - insideCallPenalty;
  const finalCallScore = formScore + insideCallScore;

  return {
    callQualityPercent: (finalCallScore / CALL_MAX_SCORE) * 100,
    finalCallScore,
    formPenalty,
    formScore,
    insideCallPenalty,
    insideCallScore,
    rawSeverityWeight,
  };
}

// A Clinical QA error row as read from the database (any issue type).
export type CallErrorRow = {
  day: string;
  id: number;
  issueType: string;
  patientId: string;
  pharmacistId: number;
  pharmacistName: string;
  score: number;
};

// A call-specific error. The row's own fields (issueType, score) are kept as
// stored.
export type CallError = CallErrorRow & {
  // The approved issue name (the row may use an approved alternative spelling).
  approvedIssueType: string;
  // 0 when the error has no severity.
  penalty: number;
  section: CallSection;
  severity: CallSeverity | null;
  // stored: from the row's SCORE; fixed: CALL_ISSUE_FIXED_SCORES.
  severitySource: "stored" | "fixed";
};

export type ScoredCall = CallScore & {
  day: string;
  errors: CallError[];
  key: string;
  patientId: string;
  pharmacistId: number;
  pharmacistName: string;
  // Approved issues listed more than once on this call. Every row still counts.
  repeatedIssueTypes: string[];
};

export function getCallKey(row: { day: string; patientId: string; pharmacistId: number }) {
  return `${row.pharmacistId}|${row.day}|${removeExtraSpaces(row.patientId)}`;
}

function comparePharmacistDays(
  left: { day: string; pharmacistName: string },
  right: { day: string; pharmacistName: string },
) {
  return left.day.localeCompare(right.day) || left.pharmacistName.localeCompare(right.pharmacistName);
}

// Keeps the call-specific rows and groups them by Pharmacist + Day + ID: one
// call per group, with every row of the group as one of its errors.
export function groupCallErrors(rows: readonly CallErrorRow[]): ScoredCall[] {
  const errorsByKey = new Map<string, CallError[]>();

  for (const row of rows) {
    const issue = getApprovedCallIssue(row.issueType);

    if (!issue) {
      continue;
    }

    const fixedScore = getFixedCallScore(row.issueType);
    const severity = getCallSeverity(fixedScore ?? row.score);
    const key = getCallKey(row);
    const errors = errorsByKey.get(key) ?? [];

    errors.push({
      ...row,
      approvedIssueType: issue.issueType,
      penalty: severity ? calculateErrorPenalty(severity.weight) : 0,
      section: issue.section,
      severity,
      severitySource: fixedScore === undefined ? "stored" : "fixed",
    });
    errorsByKey.set(key, errors);
  }

  return [...errorsByKey.entries()]
    .map(([key, errors]) => {
      const [first] = errors;
      const issueCounts = new Map<string, number>();

      for (const error of errors) {
        const issueKey = createComparisonKey(error.approvedIssueType);

        issueCounts.set(issueKey, (issueCounts.get(issueKey) ?? 0) + 1);
      }

      return {
        ...scoreCallErrors(errors),
        day: first.day,
        errors,
        key,
        patientId: removeExtraSpaces(first.patientId),
        pharmacistId: first.pharmacistId,
        pharmacistName: first.pharmacistName,
        repeatedIssueTypes: [
          ...new Set(
            errors
              .filter(
                (error) => (issueCounts.get(createComparisonKey(error.approvedIssueType)) ?? 0) > 1,
              )
              .map((error) => error.approvedIssueType),
          ),
        ],
      };
    })
    .sort(
      (left, right) =>
        comparePharmacistDays(left, right) || left.patientId.localeCompare(right.patientId),
    );
}

// One call-count tracker record: evaluated calls of a pharmacist on a day.
export type CallCountRow = {
  calls: number;
  day: string;
  pharmacistId: number;
  pharmacistName: string;
};

// valid: counted in the KPI.
// no_call_count: error calls on a pharmacist-day without a call count.
// error_calls_exceed_count: more error calls than counted calls.
// The last two are a Data Mismatch and stay out of every KPI figure.
export type CallDayStatus = "valid" | "no_call_count" | "error_calls_exceed_count";

export type CallPharmacistDay = {
  // Evaluated calls from the tracker; null when there is no call count.
  calls: number | null;
  // Valid days only: calls without a call-specific error.
  cleanCalls: number;
  day: string;
  errorCalls: ScoredCall[];
  pharmacistId: number;
  pharmacistName: string;
  status: CallDayStatus;
};

export function isDataMismatch(day: Pick<CallPharmacistDay, "status">) {
  return day.status !== "valid";
}

// Joins call counts and error calls on Pharmacist + Day.
export function matchCallsToCounts({
  callCounts,
  errorCalls,
}: {
  callCounts: readonly CallCountRow[];
  errorCalls: readonly ScoredCall[];
}): CallPharmacistDay[] {
  type MatchedDay = Omit<CallPharmacistDay, "cleanCalls" | "status">;

  const daysByKey = new Map<string, MatchedDay>();

  function getDay(row: { day: string; pharmacistId: number; pharmacistName: string }) {
    const key = `${row.pharmacistId}|${row.day}`;
    const existing = daysByKey.get(key);

    if (existing) {
      return existing;
    }

    const created: MatchedDay = {
      calls: null,
      day: row.day,
      errorCalls: [],
      pharmacistId: row.pharmacistId,
      pharmacistName: row.pharmacistName,
    };

    daysByKey.set(key, created);

    return created;
  }

  for (const row of callCounts) {
    const day = getDay(row);

    day.calls = (day.calls ?? 0) + row.calls;
  }

  for (const call of errorCalls) {
    getDay(call).errorCalls.push(call);
  }

  return [...daysByKey.values()]
    .map((day): CallPharmacistDay => {
      const status: CallDayStatus =
        day.calls === null
          ? "no_call_count"
          : day.errorCalls.length > day.calls
            ? "error_calls_exceed_count"
            : "valid";

      return {
        ...day,
        cleanCalls: status === "valid" && day.calls !== null ? day.calls - day.errorCalls.length : 0,
        status,
      };
    })
    .sort(comparePharmacistDays);
}

function toPercent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : null;
}

export type CallFigures = {
  // Evaluated calls (valid pharmacist-days only).
  totalCalls: number;
  // Distinct calls with at least one call-specific error.
  errorCalls: number;
  cleanCalls: number;
  // Call-specific error rows of the error calls.
  errorRows: number;
  // SUM(Final Call Score); clean calls add 20 each.
  actualScore: number;
  // Total calls × 20.
  possibleScore: number;
  formScore: number;
  insideCallScore: number;
  rawSeverityWeight: number;
  // Percentages: null ("—") when there are no evaluated calls.
  callQuality: number | null;
  formQuality: number | null;
  insideCallQuality: number | null;
  errorRate: number | null;
  errorFreeRate: number | null;
  fatalErrors: number;
  moderateErrors: number;
  coachingErrors: number;
  // Error rows without a severity (no penalty).
  unmatchedErrors: number;
};

// Totals of the valid pharmacist-days given; mismatched days add nothing.
// Scores are added up first and divided once: never an average of
// percentages or of error-row scores.
export function summarizeCallDays(days: readonly CallPharmacistDay[]): CallFigures {
  let totalCalls = 0;
  let errorCalls = 0;
  let errorRows = 0;
  let actualScore = 0;
  let formScore = 0;
  let insideCallScore = 0;
  let rawSeverityWeight = 0;
  let fatalErrors = 0;
  let moderateErrors = 0;
  let coachingErrors = 0;
  let unmatchedErrors = 0;

  for (const day of days) {
    if (day.status !== "valid" || day.calls === null) {
      continue;
    }

    totalCalls += day.calls;
    actualScore += day.cleanCalls * CALL_MAX_SCORE;
    formScore += day.cleanCalls * CALL_SECTION_MAX;
    insideCallScore += day.cleanCalls * CALL_SECTION_MAX;

    for (const call of day.errorCalls) {
      errorCalls += 1;
      actualScore += call.finalCallScore;
      formScore += call.formScore;
      insideCallScore += call.insideCallScore;
      rawSeverityWeight += call.rawSeverityWeight;

      for (const error of call.errors) {
        errorRows += 1;

        if (error.severity?.level === "Fatal") {
          fatalErrors += 1;
        } else if (error.severity?.level === "Moderate") {
          moderateErrors += 1;
        } else if (error.severity?.level === "Coaching") {
          coachingErrors += 1;
        } else {
          unmatchedErrors += 1;
        }
      }
    }
  }

  const cleanCalls = totalCalls - errorCalls;
  const possibleScore = totalCalls * CALL_MAX_SCORE;

  return {
    actualScore,
    callQuality: toPercent(actualScore, possibleScore),
    cleanCalls,
    coachingErrors,
    errorCalls,
    errorFreeRate: toPercent(cleanCalls, totalCalls),
    errorRate: toPercent(errorCalls, totalCalls),
    errorRows,
    fatalErrors,
    formQuality: toPercent(formScore, totalCalls * CALL_SECTION_MAX),
    formScore,
    insideCallQuality: toPercent(insideCallScore, totalCalls * CALL_SECTION_MAX),
    insideCallScore,
    moderateErrors,
    possibleScore,
    rawSeverityWeight,
    totalCalls,
    unmatchedErrors,
  };
}

export type UnresolvedCallsSummary = {
  // Pharmacist-days marked Data Mismatch.
  mismatchDays: number;
  // Their call-specific error calls and rows: never scored, never clean.
  errorCalls: number;
  errorRows: number;
  // Calls counted on days with more error calls than counted calls; held out
  // of the KPI with their day.
  heldCalls: number;
};

export function summarizeUnresolvedDays(
  days: readonly CallPharmacistDay[],
): UnresolvedCallsSummary {
  const mismatchDays = days.filter(isDataMismatch);

  return {
    errorCalls: mismatchDays.reduce((total, day) => total + day.errorCalls.length, 0),
    errorRows: mismatchDays.reduce(
      (total, day) =>
        total + day.errorCalls.reduce((callTotal, call) => callTotal + call.errors.length, 0),
      0,
    ),
    heldCalls: mismatchDays.reduce((total, day) => total + (day.calls ?? 0), 0),
    mismatchDays: mismatchDays.length,
  };
}

export const CALL_QUALITY_BANDS = [
  { band: "Excellent", minimum: 90 },
  { band: "Good", minimum: 80 },
  { band: "Needs Improvement", minimum: 70 },
  { band: "Critical", minimum: Number.NEGATIVE_INFINITY },
] as const;

export type CallQualityBand = (typeof CALL_QUALITY_BANDS)[number]["band"];

export function formatCallPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

// The band follows the percentage as shown (2 decimals), so 89.996% is shown
// as 90.00% and is Excellent.
export function getCallQualityBand(percent: number | null): CallQualityBand | null {
  if (percent === null) {
    return null;
  }

  const shownPercent = Number(percent.toFixed(2));

  return (
    CALL_QUALITY_BANDS.find(({ minimum }) => shownPercent >= minimum)?.band ?? "Critical"
  );
}

export type ClinicalCallsKpi = {
  byPharmacist: Record<string, CallFigures>;
  // Every pharmacist-day with a call count or an error call, oldest first.
  days: CallPharmacistDay[];
  // Table rows: the active roster (all of it, or only the selected name), then
  // any other name in the data, so the table always adds up to the totals.
  pharmacists: string[];
  team: CallFigures;
  unresolved: UnresolvedCallsSummary;
  unresolvedByPharmacist: Record<string, UnresolvedCallsSummary>;
};

export function buildClinicalCallsKpi({
  activePharmacists,
  callCounts,
  errorRows,
  selectedPharmacist,
}: {
  activePharmacists: readonly string[];
  callCounts: readonly CallCountRow[];
  errorRows: readonly CallErrorRow[];
  selectedPharmacist?: string;
}): ClinicalCallsKpi {
  const days = matchCallsToCounts({ callCounts, errorCalls: groupCallErrors(errorRows) });
  const rosterNames = selectedPharmacist
    ? activePharmacists.filter((name) => name === selectedPharmacist)
    : [...activePharmacists];
  const listed = new Set(rosterNames);
  const pharmacists = [
    ...rosterNames,
    ...new Set(days.map((day) => day.pharmacistName).filter((name) => !listed.has(name))),
  ];
  const daysOf = (pharmacist: string) => days.filter((day) => day.pharmacistName === pharmacist);

  return {
    byPharmacist: Object.fromEntries(
      pharmacists.map((pharmacist) => [pharmacist, summarizeCallDays(daysOf(pharmacist))]),
    ),
    days,
    pharmacists,
    team: summarizeCallDays(days),
    unresolved: summarizeUnresolvedDays(days),
    unresolvedByPharmacist: Object.fromEntries(
      pharmacists.map((pharmacist) => [pharmacist, summarizeUnresolvedDays(daysOf(pharmacist))]),
    ),
  };
}
