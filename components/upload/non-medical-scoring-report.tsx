"use client";

import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { useMemo } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WorkbookValidationResult } from "@/lib/excel-validation";
import {
  describeUnmatchedReason,
  scoreNonMedicalQaError,
  summarizeNonMedicalScoring,
} from "@/lib/non-medical-scoring";

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

// Severity scoring of a Non-Medical upload. Severity Level and Score are
// derived from each row's Category and Issue type (lib/non-medical-scoring.ts),
// the same way the dashboard derives them; nothing is added to the workbook or
// stored. Unmatched rows are still imported as QA errors, without a score.
export function NonMedicalScoringReport({
  result,
}: {
  result: Pick<WorkbookValidationResult, "qaErrors" | "summary">;
}) {
  const scoring = useMemo(
    () => summarizeNonMedicalScoring(result.qaErrors.map(scoreNonMedicalQaError)),
    [result.qaErrors],
  );
  const rowsNotScored = result.summary.totalRows - scoring.totalQaErrors;
  const summaryItems = [
    { label: "Total uploaded rows", value: result.summary.totalRows },
    { label: "Matched scoring rows", value: scoring.scoredQaErrors },
    { label: "Unmatched scoring rows", value: scoring.unmatchedQaErrors },
    { label: "Rows with derived score", value: scoring.scoredQaErrors },
  ];

  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Scale aria-hidden="true" className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-medium text-fg-strong">Severity Scoring</h3>
        </div>
        <p className="font-mono text-xs text-fg-subtle">
          Total severity {formatInteger(scoring.totalSeverityScore)}
        </p>
      </div>
      <p className="text-sm leading-6 text-fg-muted">
        Severity Level and Score are looked up from Category + Issue type in the scoring
        criteria. They are not read from the workbook and not stored.
        {rowsNotScored > 0
          ? ` Not scored: ${formatInteger(rowsNotScored)} uploaded ${rowsNotScored === 1 ? "row" : "rows"} without an Issue type or with validation errors (not QA errors).`
          : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div className="rounded-md border border-tint/10 bg-tint/[0.03] p-3" key={item.label}>
            <p className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold text-fg-strong">
              {formatInteger(item.value)}
            </p>
          </div>
        ))}
      </div>
      {scoring.unmatched.length === 0 ? (
        <Alert className="border-brand/25 bg-brand/10 text-brand-foreground">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />
          <AlertDescription>Every QA error row matched a scoring criterion.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
              {formatInteger(scoring.unmatched.length)} Category + Issue type{" "}
              {scoring.unmatched.length === 1 ? "combination has" : "combinations have"} no scoring
              criterion
            </p>
            <p className="mt-1 text-xs leading-5 text-warning-foreground/70">
              These rows are imported as QA errors without a score; no score is guessed.
              They count in Total QA Errors but add nothing to Total Severity Score.
            </p>
          </div>
          <div className="max-h-96 overflow-auto rounded-md border border-tint/10">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase tracking-normal text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Scoring category</th>
                  <th className="px-3 py-2 font-medium">Issue type</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 text-right font-medium">Rows</th>
                </tr>
              </thead>
              <tbody>
                {scoring.unmatched.map((combination) => (
                  <tr
                    className="border-t border-tint/10 text-fg-tertiary"
                    key={`${combination.category}|${combination.issueType}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2">
                      {combination.category ?? "(empty)"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-fg-muted">
                      {combination.scoringCategory ?? "—"}
                    </td>
                    <td className="min-w-64 px-3 py-2">{combination.issueType ?? "(empty)"}</td>
                    <td className="min-w-56 px-3 py-2 text-fg-muted">
                      {describeUnmatchedReason(combination)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                      {formatInteger(combination.rows)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
