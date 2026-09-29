import {
  createComparisonKey,
  removeExtraSpaces,
} from "@/lib/excel-normalization";
import { calculateQualityDeduction } from "@/lib/quality-deduction";

// Non-Medical QA severity scoring.
//
// Severity Level and Score are derived by the application from each QA error
// row's Category and Issue type. They are never part of the upload and never
// stored: the uploaded Category and Issue type, and the qa_errors.score column
// (the Need Edit flag for Non-Medical), keep their values.
//
// Source of truth: error_criteria_scored.xlsx
//   * Sheet2: the criteria, one block per scoring category.
//   * Score Legend: the points of each severity level.
// Criteria that are not in Sheet2 were confirmed separately and are marked
// below, and so are the approved alternative names of existing criteria. To
// change the criteria, edit the tables below; the dashboard and the upload
// report pick the change up without other code changes.

export const SEVERITY_LEVEL_SCORES = {
  Fatal: 20,
  Moderate: 10,
  Coaching: 3,
} as const;

export type SeverityLevel = keyof typeof SEVERITY_LEVEL_SCORES;

export const SEVERITY_LEVELS = Object.keys(
  SEVERITY_LEVEL_SCORES,
) as SeverityLevel[];

export const NON_MEDICAL_SCORING_CATEGORIES = [
  "WhatsApp Chat",
  "Call Recording",
  "Tele-Health Reservation",
] as const;

export type NonMedicalScoringCategory =
  (typeof NON_MEDICAL_SCORING_CATEGORIES)[number];

// Upload Category -> scoring category. It is only used to find the criteria;
// the uploaded Category is shown and stored unchanged.
export const NON_MEDICAL_CATEGORY_MAPPING: ReadonlyArray<
  readonly [uploadCategory: string, scoringCategory: NonMedicalScoringCategory]
> = [
  ["Tele-Health Reservation", "Tele-Health Reservation"],
  ["Chronic Inspection", "Tele-Health Reservation"],
  ["Prescription Error", "Tele-Health Reservation"],
  ["Care Plan Error", "Tele-Health Reservation"],
  ["Upload Lab Error", "Tele-Health Reservation"],
  ["Click with doctor", "Tele-Health Reservation"],
  ["Call Recording", "Call Recording"],
  ["WhatsApp Chat", "WhatsApp Chat"],
  ["Chat 360", "WhatsApp Chat"],
];

// Sheet2, in sheet order, then the confirmed criteria that Sheet2 does not
// have. Sheet2's Score column equals the Score Legend points of each row's
// severity level; confirmed scores map to levels the same way (20 Fatal,
// 10 Moderate, 3 Coaching). A confirmed criterion applies only to its own
// scoring category: the same name in another category keeps its Sheet2
// severity.
export const NON_MEDICAL_SCORING_CRITERIA: Readonly<
  Record<
    NonMedicalScoringCategory,
    ReadonlyArray<readonly [issueType: string, severityLevel: SeverityLevel]>
  >
