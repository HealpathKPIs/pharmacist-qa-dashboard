"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Gauge,
  Headset,
  Info,
  PhoneCall,
  Siren,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { MonthlyMetricCard } from "@/components/kpi/medication-reconciliation/reconciliation-monthly-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CALL_ERROR_ISSUE_ALIASES,
  CALL_ERROR_ISSUES,
  CALL_ISSUE_FIXED_SCORES,
  CALL_SECTION_LABELS,
  CALL_SEVERITY_LEVELS,
  formatCallPercent,
  getCallSeverity,
  getCallQualityBand,
  isDataMismatch,
  summarizeCallDays,
  summarizeUnresolvedDays,
  type CallError,
  type CallFigures,
  type CallPharmacistDay,
  type CallQualityBand,
  type ScoredCall,
  type UnresolvedCallsSummary,
} from "@/lib/clinical-calls";
import type {
  ClinicalCallsChecks,
  ClinicalCallsData,
  ClinicalCallsPeriod,
  ClinicalCallsResult,
} from "@/lib/clinical-calls-queries";
import { cn } from "@/lib/utils";

// A table row: one pharmacist, or null for the team total.
type Selection = { pharmacist: string | null } | null;

const BAND_STYLES: Record<CallQualityBand, string> = {
  Excellent: "border-brand/25 bg-brand/10 text-brand-strong",
  Good: "border-info/25 bg-info/10 text-info",
  "Needs Improvement": "border-warning/30 bg-warning/10 text-warning-strong",
  Critical: "border-danger/25 bg-danger/10 text-danger-strong",
};

// Ranges are joined by hand: Intl formatRange spacing differs between Node and
// browsers, which breaks hydration.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// The KPI's explicit rules, written from the tables in lib/clinical-calls.ts.
const ALIAS_RULES = CALL_ERROR_ISSUE_ALIASES.map(
  ([alternativeSpelling, issueType]) => `"${alternativeSpelling}" counts as "${issueType}"`,
).join("; ");
const FIXED_SCORE_RULES = CALL_ISSUE_FIXED_SCORES.map(
  ([issueType, score]) =>
    `${issueType} = ${getCallSeverity(score)?.level ?? "no severity"} (${score})`,
).join("; ");

// A fixed time zone, so the server and the browser show the same text.
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
});

function toDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : formatCallPercent(value);
}

function formatPercentDifference(value: number) {
  return `${value.toFixed(2)} pp`;
}

function formatDay(day: string) {
  return dateFormatter.format(toDate(day));
}

function formatPeriod(period: ClinicalCallsPeriod | null) {
  if (!period) {
    return "All dates";
  }

  const { endDate, startDate } = period;

  if (startDate === endDate) {
    return formatDay(startDate);
  }

  const startFormatter =
    startDate.slice(0, 4) === endDate.slice(0, 4) ? dayFormatter : dateFormatter;

  return `${startFormatter.format(toDate(startDate))} – ${dateFormatter.format(toDate(endDate))}`;
}

function formatUploadTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "No call counts uploaded yet";
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatInteger(count)} ${count === 1 ? singular : pluralForm}`;
}

function describeMismatch(day: CallPharmacistDay) {
  return day.status === "no_call_count"
    ? "No call count for this pharmacist and day"
    : `${plural(day.errorCalls.length, "error call")} but ${plural(day.calls ?? 0, "call")} counted`;
}

function SectionHeader({
  caption,
  lastUploadAt,
}: {
  caption?: string;
  lastUploadAt?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-brand">Clinical QA</p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-fg-strong">
          Clinical Calls KPI
        </h2>
        {caption ? <p className="mt-1 text-xs text-fg-subtle">{caption}</p> : null}
        {lastUploadAt !== undefined ? (
          <p className="mt-1 text-xs text-fg-subtle">
            Last call-count upload: {formatUploadTime(lastUploadAt)}
          </p>
        ) : null}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Call Quality = total call score ÷ (calls evaluated × 20) × 100. Each evaluated call
        starts at 20 points (Form 10 + Inside Call 10); a call without a call error keeps 20/20.
        Exact dates selected, compared with the previous period of the same length.
      </p>
    </div>
  );
}

function BandChip({ className, percent }: { className?: string; percent: number | null }) {
  const band = getCallQualityBand(percent);

  if (!band) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        BAND_STYLES[band],
        className,
      )}
    >
      {band}
    </span>
  );
}

function MismatchChip({ days }: { days: number }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning-strong">
      <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      Data mismatch{days > 1 ? ` · ${formatInteger(days)} days` : ""}
    </span>
  );
}

function CalculationTile({
  highlight = false,
  label,
  note,
  value,
}: {
  highlight?: boolean;
  label: string;
  note?: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg border px-4 py-3",
        highlight ? "border-brand/25 bg-brand/[0.06]" : "border-tint/10 bg-inset",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-normal text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold leading-none",
          highlight ? "text-brand-strong" : "text-fg-strong",
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-1.5 text-xs text-fg-subtle">{note}</p> : null}
    </div>
  );
}

function Operator({ label, symbol }: { label: string; symbol: string }) {
  return (
    <span
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-tint/10 bg-surface font-mono text-lg text-fg-muted"
      role="img"
    >
      {symbol}
    </span>
  );
}

function HowItIsCalculated({ figures }: { figures: CallFigures }) {
  return (
    <div className="rounded-lg border border-tint/10 bg-inset p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-fg-strong">
        <Info aria-hidden="true" className="h-4 w-4 text-brand" />
        How it is calculated
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-foreground">
            Call Quality % = Total Call Score ÷ (Calls Evaluated × 20) × 100
          </p>
          <p className="text-fg-muted">
            Each call: Form (10) + Inside Call (10). An error costs its own section 10 × (SCORE ÷
            20) × 0.50 points: Fatal 5.00, Moderate 2.50, Coaching 0.75. A section loses at most
            8 of its 10 points, so a call stays within 0–20.
          </p>
          {figures.callQuality === null ? (
            <p className="pt-1 text-fg-strong">
              There are no evaluated calls for these filters, so there is no Call Quality (—).
            </p>
          ) : (
            <p className="pt-1 font-mono text-fg-strong">
              {formatPoints(figures.actualScore)} ÷ ({formatInteger(figures.totalCalls)} × 20) × 100
              = {formatCallPercent(figures.callQuality)}
            </p>
          )}
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-fg-muted">
          <li>Calls evaluated come from the calls tracker; error rows never add calls.</li>
          <li>
            Rows with the same pharmacist, day and ID are one call with several errors. Only the{" "}
            {CALL_ERROR_ISSUES.length} approved call issue types count
            {ALIAS_RULES ? ` (approved spelling: ${ALIAS_RULES})` : ""}.
          </li>
          <li>
            Severity is the SCORE on each Clinical error row: 20 Fatal, 10 Moderate, 3 Coaching.
            {FIXED_SCORE_RULES
              ? ` Fixed for this KPI whatever SCORE is stored: ${FIXED_SCORE_RULES}. Stored SCOREs are not changed.`
              : ""}
          </li>
          <li>Calls without a call error score 20/20 and stay in the denominator.</li>
          <li>Team totals add every pharmacist&apos;s scores and calls, then divide once.</li>
          <li>
            Pharmacist-days whose error calls do not match the call count are left out until the
            data is fixed; they are listed under Unresolved Calls.
          </li>
          <li>Only active Clinical pharmacists are included.</li>
        </ul>
      </div>
    </div>
  );
}

function CallQualityCard({
  figures,
  periodLabel,
  unresolved,
}: {
  figures: CallFigures;
  periodLabel: string;
  unresolved: UnresolvedCallsSummary;
}) {
  return (
    <Card className="animate-soft-in border-tint/10 bg-transparent bg-gradient-to-br from-surface-from to-surface-to shadow-(--shadow-card-lg)">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
              <Gauge aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
                Call Quality
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="font-mono text-4xl font-semibold leading-none text-fg-strong">
                  {formatPercent(figures.callQuality)}
                </p>
                <BandChip percent={figures.callQuality} />
                {unresolved.mismatchDays > 0 ? (
                  <MismatchChip days={unresolved.mismatchDays} />
                ) : null}
              </div>
              <p className="mt-3 text-sm text-fg-muted">
                {plural(figures.totalCalls, "call")} evaluated
              </p>
              <p className="mt-1 text-xs text-fg-subtle">{periodLabel}</p>
            </div>
          </div>
          <div
            aria-label="Calculation"
            className="flex flex-col gap-2 sm:flex-row sm:items-stretch xl:max-w-3xl xl:flex-1"
            role="group"
          >
            <CalculationTile label="Total call score" value={formatPoints(figures.actualScore)} />
            <Operator label="divided by" symbol="÷" />
            <CalculationTile
              label="Possible score"
              note={`${formatInteger(figures.totalCalls)} calls × 20`}
              value={formatInteger(figures.possibleScore)}
            />
            <Operator label="equals" symbol="=" />
            <CalculationTile
              highlight
              label="Call Quality"
              value={formatPercent(figures.callQuality)}
            />
          </div>
        </div>
        <HowItIsCalculated figures={figures} />
      </CardContent>
    </Card>
  );
}

function MismatchBanner({
  checks,
  unresolved,
}: {
  checks: ClinicalCallsChecks;
  unresolved: UnresolvedCallsSummary;
}) {
  const unrosteredRows = (checks.unrosteredCallErrors ?? []).reduce(
    (total, entry) => total + entry.rows,
    0,
  );
  const nearMissRows = checks.nearMissIssueTypes.reduce((total, entry) => total + entry.rows, 0);
  const [firstNearMiss] = checks.nearMissIssueTypes;

  if (unresolved.mismatchDays === 0 && unrosteredRows === 0 && nearMissRows === 0) {
    return null;
  }

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/[0.08] px-4 py-3 text-sm text-warning-foreground"
      role="alert"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-medium">Data mismatch: the KPI covers reconciled pharmacist-days only.</p>
        {unresolved.mismatchDays > 0 ? (
          <p className="leading-6">
            {plural(unresolved.mismatchDays, "pharmacist-day")} have call errors that do not
            match the call counts: {plural(unresolved.errorCalls, "error call")} (
            {plural(unresolved.errorRows, "error row")}) are not scored and never counted as
            clean
            {unresolved.heldCalls > 0
              ? `; the ${plural(unresolved.heldCalls, "counted call")} of those days are held out with them`
              : ""}
            . Upload the missing call counts or correct the error rows.
          </p>
        ) : null}
        {unrosteredRows > 0 ? (
          <p className="leading-6">
            {plural(unrosteredRows, "call error row")} are under names that are not in the
            Clinical pharmacist list, so they cannot be matched to a call count.
          </p>
        ) : null}
        {firstNearMiss ? (
          <p className="leading-6">
            {plural(nearMissRows, "error row")} are spelled like an approved call issue but not
            exactly (for example &quot;{firstNearMiss.issueType}&quot; and the approved &quot;
            {firstNearMiss.approvedIssueType}&quot;). They are not counted until the spelling is
            approved.
          </p>
        ) : null}
        <p>
          <a className="font-medium underline underline-offset-4" href="#clinical-calls-unresolved">
            See Unresolved Calls
          </a>
        </p>
      </div>
    </div>
  );
}

function MetricCards({
  figures,
  periodLabel,
  previous,
}: {
  figures: CallFigures;
  periodLabel: string;
  previous: CallFigures | null;
}) {
  const previousLabel = "vs previous period";
  const callsLabel = (count: number) => `${formatInteger(count)} of ${plural(figures.totalCalls, "call")}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <MonthlyMetricCard
        current={figures.totalCalls}
        formatter={formatInteger}
        icon={PhoneCall}
        label="Total Calls Evaluated"
        monthLabel={periodLabel}
        previous={previous?.totalCalls ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.errorFreeRate}
        differenceFormatter={formatPercentDifference}
        formatter={formatCallPercent}
        icon={CheckCircle2}
        label="Error-Free Calls"
        monthLabel={`${callsLabel(figures.cleanCalls)} without a call error`}
        previous={previous?.errorFreeRate ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.errorRate}
        differenceFormatter={formatPercentDifference}
        formatter={formatCallPercent}
        higherIsBetter={false}
        icon={AlertTriangle}
        label="Error Rate"
        monthLabel={`${callsLabel(figures.errorCalls)} with a call error`}
        previous={previous?.errorRate ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.formQuality}
        differenceFormatter={formatPercentDifference}
        formatter={formatCallPercent}
        icon={ClipboardList}
        label="Form Quality"
        monthLabel={`${formatPoints(figures.formScore)} of ${formatInteger(figures.totalCalls * 10)} points`}
        previous={previous?.formQuality ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.insideCallQuality}
        differenceFormatter={formatPercentDifference}
        formatter={formatCallPercent}
        icon={Headset}
        label="Inside Call Quality"
        monthLabel={`${formatPoints(figures.insideCallScore)} of ${formatInteger(figures.totalCalls * 10)} points`}
        previous={previous?.insideCallQuality ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.fatalErrors}
        formatter={formatInteger}
        higherIsBetter={false}
        icon={Siren}
        label="Fatal Errors"
        monthLabel="Error rows rated Fatal (20)"
        previous={previous?.fatalErrors ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.moderateErrors}
        formatter={formatInteger}
        higherIsBetter={false}
        icon={AlertCircle}
        label="Moderate Errors"
        monthLabel="Error rows rated Moderate (10)"
        previous={previous?.moderateErrors ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.coachingErrors}
        formatter={formatInteger}
        higherIsBetter={false}
        icon={Info}
        label="Coaching Errors"
        monthLabel="Error rows rated Coaching (3)"
        previous={previous?.coachingErrors ?? null}
        previousLabel={previousLabel}
      />
    </div>
  );
}

