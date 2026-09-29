"use client";

import { AlertCircle, ClipboardList, Gauge, Info, Sigma } from "lucide-react";
import { useState } from "react";

import { QaErrorRowsTable } from "@/components/dashboard/dashboard-interactive";
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
import { getAuditModule } from "@/lib/audit-types";
import { toQualityDeductionRows } from "@/lib/qa-error-severity";
import {
  summarizeQualityDeduction,
  type QualityDeductionFigures,
} from "@/lib/quality-deduction";
import type {
  QualityDeductionData,
  QualityDeductionResult,
} from "@/lib/quality-deduction-queries";
import { formatMonthLabel, getMonthKey, type MonthKey } from "@/lib/reconciliation";
import { cn } from "@/lib/utils";

export type QualityDeductionModule = "clinical" | "non_medical";

// Wording that differs per module; labels come from lib/audit-types.ts.
const MODULE_SCOPE: Record<
  QualityDeductionModule,
  { allActors: string; idLabel: string; scopeNote: string }
> = {
  clinical: {
    allActors: "All active Clinical pharmacists",
    idLabel: "Patient ID",
    scopeNote: "Only active Clinical pharmacists are included.",
  },
  non_medical: {
    allActors: "All Non-Medical agents",
    idLabel: "Case ID",
    scopeNote:
      "Severity points come from the Non-Medical scoring criteria (Category + Issue type).",
  },
};

// One table cell: a pharmacist (null = team total) in a month (null = the
// whole selected period).
type SelectedCell = {
  month: MonthKey | null;
  pharmacist: string | null;
} | null;

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

function toDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPoints(value: number) {
  return `${value.toFixed(2)} pts`;
}

function formatScore(figures: QualityDeductionFigures) {
  return figures.score === null ? "—" : formatPoints(figures.score);
}

function formatPeriod(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) {
    const startFormatter =
      startDate.slice(0, 4) === endDate.slice(0, 4) ? dayFormatter : dateFormatter;

    return `${startFormatter.format(toDate(startDate))} – ${dateFormatter.format(toDate(endDate))}`;
  }

  if (startDate) {
    return `From ${dateFormatter.format(toDate(startDate))}`;
  }

  if (endDate) {
    return `Up to ${dateFormatter.format(toDate(endDate))}`;
  }

  return "All dates";
}

// Days of a month cut by the date filter, e.g. "Aug 15 – 31".
function formatCoverage({ from, to }: { from: string; to: string }) {
  const firstDay = dayFormatter.format(toDate(from));

  return from === to ? firstDay : `${firstDay} – ${Number(to.slice(8, 10))}`;
}

function describeCell(cell: NonNullable<SelectedCell>) {
  return `${cell.pharmacist ?? "Team total"}, ${
    cell.month ? formatMonthLabel(cell.month) : "selected period"
  }`;
}

function formatUnscoredNote(count: number) {
  return `${formatInteger(count)} QA ${count === 1 ? "error has" : "errors have"} no scoring criterion: counted as QA errors, with no points.`;
}

function SectionHeader({
  caption,
  moduleLabel,
  previousLabel,
}: {
  caption?: string;
  moduleLabel: string;
  previousLabel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-brand">
          {moduleLabel}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-fg-strong">
          Quality Deduction Score
        </h2>
        {caption ? <p className="mt-1 text-xs text-fg-subtle">{caption}</p> : null}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Quality Deduction Score = total severity score ÷ number of QA errors, from the totals
        of the exact dates selected.
        {previousLabel
          ? ` Compared with ${previousLabel}, the previous period of the same length.`
          : null}
      </p>
    </div>
  );
}