> = {
  // Sheet2 "WhatsApp Issues"
  "WhatsApp Chat": [
    ["WhatsApp SLA", "Moderate"],
    ["No reply", "Fatal"],
    ["Incorrect information", "Fatal"],
    ["Unprofessional Behavior", "Fatal"],
    ["Missing reporting complaints", "Fatal"],
    ["Deleted messages", "Fatal"],
    ["Opening Chat", "Coaching"],
    ["Ending Chat", "Coaching"],
    ["Spelling errors", "Coaching"],
    ["Didn't use correct quick reply", "Moderate"],
    ["Lack of focus", "Coaching"],
    ["Follow Up", "Fatal"],
    ["Agent Ineffective / Unhelpful", "Fatal"],
    ["Edited Message", "Fatal"],
    ["Ending chat without asking for any another inquiry", "Coaching"],
    ["Repeated Message", "Coaching"],
    ["Using Emoji", "Coaching"],
    ["Didn't use quick reply", "Coaching"],
    ["Missing Messages", "Moderate"],
    ["Wrong Work Instructions", "Fatal"],
    ["SLA Violation for 8 Min.", "Moderate"],
    ["SLA Violation for more than 1 hour.", "Fatal"],
    ["Lack of clarification / Incomplete information", "Moderate"],
    ["Wrong chat closure / Premature closing", "Moderate"],
    ["Unnecessary Interaction", "Coaching"],
    ["Poor Wording", "Coaching"],
    ["Not Sending Required Screenshot", "Moderate"],
    ["Missing Required Information", "Moderate"],
    ["Chat Management Efficiency", "Coaching"],
    ["Chat Handling Process", "Moderate"],
    // Not in Sheet2; confirmed on 2026-09-28.
    ["Ignoring Patient Inquiries", "Coaching"],
    ["Follow Up Issue", "Moderate"],
    ["Incomplete Conversation", "Moderate"],
    ["Improper Communication", "Coaching"],
    ["Providing Incorrect Information", "Fatal"],
    // Not in Sheet2; confirmed on 2026-09-29 in the review of unmatched
    // production issues (Non-Medical Unmatched Issues.xlsx). Names as stored.
    ["Wrong Work Instruction", "Fatal"],
    ["Unprofessional", "Moderate"],
    ["Missing Reporting System Issue", "Coaching"],
    ["Didn'T Confirm Resolution", "Coaching"],
    ["Slang Word", "Moderate"],
    ["Data Confidentiality", "Fatal"],
    ["Information Delivery Failure", "Moderate"],
    ["Need Clarification", "Coaching"],
    ["Closing The Call", "Coaching"],
    ["Shift Management Efficiency", "Coaching"],
    ["Missing Message", "Moderate"],
    ["Showing Annoyance, Boredom, Or Anxiety", "Moderate"],
  ],
  // Sheet2 "Call Recording Issues"
  "Call Recording": [
    ["Greetings & Introduce Yourself", "Coaching"],
    ["Closing the Call", "Coaching"],
    ["Interrupting the patient", "Coaching"],
    ["Providing Incorrect Information", "Fatal"],
    ["Didn't Let the Patient Finish", "Coaching"],
    ["Unprofessional Tone", "Moderate"],
    ["Didn't Confirm Resolution", "Coaching"],
    ["Showing Annoyance, Boredom, or Anxiety", "Moderate"],
    ["Speaking in an Unclear Voice", "Coaching"],
    ["Speaking Rapidly", "Coaching"],
    ["Lack of focus", "Coaching"],
    ["Follow Up", "Fatal"],
    ["Wrong Work Instructions", "Fatal"],
    ["Information Delivery Failure", "Moderate"],
    ["Not Mentioning the patient's Name Twice During the Call", "Coaching"],
    ["Waiting Time Exceeds a Minute", "Coaching"],
    ["Long Silence", "Coaching"],
    ["Agent Ineffective / Unhelpful", "Fatal"],
    ["Patient Verification", "Fatal"],
    ["Unprofessional Behavior", "Fatal"],
    ["Poor connection", "Coaching"],
    ["Privacy/Compliance Breach", "Fatal"],
    ["Scheduling Inconsistency", "Moderate"],
    ["Improper Mute Usage", "Coaching"],
    ["Ignoring Patient Inquiries", "Moderate"],
    ["Not Attentive at Call Start", "Coaching"],
    ["Connectivity loss", "Coaching"],
    ["Wrong Transfer", "Moderate"],
    ["Unnecessary Repetition", "Coaching"],
    ["Improper Communication", "Moderate"],
    ["Call Management Efficiency", "Coaching"],
    ["Call Handling Process", "Moderate"],
    ["Data Accuracy", "Fatal"],
    ["Missing reporting survey", "Moderate"],
    // Sheet2 lists Call Handling Process a second time with the same severity.
    ["Data Confidentiality", "Fatal"],
    ["Shift Management Efficiency", "Coaching"],
    ["Accuracy of Information Delivery", "Moderate"],
    ["Missing reporting System issue", "Moderate"],
    ["Slang Word", "Coaching"],
    // Not in Sheet2; confirmed on 2026-09-28.
    ["Missing Reporting Complaints", "Fatal"],
    // Not in Sheet2; confirmed on 2026-09-29 in the review of unmatched
    // production issues (Non-Medical Unmatched Issues.xlsx). Names as stored.
    ["Lack Of Clarification", "Fatal"],
    ["Wrong Th Instruction", "Moderate"],
    ["Incorrect Information", "Fatal"],
    ["Incomplete Information", "Moderate"],
    ["Follow Up Issue", "Fatal"],
    ["Spelling Errors", "Coaching"],
    ["Chat Handling Process", "Moderate"],
    ["Not Attentive To Patient", "Coaching"],
    ["Incorrect Data Entry", "Moderate"],
    ["Lack Of Clarification / Incomplete Information", "Moderate"],
    ["Missing Required Information", "Moderate"],
    ["No Reply", "Fatal"],
    ["Poor Wording", "Coaching"],
    ["Wrong Assign Ccm Doctors", "Moderate"],
    ["Wrong Work Instruction", "Moderate"],
    ["ب", "Coaching"],
  ],
  // Sheet2 "Tele-Health Reservations Issues"
  "Tele-Health Reservation": [
    ["Wrong / Missing Patient Mobile Number", "Fatal"],
    ["Wrong / Missing Patient Name", "Fatal"],
    ["Wrong / Missing Patient ID", "Fatal"],
    ["Wrong / Missing Company Name", "Moderate"],
    ["Wrong / Missing Doctor Name", "Moderate"],
    ["Wrong / Missing Consultation Date", "Moderate"],
    ["Wrong / Missing Consultation Status", "Moderate"],
    ["Missing Issue type", "Moderate"],
    ["Eligibility Issue", "Fatal"],
    ["Follow Up Issue", "Fatal"],
    ["Approval Issue", "Fatal"],
    // Not in Sheet2; confirmed on 2026-09-28.
    ["Missing Appointment Details", "Moderate"],
    ["Wrong / Missing Rejection Reason", "Fatal"],
    ["Missing Upload Prescription", "Fatal"],
    ["Not Eligible", "Fatal"],
    ["Missing Upload Labs", "Fatal"],
    ["Wrong / Missing Cancellation Reason", "Fatal"],
    ["Late Review", "Fatal"],
    ["Claims Follow-Up Issue", "Moderate"],
    ["Wrong / Missing Consultation Time", "Coaching"],
    ["Wrong Work Instructions", "Moderate"],
    // Not in Sheet2; confirmed on 2026-09-29 in the review of unmatched
    // production issues (Non-Medical Unmatched Issues.xlsx). Names as stored.
    ["Wrong / Missing Follow Up (Ccm)", "Fatal"],
    ["Wrong / Missing Agent Name", "Coaching"],
    ["Data Accuracy", "Fatal"],
    ["Missing Prescription Upload", "Fatal"],
    ["Wrong Digitized Entry", "Coaching"],
    ["Wrong Th Instruction", "Moderate"],
    ["Wrong Comment Entry", "Coaching"],
    ["Not Found", "Coaching"],
    ["Missing Labs Verification", "Fatal"],
    ["Incorrect Care Plan Upload Placement", "Fatal"],
    ["Wrong / Missing Issue Type", "Fatal"],
    ["Missing Agent Name Labs Review", "Fatal"],
    ["Wrong / Missing Appoinment Follow Up By", "Moderate"],
    ["Worng Upload Labs", "Fatal"],
    ["Wrong / Missing Cancelation Reason", "Fatal"],
    ["Incomplete Upload Lab", "Moderate"],
    ["Wrong Consultation Date", "Moderate"],
    ["Incomplete Prescription", "Fatal"],
    ["Error Upload Labs", "Fatal"],
    ["Error Upload Prescription", "Fatal"],
    ["Incomplete Lab Upload", "Moderate"],
    ["Wrong Prescription Upload", "Fatal"],
    ["Incomplete Upload Prescription", "Moderate"],
    ["Wrong / Missing Consultation Type", "Fatal"],
    ["Wrong Prescription", "Moderate"],
    ["Wrong Upload Prescription", "Moderate"],
    ["Wrong / Missing Appionment Type", "Fatal"],
    ["X", "Moderate"],
    ["Lack Of Focus", "Coaching"],
    ["Unprofessional Behavior", "Fatal"],
    ["Missing Consultation", "Fatal"],
    ["Wrong Work Instruction", "Moderate"],
    ["Missing Upload Scan", "Moderate"],
  ],
};