function PercentCell({ value }: { value: number | null }) {
  return (
    <TableCell className="whitespace-nowrap text-right align-top font-mono text-sm text-foreground">
      {formatPercent(value)}
    </TableCell>
  );
}

function FiguresRow({
  figures,
  label,
  onSelect,
  strong = false,
  unresolved,
}: {
  figures: CallFigures;
  label: string;
  onSelect: () => void;
  strong?: boolean;
  unresolved: UnresolvedCallsSummary;
}) {
  return (
    <TableRow className={strong ? "bg-tint/[0.03]" : undefined}>
      <TableCell className="align-top">
        <button
          aria-label={`${label}: ${formatPercent(figures.callQuality)} Call Quality from ${plural(figures.totalCalls, "call")} evaluated. Show the calls.`}
          className={cn(
            "group inline-flex items-center gap-1 whitespace-nowrap rounded-md text-left transition-colors hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            strong ? "font-semibold text-fg-strong" : "font-medium text-fg-secondary",
          )}
          onClick={onSelect}
          type="button"
        >
          {label}
          <ChevronRight
            aria-hidden="true"
            className="h-3.5 w-3.5 text-fg-subtle transition-transform group-hover:translate-x-0.5"
          />
        </button>
        {unresolved.mismatchDays > 0 ? (
          <span className="mt-1 block">
            <MismatchChip days={unresolved.mismatchDays} />
          </span>
        ) : null}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {formatInteger(figures.totalCalls)}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {formatInteger(figures.errorCalls)}
        {figures.errorRows > 0 ? (
          <span className="mt-1 block text-xs text-fg-subtle">{plural(figures.errorRows, "error")}</span>
        ) : null}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {formatInteger(figures.cleanCalls)}
      </TableCell>
      <TableCell className="align-top">
        <span className={cn("block font-mono text-sm font-semibold", strong ? "text-fg-strong" : "text-foreground")}>
          {formatPercent(figures.callQuality)}
        </span>
        {figures.callQuality === null ? null : (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <BandChip percent={figures.callQuality} />
            <span className="font-mono text-xs text-fg-subtle">
              {formatPoints(figures.actualScore)} / {formatInteger(figures.possibleScore)}
            </span>
          </span>
        )}
      </TableCell>
      <PercentCell value={figures.formQuality} />
      <PercentCell value={figures.insideCallQuality} />
      <PercentCell value={figures.errorRate} />
      <PercentCell value={figures.errorFreeRate} />
    </TableRow>
  );
}

