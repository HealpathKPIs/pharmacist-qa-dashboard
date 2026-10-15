"use client";

import { AlertCircle, ClipboardList, LineChart, Users, UserX } from "lucide-react";
import { useMemo, useState } from "react";

import { QaErrorRowsTable } from "@/components/dashboard/dashboard-interactive";
import { formatCoverage, formatInteger, formatPeriod } from "@/components/kpi/kpi-format";
import {
  getSortCell,
  SortableHead,
  sortNames,
  useKpiSort,
} from "@/components/kpi/kpi-sort";
import { KpiTrendDialog, type KpiTrendPoint } from "@/components/kpi/kpi-trend-dialog";
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditModule } from "@/lib/audit-types";
import { summarizeErrorCount, type ErrorCountTeamAverages } from "@/lib/error-count";
import type {
  QualityDeductionData,
  QualityDeductionResult,
} from "@/lib/quality-deduction-queries";
import { formatMonthLabel, getMonthKey, type MonthKey } from "@/lib/reconciliation";
import { cn } from "@/lib/utils";

// One table cell: an agent (null = team total) in a month (null = the whole
// selected period).
type SelectedCell = {
  month: MonthKey | null;
  pharmacist: string | null;
} | null;

function formatAverage(value: number) {
  return value.toFixed(1);
}

// Counts are whole numbers; averages per affected agent have one decimal.
function formatCount(value: number) {
  return Number.isInteger(value) ? formatInteger(value) : formatAverage(value);
}

function describeCell(cell: NonNullable<SelectedCell>) {
  return `${cell.pharmacist ?? "Team total"}, ${
    cell.month ? formatMonthLabel(cell.month) : "selected period"
  }`;
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
          QA Error Count
        </h2>
        {caption ? <p className="mt-1 text-xs text-fg-subtle">{caption}</p> : null}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Number of QA errors in the exact dates selected. Every QA error record counts once,
        whatever its severity, including errors without a scoring criterion. Lower is better.
        {previousLabel
          ? ` Compared with ${previousLabel}, the previous period of the same length.`
          : null}
      </p>
    </div>
  );
}

function CountCell({
  count,
  label,
  onSelect,
  strong = false,
}: {
  count: number;
  label: string;
  onSelect: () => void;
  strong?: boolean;
}) {
  if (count === 0) {
    return <span className="text-fg-faint">—</span>;
  }

  return (
    <button
      aria-label={`${label}: ${formatInteger(count)} QA ${count === 1 ? "error" : "errors"}. Show the QA error records.`}
      className={cn(
        "w-full rounded-md border border-transparent px-2 py-1.5 text-left font-mono text-sm font-semibold transition-colors hover:border-brand/30 hover:bg-tint/[0.04]",
        strong ? "text-fg-strong" : "text-foreground",
      )}
      onClick={onSelect}
      type="button"
    >
      {formatInteger(count)}
    </button>
  );
}