// Approved alternative names (2026-09-29): the upload uses one half of a
// combined Sheet2 name. An alternative name scores exactly like its criterion
// and only in the scoring category it is listed under; no other variant of a
// name is matched.
export const NON_MEDICAL_ISSUE_TYPE_ALIASES: Readonly<
  Partial<
    Record<
      NonMedicalScoringCategory,
      ReadonlyArray<readonly [issueType: string, criterion: string]>
    >
  >
> = {
  "WhatsApp Chat": [
    ["Premature Closing", "Wrong chat closure / Premature closing"],
    ["Wrong Chat Closure", "Wrong chat closure / Premature closing"],
    ["Lack Of Clarification", "Lack of clarification / Incomplete information"],
    ["Incomplete Information", "Lack of clarification / Incomplete information"],
    ["Agent Unhelpful", "Agent Ineffective / Unhelpful"],
  ],
  // "Lack Of Clarification" is not approved for Call Recording; it stays unmatched.
  "Call Recording": [["Agent Unhelpful", "Agent Ineffective / Unhelpful"]],
};

export type NonMedicalUnmatchedReason =
  | "missing_category"
  | "unmapped_category"
  | "missing_issue_type"
  | "no_criterion";

export type NonMedicalScoreResult =
  | {
      status: "scored";
      // As uploaded.
      category: string;
      issueType: string;
      scoringCategory: NonMedicalScoringCategory;
      // The criterion that matched, by its own name (also when the upload used
      // an approved alternative name).
      criterion: string;
      severityLevel: SeverityLevel;
      score: number;
    }
  | {
      status: "unmatched";
      category: string | null;
      issueType: string | null;
      scoringCategory: NonMedicalScoringCategory | null;
      reason: NonMedicalUnmatchedReason;
    };