function PharmacistTable({
  data,
  onSelect,
}: {
  data: ClinicalCallsData;
  onSelect: (selection: NonNullable<Selection>) => void;
}) {
  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Pharmacist</TableHead>
                <TableHead className="text-right">Total Calls</TableHead>
                <TableHead className="text-right">Error Calls</TableHead>
                <TableHead className="text-right">Clean Calls</TableHead>
                <TableHead className="min-w-40">Call Quality</TableHead>
                <TableHead className="text-right">Form Quality</TableHead>
                <TableHead className="text-right">Inside Call</TableHead>
                <TableHead className="text-right">Error Rate</TableHead>
                <TableHead className="text-right">Error-Free</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pharmacists.map((pharmacist) => (
                <FiguresRow
                  figures={data.byPharmacist[pharmacist]}
                  key={pharmacist}
                  label={pharmacist}
                  onSelect={() => onSelect({ pharmacist })}
                  unresolved={data.unresolvedByPharmacist[pharmacist]}
                />
              ))}
              <FiguresRow
                figures={data.team}
                label="Team total"
                onSelect={() => onSelect({ pharmacist: null })}
                strong
                unresolved={data.unresolved}
              />
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
          Percentages use each pharmacist&apos;s evaluated calls (Total Calls). The team total adds
          every pharmacist&apos;s call scores and calls, then divides once; it is not an average of
          pharmacist percentages. Error Calls counts distinct calls; the number below it counts
          error rows. Click a name to see the calls.
        </p>
      </CardContent>
    </Card>
  );
}