function MonthlyTable({
  actorLabel,
  data,
  onSelect,
  onShowTrend,
}: {
  actorLabel: string;
  data: QualityDeductionData;
  onSelect: (cell: NonNullable<SelectedCell>) => void;
  onShowTrend: (pharmacist: string) => void;
}) {
  const actorLower = actorLabel.toLowerCase();
  const { handleSort, sort } = useKpiSort();
  // Agents with no QA errors in the sorted column always go last.
  const pharmacists = useMemo(
    () =>
      sortNames(data.pharmacists, sort, (key, name) => {
        const errors = getSortCell(data, key, name)?.errors ?? 0;

        return errors > 0 ? errors : null;
      }),
    [data, sort],
  );

  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  className="min-w-44"
                  label={`${actorLabel} name`}
                  onSort={handleSort}
                  sort={sort}
                  sortKey="name"
                >
                  {actorLabel}
                </SortableHead>
                {data.months.map((month) => (
                  <SortableHead
                    className="min-w-28"
                    key={month.month}
                    label={`${formatMonthLabel(month.month)} QA errors`}
                    onSort={handleSort}
                    sort={sort}
                    sortKey={month.month}
                  >
                    {formatMonthLabel(month.month, "short")}
                    {month.coverage ? (
                      <span className="mt-0.5 block font-normal normal-case">
                        {formatCoverage(month.coverage)}
                      </span>
                    ) : null}
                  </SortableHead>
                ))}
                <SortableHead
                  className="min-w-32 border-l border-tint/10"
                  label="selected period QA errors"
                  onSort={handleSort}
                  sort={sort}
                  sortKey="total"
                >
                  Selected period
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pharmacists.map((pharmacist) => (
                <TableRow key={pharmacist}>
                  <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                    <button
                      aria-label={`Show the monthly QA error trend for ${pharmacist}`}
                      className="group -mx-1 inline-flex items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:text-brand-strong"
                      onClick={() => onShowTrend(pharmacist)}
                      type="button"
                    >
                      {pharmacist}
                      <LineChart
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-fg-faint transition-colors group-hover:text-brand"
                      />
                    </button>
                  </TableCell>
                  {data.months.map((month) => (
                    <TableCell className="align-top" key={month.month}>
                      <CountCell
                        count={month.cells[pharmacist]?.errors ?? 0}
                        label={describeCell({ month: month.month, pharmacist })}
                        onSelect={() => onSelect({ month: month.month, pharmacist })}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="border-l border-tint/10 align-top">
                    <CountCell
                      count={data.total.cells[pharmacist]?.errors ?? 0}
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
                    <CountCell
                      count={month.team.errors}
                      label={describeCell({ month: month.month, pharmacist: null })}
                      onSelect={() => onSelect({ month: month.month, pharmacist: null })}
                      strong
                    />
                  </TableCell>
                ))}
                <TableCell className="border-l border-tint/10 align-top">
                  <CountCell
                    count={data.total.team.errors}
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
          Each cell is the number of QA error records. Click a column header to sort by it
          (most errors first, click again for fewest; {actorLower}s with no QA errors stay
          last). Click a name to see that {actorLower}&apos;s monthly trend against the average
          per affected {actorLower}. Click a cell to see its QA error records.
        </p>
      </CardContent>
    </Card>
  );
}

function TrendDialog({
  actorLabel,
  data,
  onClose,
  pharmacist,
  teamAverages,
}: {
  actorLabel: string;
  data: QualityDeductionData;
  onClose: () => void;
  pharmacist: string | null;
  // Team-wide, even when the page is filtered to one agent; null if it could
  // not be loaded (the line is then left out).
  teamAverages: ErrorCountTeamAverages | null;
}) {
  const actorLower = actorLabel.toLowerCase();
  // A month without QA errors is a gap in the agent's line, as in the table.
  const points: KpiTrendPoint[] = pharmacist
    ? data.months.map((month) => {
        const errors = month.cells[pharmacist]?.errors ?? 0;

        return {
          agent: errors > 0 ? errors : null,
          month: month.month,
          team: teamAverages?.months[month.month] ?? null,
        };
      })
    : [];
  const periodErrors = pharmacist ? data.total.cells[pharmacist]?.errors ?? 0 : 0;

  return (
    <KpiTrendDialog
      actorLabel={actorLabel}
      chartLabel={`Line chart of ${pharmacist}'s monthly QA errors against the average per affected ${actorLower}. The same figures are in the table below.`}
      comparisonNoun="average"
      description={`Monthly QA errors against the average per affected ${actorLower} (total errors ÷ ${actorLower}s with at least one error that month). Lower is better.`}
      emptyMonthsLabel="No months with QA errors"
      footnote={`QA errors per month. A gap in the line is a month with no QA errors for this ${actorLower}.`}
      formatAxis={(value) => formatInteger(value)}
      formatDifference={formatCount}
      formatValue={formatCount}
      onClose={onClose}
      period={{
        agent: periodErrors > 0 ? periodErrors : null,
        team: teamAverages?.period ?? null,
      }}
      pharmacist={pharmacist}
      points={points}
      teamLabel={`Average per affected ${actorLower}`}
      title="QA error trend"
    />
  );
}

export function ErrorCountSection({
  result,
  teamAverages,
}: {
  result: QualityDeductionResult;
  teamAverages: ErrorCountTeamAverages | null;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [trendPharmacist, setTrendPharmacist] = useState<string | null>(null);
  const moduleConfig = getAuditModule("non_medical");
  const actorLower = moduleConfig.actorLabel.toLowerCase();

  if (result.error !== null) {
    return (
      <section className="space-y-4">
        <SectionHeader moduleLabel={moduleConfig.moduleLabel} />
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            The QA Error Count could not be loaded. The rest of the page is not affected.{" "}
            {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const current = summarizeErrorCount(data.errorRows);
  const previous = data.previousErrorCount;
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

  return (
    <section className="space-y-5">
      <SectionHeader
        caption={`${periodLabel} · ${data.pharmacistName ?? "All active Non-Medical agents"}`}
        moduleLabel={moduleConfig.moduleLabel}
        previousLabel={previousLabel}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MonthlyMetricCard
          current={current.totalErrors}
          formatter={formatInteger}
          higherIsBetter={false}
          icon={ClipboardList}
          label="Total QA Errors"
          monthLabel={periodLabel}
          previous={previous?.totalErrors ?? null}
          previousLabel="vs previous period"
        />
        <MonthlyMetricCard
          current={current.agentsWithErrors}
          formatter={formatInteger}
          higherIsBetter={false}
          icon={UserX}
          label={`${moduleConfig.actorLabelPlural} with Errors`}
          monthLabel={periodLabel}
          previous={previous?.agentsWithErrors ?? null}
          previousLabel="vs previous period"
        />
        {/* Full width while only two cards fit on a row. */}
        <div className="sm:col-span-2 xl:col-span-1">
          <MonthlyMetricCard
            current={current.averagePerAffectedAgent}
            differenceFormatter={formatAverage}
            formatter={formatAverage}
            higherIsBetter={false}
            icon={Users}
            label={`Average Errors per Affected ${moduleConfig.actorLabel}`}
            monthLabel={periodLabel}
            previous={previous?.averagePerAffectedAgent ?? null}
            previousLabel="vs previous period"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-fg-subtle">
        Average Errors per Affected {moduleConfig.actorLabel} = total QA errors ÷{" "}
        {actorLower}s with at least one QA error. {moduleConfig.actorLabelPlural} with no
        errors are left out, so it is not a team-wide average.
      </p>
      {data.months.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <ClipboardList aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">
            No {moduleConfig.moduleLabel} errors match these filters.
          </p>
          <p className="mt-1 text-sm text-fg-subtle">
            Change the dates or the {actorLower} to see the monthly breakdown.
          </p>
        </div>
      ) : (
        <>
          <MonthlyTable
            actorLabel={moduleConfig.actorLabel}
            data={data}
            onSelect={setSelectedCell}
            onShowTrend={setTrendPharmacist}
          />
          <TrendDialog
            actorLabel={moduleConfig.actorLabel}
            data={data}
            onClose={() => setTrendPharmacist(null)}
            pharmacist={trendPharmacist}
            teamAverages={teamAverages}
          />
        </>
      )}
      <Dialog
        onOpenChange={(open) => !open && setSelectedCell(null)}
        open={Boolean(selectedCell)}
      >
        <DialogContent>
          {selectedCell ? (
            <>
              <DialogHeader>
                <DialogTitle>QA errors: {describeCell(selectedCell)}</DialogTitle>
                <DialogDescription>
                  {formatInteger(selectedRows.length)} QA error{" "}
                  {selectedRows.length === 1 ? "record" : "records"}. Each record counts once,
                  whatever its severity.
                </DialogDescription>
              </DialogHeader>
              <QaErrorRowsTable
                actorLabel={moduleConfig.actorLabel}
                idLabel="Case ID"
                rows={selectedRows}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