type Criterion = {
  issueType: string;
  severityLevel: SeverityLevel;
};

// Names are compared with the upload's comparison key (trimmed, single spaces,
// lower case). Stored Issue types are title-cased at import, for example
// "Didn't use quick reply" is stored as "Didn'T Use Quick Reply".
const SCORING_CATEGORY_BY_KEY = new Map(
  NON_MEDICAL_CATEGORY_MAPPING.map(([uploadCategory, scoringCategory]) => [
    createComparisonKey(uploadCategory),
    scoringCategory,
  ]),
);

function getCriterionKey(scoringCategory: NonMedicalScoringCategory, issueType: string) {
  return `${scoringCategory}|${createComparisonKey(issueType)}`;
}

const CRITERION_BY_KEY = new Map<string, Criterion>(
  NON_MEDICAL_SCORING_CATEGORIES.flatMap((scoringCategory) =>
    NON_MEDICAL_SCORING_CRITERIA[scoringCategory].map(
      ([issueType, severityLevel]) =>
        [getCriterionKey(scoringCategory, issueType), { issueType, severityLevel }] as const,
    ),
  ),
);

// Looked up only after the criteria, so an alternative name can never change a
// criterion. One that points to a missing criterion adds nothing: its rows stay
// unmatched and are reported.
const ALIAS_CRITERION_BY_KEY = new Map<string, Criterion>(
  NON_MEDICAL_SCORING_CATEGORIES.flatMap((scoringCategory) =>
    (NON_MEDICAL_ISSUE_TYPE_ALIASES[scoringCategory] ?? []).flatMap(([issueType, criterionName]) => {
      const criterion = CRITERION_BY_KEY.get(getCriterionKey(scoringCategory, criterionName));

      return criterion ? [[getCriterionKey(scoringCategory, issueType), criterion] as const] : [];
    }),
  ),
);

function toOptionalName(value: string | null | undefined) {
  const name = removeExtraSpaces(value ?? "");

  return name === "" ? null : name;
}

export function resolveNonMedicalScoringCategory(
  category: string | null | undefined,
): NonMedicalScoringCategory | null {
  const name = toOptionalName(category);

  return name ? (SCORING_CATEGORY_BY_KEY.get(createComparisonKey(name)) ?? null) : null;
}

// Category + Issue type -> Severity Level + Score. A combination without a
// criterion is reported as unmatched; it never gets a score.
export function scoreNonMedicalError({
  category,
  issueType,
}: {
  category: string | null | undefined;
  issueType: string | null | undefined;
}): NonMedicalScoreResult {
  const categoryName = toOptionalName(category);
  const issueTypeName = toOptionalName(issueType);
  const scoringCategory = resolveNonMedicalScoringCategory(categoryName);
  const unmatched = (reason: NonMedicalUnmatchedReason): NonMedicalScoreResult => ({
    category: categoryName,
    issueType: issueTypeName,
    reason,
    scoringCategory,
    status: "unmatched",
  });

  if (!categoryName) {
    return unmatched("missing_category");
  }

  if (!scoringCategory) {
    return unmatched("unmapped_category");
  }

  if (!issueTypeName) {
    return unmatched("missing_issue_type");
  }

  const key = getCriterionKey(scoringCategory, issueTypeName);
  const criterion = CRITERION_BY_KEY.get(key) ?? ALIAS_CRITERION_BY_KEY.get(key);

  if (!criterion) {
    return unmatched("no_criterion");
  }

  return {
    category: categoryName,
    criterion: criterion.issueType,
    issueType: issueTypeName,
    score: SEVERITY_LEVEL_SCORES[criterion.severityLevel],
    scoringCategory,
    severityLevel: criterion.severityLevel,
    status: "scored",
  };
}