function CalculationTile({
  highlight = false,
  label,
  unit,
  value,
}: {
  highlight?: boolean;
  label: string;
  unit?: string;
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
        {unit ? (
          <span className="ml-0.5 font-sans text-sm font-medium text-fg-muted"> {unit}</span>
        ) : null}
      </p>
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

function HowItIsCalculated({
  actorsLower,
  figures,
  scopeNote,
  unscoredErrors,
}: {
  actorsLower: string;
  figures: QualityDeductionFigures;
  scopeNote: string;
  unscoredErrors: number;
}) {
  return (
    <div className="rounded-lg border border-tint/10 bg-inset p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-fg-strong">
        <Info aria-hidden="true" className="h-4 w-4 text-brand" />
        How it is calculated
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-foreground">
            Quality Deduction Score = Total Severity Score ÷ Total QA Errors
          </p>
          <p className="text-fg-muted">= the average severity points assigned per QA error.</p>
          {figures.score === null ? (
            <p className="pt-1 text-fg-strong">
              There are no QA errors for these filters, so there is no score (—).
            </p>
          ) : (
            <p className="pt-1 font-mono text-fg-strong">
              {formatInteger(figures.severity)} ÷ {formatInteger(figures.errors)} ={" "}
              {figures.score.toFixed(2)} pts/error
            </p>
          )}
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-fg-muted">
          <li>Total Severity Score adds up the score of every QA error record.</li>
          <li>Each QA error record counts once; individual scores are not averaged.</li>
          <li>Team totals add all {actorsLower}&apos; points and errors, then divide once.</li>
          <li>{scopeNote}</li>
          {unscoredErrors > 0 ? <li>{formatUnscoredNote(unscoredErrors)}</li> : null}
        </ul>
      </div>
    </div>
  );
}

function CalculationCard({
  actorsLower,
  figures,
  periodLabel,
  scopeNote,
  unscoredErrors,
}: {
  actorsLower: string;
  figures: QualityDeductionFigures;
  periodLabel: string;
  scopeNote: string;
  unscoredErrors: number;
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
                Quality Deduction Score
              </p>
              <p className="mt-3 font-mono text-4xl font-semibold leading-none text-fg-strong">
                {formatScore(figures)}
              </p>
              <p className="mt-3 text-sm text-fg-muted">Average severity points per QA error</p>
              <p className="mt-1 text-xs text-fg-subtle">{periodLabel}</p>
            </div>
          </div>
          <div
            aria-label="Calculation"
            className="flex flex-col gap-2 sm:flex-row sm:items-stretch xl:max-w-3xl xl:flex-1"
            role="group"
          >
            <CalculationTile label="Total Severity Score" value={formatInteger(figures.severity)} />
            <Operator label="divided by" symbol="÷" />
            <CalculationTile label="Total QA Errors" value={formatInteger(figures.errors)} />
            <Operator label="equals" symbol="=" />
            <CalculationTile
              highlight
              label="Quality Deduction Score"
              unit={figures.score === null ? undefined : "pts / error"}
              value={figures.score === null ? "—" : figures.score.toFixed(2)}
            />
          </div>
        </div>
        <HowItIsCalculated
          actorsLower={actorsLower}
          figures={figures}
          scopeNote={scopeNote}
          unscoredErrors={unscoredErrors}
        />
      </CardContent>
    </Card>
  );
}

function FiguresCell({
  figures,
  label,
  onSelect,
  strong = false,
}: {
  figures: QualityDeductionFigures;
  label: string;
  onSelect: () => void;
  strong?: boolean;
}) {
  if (figures.errors === 0) {
    return <span className="text-fg-faint">—</span>;
  }

  return (
    <button
      aria-label={`${label}: ${formatScore(figures)}, ${formatInteger(figures.severity)} severity points from ${formatInteger(figures.errors)} QA errors. Show the QA error rows.`}
      className="w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-brand/30 hover:bg-tint/[0.04]"
      onClick={onSelect}
      type="button"
    >
      <span
        className={cn(
          "block font-mono text-sm font-semibold",
          strong ? "text-fg-strong" : "text-foreground",
        )}
      >
        {formatScore(figures)}
      </span>
      <span className="mt-1 block font-mono text-xs text-fg-subtle">
        {formatInteger(figures.severity)} / {formatInteger(figures.errors)}
      </span>
    </button>
  );
}

function MonthlyTable({
  actorLabel,
  data,
  onSelect,
}: {
  actorLabel: string;
  data: QualityDeductionData;
  onSelect: (cell: NonNullable<SelectedCell>) => void;
}) {
  const actorLower = actorLabel.toLowerCase();

  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">{actorLabel}</TableHead>
                {data.months.map((month) => (
                  <TableHead className="min-w-36" key={month.month}>
                    {formatMonthLabel(month.month, "short")}
                    {month.coverage ? (
                      <span className="mt-0.5 block font-normal normal-case">
                        {formatCoverage(month.coverage)}
                      </span>
                    ) : null}
                  </TableHead>
                ))}
                <TableHead className="min-w-36 border-l border-tint/10">Selected period</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pharmacists.map((pharmacist) => (
                <TableRow key={pharmacist}>
                  <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                    {pharmacist}
                  </TableCell>
                  {data.months.map((month) => (
                    <TableCell className="align-top" key={month.month}>
                      <FiguresCell
                        figures={month.cells[pharmacist]}
                        label={describeCell({ month: month.month, pharmacist })}
                        onSelect={() => onSelect({ month: month.month, pharmacist })}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="border-l border-tint/10 align-top">
                    <FiguresCell
                      figures={data.total.cells[pharmacist]}
                      label={describeCell({ month: null, pharmacist })}
                      onSelect={() => onSelect({ month: null, pharmacist })}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-tint/[0.03]">
                <TableCell className="whitespace-nowrap font-semibold text-fg-strong">
                  Team total
                </TableCell>
                {data.months.map((month) => (
                  <TableCell className="align-top" key={month.month}>
                    <FiguresCell
                      figures={month.team}
                      label={describeCell({ month: month.month, pharmacist: null })}
                      onSelect={() => onSelect({ month: month.month, pharmacist: null })}
                      strong
                    />
                  </TableCell>
                ))}
                <TableCell className="border-l border-tint/10 align-top">
                  <FiguresCell
                    figures={data.total.team}
                    label={describeCell({ month: null, pharmacist: null })}
                    onSelect={() => onSelect({ month: null, pharmacist: null })}
                    strong
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
          Each cell shows the Quality Deduction Score, then total severity score / QA errors.
          The team total adds every {actorLower}&apos;s severity points and QA errors, then
          divides once; it is not an average of {actorLower} scores. Click a cell to see its QA
          error rows.
        </p>
      </CardContent>
    </Card>
  );
}

export function QualityDeductionScore({
  auditType,
  result,
}: {
  auditType: QualityDeductionModule;
  result: QualityDeductionResult;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const moduleConfig = getAuditModule(auditType);
  const scope = MODULE_SCOPE[auditType];
  const actorLower = moduleConfig.actorLabel.toLowerCase();

  if (result.error !== null) {
    return (
      <section className="space-y-4">
        <SectionHeader moduleLabel={moduleConfig.moduleLabel} />
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            The Quality Deduction Score could not be loaded. The rest of the page is not
            affected. {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const periodLabel = formatPeriod(data.startDate, data.endDate);
  const previousLabel = data.previousPeriod
    ? formatPeriod(data.previousPeriod.startDate, data.previousPeriod.endDate)
    : null;
  const selectedRows = selectedCell
    ? data.errorRows.filter(
        (row) =>
          (selectedCell.pharmacist === null || row.pharmacistName === selectedCell.pharmacist) &&
          (selectedCell.month === null || getMonthKey(row.day) === selectedCell.month),
      )
    : [];
  const selectedFigures = summarizeQualityDeduction(toQualityDeductionRows(selectedRows));

  return (
    <section className="space-y-5">
      <SectionHeader
        caption={`${periodLabel} · ${data.pharmacistName ?? scope.allActors}`}
        moduleLabel={moduleConfig.moduleLabel}
        previousLabel={previousLabel}
      />
      <CalculationCard
        actorsLower={moduleConfig.actorLabelPlural.toLowerCase()}
        figures={data.current}
        periodLabel={periodLabel}
        scopeNote={scope.scopeNote}
        unscoredErrors={data.unscoredErrors}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MonthlyMetricCard
          current={data.current.severity}
          formatter={formatInteger}
          higherIsBetter={false}
          icon={Sigma}
          label="Total Severity Score"
          monthLabel={periodLabel}
          previous={data.previous?.severity ?? null}
          previousLabel="vs previous period"
        />
        <MonthlyMetricCard
          current={data.current.errors}
          formatter={formatInteger}
          higherIsBetter={false}
          icon={ClipboardList}
          label="Total QA Errors"
          monthLabel={periodLabel}
          previous={data.previous?.errors ?? null}
          previousLabel="vs previous period"
        />
        {/* Full width while only two cards fit on a row. */}
        <div className="sm:col-span-2 xl:col-span-1">
          <MonthlyMetricCard
            current={data.current.score}
            differenceFormatter={formatPoints}
            formatter={formatPoints}
            higherIsBetter={false}
            icon={Gauge}
            label="Quality Deduction Score"
            monthLabel={periodLabel}
            previous={data.previous?.score ?? null}
            previousLabel="vs previous period"
          />
        </div>
      </div>
      {data.months.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <Gauge aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">
            No {moduleConfig.moduleLabel} errors match these filters.
          </p>
          <p className="mt-1 text-sm text-fg-subtle">
            Change the dates or the {actorLower} to see the monthly breakdown.
          </p>
        </div>
      ) : (
        <MonthlyTable
          actorLabel={moduleConfig.actorLabel}
          data={data}
          onSelect={setSelectedCell}
        />
      )}
      <Dialog
        onOpenChange={(open) => !open && setSelectedCell(null)}
        open={Boolean(selectedCell)}
      >
        <DialogContent>
          {selectedCell ? (
            <>
              <DialogHeader>
                <DialogTitle>Quality Deduction: {describeCell(selectedCell)}</DialogTitle>
                <DialogDescription>
                  {formatInteger(selectedFigures.severity)} severity points ÷{" "}
                  {formatInteger(selectedFigures.errors)} QA errors ={" "}
                  {formatScore(selectedFigures)} per error.
                </DialogDescription>
              </DialogHeader>
              <QaErrorRowsTable
                actorLabel={moduleConfig.actorLabel}
                idLabel={scope.idLabel}
                rows={selectedRows}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