function describeSeverity(error: CallError) {
  if (!error.severity) {
    return `No criterion (SCORE ${error.score}): no penalty`;
  }

  const { level, weight } = error.severity;

  if (error.severitySource === "fixed") {
    return `${level} (SCORE ${weight}, fixed for this KPI${
      error.score === weight ? "" : `; stored ${error.score}`
    })`;
  }

  return `${level} (SCORE ${weight})`;
}

// Penalties are shown only for scored calls; a call on a mismatched day has none.
function ErrorList({ call, scored }: { call: ScoredCall; scored: boolean }) {
  return (
    <ul className="space-y-1.5">
      {call.errors.map((error) => (
        <li key={error.id}>
          <span className="block text-fg-tertiary">{error.issueType}</span>
          {error.issueType.toLowerCase() === error.approvedIssueType.toLowerCase() ? null : (
            <span className="block text-xs text-fg-subtle">
              Approved spelling of &quot;{error.approvedIssueType}&quot;
            </span>
          )}
          <span
            className={cn(
              "block text-xs",
              error.severity ? "text-fg-subtle" : "font-medium text-warning-strong",
            )}
          >
            {CALL_SECTION_LABELS[error.section]} · {describeSeverity(error)}
            {error.severity && scored ? ` · −${formatPoints(error.penalty)}` : ""}
          </span>
        </li>
      ))}
      {call.repeatedIssueTypes.length > 0 ? (
        <li className="text-xs font-medium text-warning-strong">
          Same issue listed more than once on this call
        </li>
      ) : null}
    </ul>
  );
}

