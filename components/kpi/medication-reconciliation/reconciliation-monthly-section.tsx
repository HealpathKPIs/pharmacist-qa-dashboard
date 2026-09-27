"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Minus,
  Pill,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { QaErrorRowsTable } from "@/components/dashboard/dashboard-interactive";
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
  formatMonthLabel,
  getMonthKey,
  type ReconciliationCell,
  type ReconciliationFigures,
} from "@/lib/reconciliation";
import type { ReconciliationMonthlyResult } from "@/lib/reconciliation-queries";
import { cn } from "@/lib/utils";

type SelectedCell = {
  month: string;
  pharmacist: string;
} | null;

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatAccuracy(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No tracker uploaded yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SectionHeader({ lastTrackerUploadAt }: { lastTrackerUploadAt: string | null }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-brand">
          Clinical QA
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-fg-strong">
          Medication Reconciliation — Monthly
        </h2>
        <p className="mt-1 text-xs text-fg-subtle">
          Last tracker upload: {formatDateTime(lastTrackerUploadAt)}
        </p>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Accuracy = (medications audited in the month − reconciliation errors in the month) ÷
        medications audited × 100, from monthly totals. Whole calendar months.
      </p>
    </div>
  );
}

function Comparison({
  current,
  differenceFormatter,
  formatter,
  higherIsBetter,
  previous,
  previousLabel,
}: {
  current: number | null;
  differenceFormatter: (value: number) => string;
  formatter: (value: number) => string;
  higherIsBetter: boolean;
  previous: number | null;
  previousLabel: string;
}) {
  if (current === null || previous === null) {
    return (
      <p className="text-xs text-fg-subtle">
        {previousLabel}: {previous === null ? "—" : formatter(previous)}
      </p>
    );
  }

  const difference = current - previous;
  const direction = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  const isBetter = higherIsBetter ? difference > 0 : difference < 0;

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-fg-subtle">
        {previousLabel}: <span className="font-mono text-fg-tertiary">{formatter(previous)}</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono",
          direction !== "flat" &&
            isBetter &&
            "border-brand/25 bg-brand/10 text-brand-strong",
          direction !== "flat" && !isBetter && "border-danger/25 bg-danger/10 text-danger-strong",
          direction === "flat" && "border-tint/10 bg-tint/[0.04] text-fg-muted",
        )}
      >
        {direction === "up" ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : null}
        {direction === "down" ? <ArrowDown aria-hidden="true" className="h-3 w-3" /> : null}
        {direction === "flat" ? <Minus aria-hidden="true" className="h-3 w-3" /> : null}
        {difference > 0 ? "+" : ""}
        {differenceFormatter(difference)}
      </span>
    </div>
  );
}