// Non-Medical rows keep the uploaded Category inside issue_details, for example
// "Issue details: … | Category: Chat 360 | QA Agent: …" (formatIssueDetails in
// lib/excel-validation.ts). There is no category column.
const CATEGORY_FIELD_PATTERN = /(?:^| \| )Category: (.*?)(?= \| |$)/g;

export function extractNonMedicalCategory(issueDetails: string | null | undefined) {
  const values = [...(issueDetails ?? "").matchAll(CATEGORY_FIELD_PATTERN)]
    .map((match) => removeExtraSpaces(match[1]))
    .filter((value) => value !== "");

  // Free text before the field could itself contain "| Category: "; the field
  // is then the value that has a scoring category.
  return (
    values.find((value) => resolveNonMedicalScoringCategory(value) !== null) ??
    values[0] ??
    null
  );
}

// Scores a stored or parsed Non-Medical QA error row.
export function scoreNonMedicalQaError(row: {
  issueDetails: string | null;
  issueType: string;
}) {
  return scoreNonMedicalError({
    category: extractNonMedicalCategory(row.issueDetails),
    issueType: row.issueType,
  });
}

export type NonMedicalUnmatchedCombination = {
  category: string | null;
  issueType: string | null;
  reason: NonMedicalUnmatchedReason;
  rows: number;
  scoringCategory: NonMedicalScoringCategory | null;
};

export type NonMedicalScoringSummary = {
  // QA error rows: the existing Non-Medical definition (every qa_errors row).
  totalQaErrors: number;
  // Rows with a derived Severity Level and Score.
  scoredQaErrors: number;
  // Rows without a criterion. They are still QA errors but have no score.
  unmatchedQaErrors: number;
  // SUM(derived score).
  totalSeverityScore: number;
  // Total Severity Score ÷ Total QA Errors; null ("—") when there are no QA errors.
  qaDeduction: number | null;
  // Category + Issue type combinations without a criterion, most rows first.
  unmatched: NonMedicalUnmatchedCombination[];
};

// Totals are added up from the rows given, so they follow whatever filters
// selected those rows. The team QA Deduction divides the summed scores once;
// it is never an average of individual deductions.
export function summarizeNonMedicalScoring(
  results: readonly NonMedicalScoreResult[],
): NonMedicalScoringSummary {
  const unmatchedByKey = new Map<string, NonMedicalUnmatchedCombination>();
  let scoredQaErrors = 0;
  let totalSeverityScore = 0;

  for (const result of results) {
    if (result.status === "scored") {
      scoredQaErrors += 1;
      totalSeverityScore += result.score;
      continue;
    }

    const key = [
      createComparisonKey(result.category ?? ""),
      createComparisonKey(result.issueType ?? ""),
    ].join("|");
    const combination = unmatchedByKey.get(key);

    if (combination) {
      combination.rows += 1;
    } else {
      unmatchedByKey.set(key, {
        category: result.category,
        issueType: result.issueType,
        reason: result.reason,
        rows: 1,
        scoringCategory: result.scoringCategory,
      });
    }
  }

  return {
    qaDeduction: calculateQualityDeduction(totalSeverityScore, results.length).score,
    scoredQaErrors,
    totalQaErrors: results.length,
    totalSeverityScore,
    unmatched: [...unmatchedByKey.values()].sort(
      (left, right) =>
        right.rows - left.rows ||
        (left.category ?? "").localeCompare(right.category ?? "") ||
        (left.issueType ?? "").localeCompare(right.issueType ?? ""),
    ),
    unmatchedQaErrors: results.length - scoredQaErrors,
  };
}

export function describeUnmatchedReason(
  combination: Pick<NonMedicalUnmatchedCombination, "reason" | "scoringCategory">,
) {
  switch (combination.reason) {
    case "missing_category":
      return "Category is empty";
    case "unmapped_category":
      return "Category has no scoring mapping";
    case "missing_issue_type":
      return "Issue type is empty";
    case "no_criterion":
      return `Not in the ${combination.scoringCategory} criteria`;
  }
}