function SeveritySummary({ call }: { call: ScoredCall }) {
  const parts = CALL_SEVERITY_LEVELS.map((level) => [
    level,
    call.errors.filter((error) => error.severity?.level === level).length,
  ] as const)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${level} ×${count}`);
  const unmatched = call.errors.filter((error) => !error.severity).length;

  return (
    <span className="whitespace-nowrap text-xs text-fg-muted">
      {[...parts, ...(unmatched > 0 ? [`No criterion ×${unmatched}`] : [])].join(" · ")}
    </span>
  );
}

function ErrorCallRow({ call, scored }: { call: ScoredCall; scored: boolean }) {
  const scoreCell = (value: string) => (
    <TableCell className="whitespace-nowrap text-right align-top font-mono text-sm text-foreground">
      {scored ? value : <span className="text-xs text-warning-strong">Not scored</span>}
    </TableCell>
  );

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap align-top font-medium text-fg-secondary">
        {call.pharmacistName}
      </TableCell>
      <TableCell className="whitespace-nowrap align-top text-fg-tertiary">{formatDay(call.day)}</TableCell>
      <TableCell className="align-top font-mono text-fg-muted">{call.patientId}</TableCell>
      {scoreCell(formatPoints(call.formScore))}
      {scoreCell(formatPoints(call.insideCallScore))}
      {scoreCell(formatPoints(call.finalCallScore))}
      {scoreCell(formatCallPercent(call.callQualityPercent))}
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {formatInteger(call.errors.length)}
      </TableCell>
      <TableCell className="min-w-72 align-top text-sm">
        <ErrorList call={call} scored={scored} />
      </TableCell>
      <TableCell className="align-top">
        <SeveritySummary call={call} />
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {formatInteger(call.rawSeverityWeight)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right align-top font-mono text-sm text-foreground">
        {scored ? (
          <>
            {formatPoints(call.formPenalty + call.insideCallPenalty)}
            <span className="mt-1 block text-xs text-fg-subtle">
              Form {formatPoints(call.formPenalty)} · Inside {formatPoints(call.insideCallPenalty)}
            </span>
          </>
        ) : (
          <span className="text-xs text-warning-strong">Not scored</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function CleanCallsRow({ day }: { day: CallPharmacistDay }) {
  return (
    <TableRow className="bg-brand/[0.03]">
      <TableCell className="whitespace-nowrap font-medium text-fg-secondary">{day.pharmacistName}</TableCell>
      <TableCell className="whitespace-nowrap text-fg-tertiary">{formatDay(day.day)}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-brand-strong">
        Clean calls × {formatInteger(day.cleanCalls)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">10.00</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">10.00</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">20.00</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">100.00%</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">0</TableCell>
      <TableCell className="text-sm text-fg-subtle">No call-specific error</TableCell>
      <TableCell className="text-fg-faint">—</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">0</TableCell>
      <TableCell className="text-right font-mono text-sm text-foreground">0.00</TableCell>
    </TableRow>
  );
}

function CallDetailTable({ days }: { days: CallPharmacistDay[] }) {
  if (days.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-tint/10 px-6 text-center text-sm text-fg-subtle">
        No calls match this selection.
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border border-tint/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pharmacist</TableHead>
            <TableHead>Day</TableHead>
            <TableHead>ID</TableHead>
            <TableHead className="text-right">Form</TableHead>
            <TableHead className="text-right">Inside Call</TableHead>
            <TableHead className="text-right">Final</TableHead>
            <TableHead className="text-right">Quality</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead>Error types</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="text-right">Raw severity</TableHead>
            <TableHead className="text-right">Penalty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => {
            const mismatch = isDataMismatch(day);

            return (
              <Fragment key={`${day.pharmacistId}-${day.day}`}>
                {mismatch ? (
                  <TableRow className="bg-warning/[0.06]">
                    <TableCell className="text-sm text-warning-foreground" colSpan={12}>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning" />
                        Data mismatch, not scored: {day.pharmacistName}, {formatDay(day.day)}.{" "}
                        {describeMismatch(day)}.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : null}
                {day.errorCalls.map((call) => (
                  <ErrorCallRow call={call} key={call.key} scored={!mismatch} />
                ))}
                {!mismatch && day.cleanCalls > 0 ? <CleanCallsRow day={day} /> : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function UnresolvedCalls({ data }: { data: ClinicalCallsData }) {
  const mismatchDays = data.days.filter(isDataMismatch);
  const unrostered = data.checks.unrosteredCallErrors;
  const nearMisses = data.checks.nearMissIssueTypes;
  const hasUnresolved =
    mismatchDays.length > 0 || (unrostered?.length ?? 0) > 0 || nearMisses.length > 0;

  return (
    <Card
      className={cn(
        "animate-soft-in shadow-none",
        hasUnresolved ? "border-warning/30 bg-warning/[0.04]" : "border-tint/10 bg-surface",
      )}
      id="clinical-calls-unresolved"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {hasUnresolved ? (
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          )}
          <div>
            <h4 className="text-sm font-semibold text-fg-strong">Unresolved Calls</h4>
            <p className="mt-1 text-sm text-fg-muted">
              {hasUnresolved
                ? "Call errors that cannot be matched to a call count, a pharmacist, or an approved issue name. They are not in any KPI figure and never count as clean calls. A mismatched pharmacist-day is marked Data Mismatch and left out until the data is fixed."
                : "Every call error in these filters matches a call count."}
            </p>
          </div>
        </div>
        {mismatchDays.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-tint/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pharmacist</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Call count</TableHead>
                  <TableHead className="text-right">Error calls</TableHead>
                  <TableHead className="text-right">Error rows</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mismatchDays.map((day) => (
                  <TableRow key={`${day.pharmacistId}-${day.day}`}>
                    <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                      {day.pharmacistName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-tertiary">{formatDay(day.day)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {day.calls === null ? "None" : formatInteger(day.calls)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatInteger(day.errorCalls.length)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatInteger(day.errorCalls.reduce((total, call) => total + call.errors.length, 0))}
                    </TableCell>
                    <TableCell className="min-w-64 text-sm">
                      <MismatchChip days={1} />
                      <span className="mt-1 block text-xs text-fg-muted">{describeMismatch(day)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {unrostered && unrostered.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
            {unrostered.map((entry) => (
              <li key={entry.pharmacistName}>
                <span className="font-medium">{entry.pharmacistName}</span>: {plural(entry.rows, "call error row")} (
                {plural(entry.calls, "call")}), name not in the Clinical pharmacist list. Add it as a
                spelling in Settings &gt; Clinical Pharmacists.
              </li>
            ))}
          </ul>
        ) : null}
        {nearMisses.length > 0 ? (
          <div className="space-y-1 rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
            <p className="font-medium">
              Spelled differently from an approved call issue: not counted until the spelling is
              approved.
            </p>
            <ul className="space-y-1">
              {nearMisses.map((entry) => (
                <li key={entry.issueType}>
                  &quot;{entry.issueType}&quot; looks like the approved &quot;
                  {entry.approvedIssueType}&quot; ({CALL_SECTION_LABELS[entry.section]}):{" "}
                  {plural(entry.rows, "row")}, {plural(entry.calls, "call")}.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {unrostered === null ? (
          <p className="text-xs text-fg-subtle">
            Call errors under names outside the pharmacist list could not be checked.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CheckItem({
  children,
  ok,
  title,
}: {
  children?: ReactNode;
  ok: boolean;
  title: string;
}) {
  return (
    <li className="flex items-start gap-3">
      {ok ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      )}
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium text-fg-strong">{title}</p>
        {children ? <div className="text-xs leading-5 text-fg-muted">{children}</div> : null}
      </div>
    </li>
  );
}

function OtherDataChecks({ checks }: { checks: ClinicalCallsChecks }) {
  const unmatchedRows = checks.unmatchedSeverities.reduce((total, entry) => total + entry.rows, 0);
  const callsWithoutQaRows = checks.callDaysWithoutQaRows.reduce((total, entry) => total + entry.calls, 0);
  const issues =
    (unmatchedRows > 0 ? 1 : 0) +
    (checks.inconsistentScores.length > 0 ? 1 : 0) +
    (checks.repeatedIssueCalls > 0 ? 1 : 0) +
    (checks.callsAfterLatestQaDay.calls > 0 ? 1 : 0) +
    (callsWithoutQaRows > 0 ? 1 : 0);

  return (
    <details className="group rounded-lg border border-tint/10 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-fg-strong">
        <span className="flex items-center gap-2">
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 text-fg-subtle transition-transform group-open:rotate-90"
          />
          Other data checks
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs",
            issues > 0
              ? "border-warning/30 bg-warning/10 text-warning-strong"
              : "border-brand/25 bg-brand/10 text-brand-strong",
          )}
        >
          {issues > 0 ? `${issues} to review` : "All clear"}
        </span>
      </summary>
      <ul className="space-y-4 border-t border-tint/10 px-4 py-4">
        <CheckItem
          ok={unmatchedRows === 0}
          title={
            unmatchedRows === 0
              ? "Every call error has a severity (SCORE 20, 10 or 3)."
              : `${plural(unmatchedRows, "call error")} with no criterion: counted as errors, no penalty.`
          }
        >
          {checks.unmatchedSeverities.length > 0
            ? checks.unmatchedSeverities
                .map((entry) => `${entry.issueType} (SCORE ${entry.score}): ${plural(entry.rows, "row")}`)
                .join(" · ")
            : null}
        </CheckItem>
        <CheckItem
          ok={checks.inconsistentScores.length === 0}
          title={
            checks.inconsistentScores.length === 0
              ? "Each call issue has one SCORE in these filters."
              : `${plural(checks.inconsistentScores.length, "call issue")} stored with different SCOREs: each row keeps its own SCORE.`
          }
        >
          {checks.inconsistentScores.length > 0
            ? checks.inconsistentScores
                .map(
                  (entry) =>
                    `${entry.issueType}: ${entry.scores
                      .map((score) => `SCORE ${score.score} ×${formatInteger(score.rows)}`)
                      .join(", ")}`,
                )
                .join(" · ")
            : null}
        </CheckItem>
        <CheckItem
          ok={checks.repeatedIssueCalls === 0}
          title={
            checks.repeatedIssueCalls === 0
              ? "No issue is listed twice on the same call."
              : `${plural(checks.repeatedIssueCalls, "call")} list the same issue more than once. Each row counts; check for a duplicated upload.`
          }
        />
        <CheckItem
          ok={checks.callsAfterLatestQaDay.calls === 0}
          title={
            checks.callsAfterLatestQaDay.calls === 0
              ? `Clinical QA rows cover every call day${checks.latestQaDay ? ` (latest QA day ${formatDay(checks.latestQaDay)})` : ""}.`
              : `${plural(checks.callsAfterLatestQaDay.calls, "call")} on ${plural(checks.callsAfterLatestQaDay.days, "day")} after the latest Clinical QA day${checks.latestQaDay ? ` (${formatDay(checks.latestQaDay)})` : ""}.`
          }
        >
          {checks.callsAfterLatestQaDay.calls > 0
            ? "No error file covers these days yet, so their calls count as clean until it is uploaded."
            : null}
        </CheckItem>
        <CheckItem
          ok={callsWithoutQaRows === 0}
          title={
            callsWithoutQaRows === 0
              ? "Every call day has Clinical QA rows."
              : `${plural(checks.callDaysWithoutQaRows.length, "call day")} with no Clinical QA row of any type (${plural(callsWithoutQaRows, "call")}).`
          }
        >
          {checks.callDaysWithoutQaRows.length > 0 ? (
            <>
              Their calls count as clean. Confirm they were QA-reviewed:{" "}
              {checks.callDaysWithoutQaRows
                .map((entry) => `${formatDay(entry.day)} (${formatInteger(entry.calls)})`)
                .join(", ")}
              .
            </>
          ) : null}
        </CheckItem>
        <CheckItem
          ok
          title={`${plural(checks.otherIssueTypes.length, "other Clinical issue type")} in these filters are not call issues: left out of this KPI only.`}
        >
          {checks.otherIssueTypes.length > 0 ? (
            <>
              They keep feeding their own dashboards and KPIs. A misspelled call issue would
              appear here:{" "}
              {checks.otherIssueTypes
                .map((entry) => `${entry.issueType} (${formatInteger(entry.rows)})`)
                .join(" · ")}
              .
            </>
          ) : null}
        </CheckItem>
        <CheckItem ok title="Approved call issue types">
          {CALL_ERROR_ISSUES.map(
            ([issueType, section]) => `${CALL_SECTION_LABELS[section]}: ${issueType}`,
          ).join(" · ")}
          {ALIAS_RULES ? <span className="mt-1 block">Approved spelling: {ALIAS_RULES}.</span> : null}
          {FIXED_SCORE_RULES ? (
            <span className="mt-1 block">
              Fixed severity for this KPI: {FIXED_SCORE_RULES}, whatever SCORE is stored.
            </span>
          ) : null}
        </CheckItem>
      </ul>
    </details>
  );
}

function CallsDialog({
  data,
  onClose,
  periodLabel,
  selection,
}: {
  data: ClinicalCallsData;
  onClose: () => void;
  periodLabel: string;
  selection: Selection;
}) {
  const days = selection
    ? data.days.filter(
        (day) => selection.pharmacist === null || day.pharmacistName === selection.pharmacist,
      )
    : [];
  const figures = summarizeCallDays(days);
  const unresolved = summarizeUnresolvedDays(days);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(selection)}>
      {/* Wider than the default: the call table has 12 columns. */}
      <DialogContent className="max-w-7xl">
        {selection ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Calls: {selection.pharmacist ?? "Team total"}, {periodLabel}
              </DialogTitle>
              <DialogDescription>
                {plural(figures.totalCalls, "call")} evaluated · Call Quality{" "}
                {formatPercent(figures.callQuality)} · {plural(figures.errorCalls, "error call")} (
                {plural(figures.errorRows, "error")}) · {plural(figures.cleanCalls, "clean call")}
                {unresolved.mismatchDays > 0
                  ? ` · ${plural(unresolved.mismatchDays, "pharmacist-day")} with a data mismatch, not scored`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <CallDetailTable days={days} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ClinicalCallsSection({ result }: { result: ClinicalCallsResult }) {
  const [selection, setSelection] = useState<Selection>(null);

  if (result.error !== null) {
    return (
      <section className="space-y-4">
        <SectionHeader />
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            The Clinical Calls KPI could not be loaded. The rest of the page is not affected.{" "}
            {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const periodLabel = formatPeriod(data.period);
  const caption = `${periodLabel} · ${data.pharmacistName ?? "All active Clinical pharmacists"}`;

  if (data.days.length === 0 && !data.hasCallCountUploads) {
    return (
      <section className="space-y-4">
        <SectionHeader caption={caption} lastUploadAt={data.lastUploadAt} />
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <PhoneCall aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">No call counts uploaded yet.</p>
          <p className="mt-1 text-sm text-fg-subtle">
            Upload the Clinical Calls tracker on the Upload page. The call counts are the total
            evaluated calls of this KPI.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader caption={caption} lastUploadAt={data.lastUploadAt} />
      <MismatchBanner checks={data.checks} unresolved={data.unresolved} />
      <CallQualityCard figures={data.team} periodLabel={periodLabel} unresolved={data.unresolved} />
      <MetricCards figures={data.team} periodLabel={periodLabel} previous={data.previous} />
      {data.team.unmatchedErrors > 0 ? (
        <p className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
          {plural(data.team.unmatchedErrors, "call error")} have a SCORE other than 20, 10 or 3:
          counted as errors, with no penalty. See Other data checks.
        </p>
      ) : null}
      <PharmacistTable data={data} onSelect={setSelection} />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-fg-strong">Data Checks</h3>
        <UnresolvedCalls data={data} />
        <OtherDataChecks checks={data.checks} />
      </div>
      <CallsDialog
        data={data}
        onClose={() => setSelection(null)}
        periodLabel={periodLabel}
        selection={selection}
      />
    </section>
  );
}