function MonthlyMetricCard({
  current,
  differenceFormatter,
  formatter,
  higherIsBetter = true,
  icon: Icon,
  label,
  monthLabel,
  previous,
  previousLabel,
}: {
  current: number | null;
  differenceFormatter?: (value: number) => string;
  formatter: (value: number) => string;
  higherIsBetter?: boolean;
  icon: typeof Pill;
  label: string;
  monthLabel: string;
  previous: number | null;
  previousLabel: string;
}) {
  return (
    <Card className="animate-soft-in h-full min-h-[168px] border-tint/10 bg-transparent bg-gradient-to-br from-surface-from to-surface-to shadow-(--shadow-card-lg)">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
              {label}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">{monthLabel}</p>
            <p className="mt-3 truncate font-mono text-3xl font-semibold leading-none text-fg-strong">
              {current === null ? "—" : formatter(current)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        </div>
        <div className="border-t border-tint/10 pt-3">
          <Comparison
            current={current}
            differenceFormatter={differenceFormatter ?? formatter}
            formatter={formatter}
            higherIsBetter={higherIsBetter}
            previous={previous}
            previousLabel={previousLabel}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FiguresText({ figures }: { figures: ReconciliationFigures }) {
  return (
    <span className="mt-1 block font-mono text-xs text-fg-subtle">
      {formatInteger(figures.audited)} / {formatInteger(figures.errors)}
    </span>
  );
}

function MonthCell({
  cell,
  onSelect,
}: {
  cell: ReconciliationCell | undefined;
  onSelect: () => void;
}) {
  if (!cell || (!cell.hasTrackerData && cell.errors === 0)) {
    return <span className="text-fg-faint">—</span>;
  }

  const content = cell.hasTrackerData ? (
    <>
      <span
        className={cn(
          "block font-mono text-sm font-semibold",
          cell.errorsExceedAudited ? "text-warning-strong" : "text-foreground",
        )}
      >
        {formatAccuracy(cell.accuracy)}
      </span>
      <FiguresText figures={cell} />
      {cell.errorsExceedAudited ? (
        <span className="mt-1 block text-xs text-warning-strong">Errors exceed audited</span>
      ) : null}
    </>
  ) : (
    <>
      <span className="block text-xs font-medium text-fg-muted">No tracker data</span>
      <span className="mt-1 block font-mono text-xs text-fg-subtle">
        {formatInteger(cell.errors)} errors
      </span>
    </>
  );

  if (cell.errors === 0) {
    return <div>{content}</div>;
  }

  return (
    <button
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:border-brand/30 hover:bg-tint/[0.04]",
        cell.errorsExceedAudited ? "border-warning/30" : "border-transparent",
      )}
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  );
}

export function ReconciliationMonthlySection({
  result,
}: {
  result: ReconciliationMonthlyResult;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  if (result.error !== null) {
    return (
      <section className="space-y-4">
        <SectionHeader lastTrackerUploadAt={null} />
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            The monthly reconciliation section could not be loaded. The rest of the dashboard
            is not affected. {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const latestMonth = data.months[data.months.length - 1] ?? null;

  if (!latestMonth) {
    return (
      <section className="space-y-4">
        <SectionHeader lastTrackerUploadAt={data.lastTrackerUploadAt} />
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <Pill aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">
            No reconciliation workload uploaded for these months.
          </p>
          <p className="mt-1 text-sm text-fg-subtle">
            Upload the medication reconciliation tracker on the Upload page.
          </p>
        </div>
      </section>
    );
  }

  const monthLabel = `${formatMonthLabel(latestMonth.month)}${
    latestMonth.month === data.currentMonth ? " · month to date" : ""
  }`;
  const previousLabel = data.previousMonth
    ? `vs ${formatMonthLabel(data.previousMonth.month, "short")}`
    : "vs previous month";
  const previousTeam = data.previousMonth?.team ?? null;
  const selectedRows = selectedCell
    ? data.errorRows.filter(
        (row) =>
          row.pharmacistName === selectedCell.pharmacist &&
          getMonthKey(row.day) === selectedCell.month,
      )
    : [];

  return (
    <section className="space-y-5">
      <SectionHeader lastTrackerUploadAt={data.lastTrackerUploadAt} />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MonthlyMetricCard
          current={latestMonth.team.audited}
          formatter={formatInteger}
          icon={Pill}
          label="Medications Audited"
          monthLabel={monthLabel}
          previous={previousTeam?.audited ?? null}
          previousLabel={previousLabel}
        />
        <MonthlyMetricCard
          current={latestMonth.team.errors}
          formatter={formatInteger}
          higherIsBetter={false}
          icon={ClipboardList}
          label="Reconciliation Errors"
          monthLabel={monthLabel}
          previous={previousTeam?.errors ?? null}
          previousLabel={previousLabel}
        />
        <MonthlyMetricCard
          current={latestMonth.team.errorFree}
          formatter={formatInteger}
          icon={CheckCircle2}
          label="Error-free"
          monthLabel={monthLabel}
          previous={previousTeam?.errorFree ?? null}
          previousLabel={previousLabel}
        />
        <MonthlyMetricCard
          current={latestMonth.team.accuracy}
          differenceFormatter={(value) => `${value.toFixed(2)} pp`}
          formatter={(value) => `${value.toFixed(2)}%`}
          icon={ShieldCheck}
          label="Reconciliation Accuracy"
          monthLabel={monthLabel}
          previous={previousTeam?.accuracy ?? null}
          previousLabel={previousLabel}
        />
      </div>
      {latestMonth.excludedErrors > 0 ? (
        <p className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
          {formatInteger(latestMonth.excludedErrors)} reconciliation error(s) in{" "}
          {formatMonthLabel(latestMonth.month)} belong to pharmacists with no tracker numbers
          that month and are not included in the team total.
        </p>
      ) : null}
      <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-44">Pharmacist</TableHead>
                  {data.months.map((month) => (
                    <TableHead className="min-w-36" key={month.month}>
                      {formatMonthLabel(month.month, "short")}
                    </TableHead>
                  ))}
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
                        <MonthCell
                          cell={month.cells[pharmacist]}
                          onSelect={() =>
                            setSelectedCell({ month: month.month, pharmacist })
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="bg-tint/[0.03]">
                  <TableCell className="whitespace-nowrap font-semibold text-fg-strong">
                    Team total
                  </TableCell>
                  {data.months.map((month) => (
                    <TableCell className="align-top" key={month.month}>
                      <span className="block font-mono text-sm font-semibold text-fg-strong">
                        {formatAccuracy(month.team.accuracy)}
                      </span>
                      <FiguresText figures={month.team} />
                      {month.excludedErrors > 0 ? (
                        <span className="mt-1 block text-xs text-warning-strong">
                          {formatInteger(month.excludedErrors)} excluded
                        </span>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
            Each cell shows accuracy, then medications audited / reconciliation errors. Click a
            cell with errors to see the error rows.
          </p>
        </CardContent>
      </Card>
      <Dialog
        onOpenChange={(open) => !open && setSelectedCell(null)}
        open={Boolean(selectedCell)}
      >
        <DialogContent>
          {selectedCell ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Reconciliation errors: {selectedCell.pharmacist},{" "}
                  {formatMonthLabel(selectedCell.month)}
                </DialogTitle>
                <DialogDescription>
                  Clinical QA error rows counted as reconciliation errors in this month.
                </DialogDescription>
              </DialogHeader>
              <QaErrorRowsTable rows={selectedRows} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
