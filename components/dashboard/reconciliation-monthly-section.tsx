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
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-300">
          Clinical QA
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">
          Medication Reconciliation — Monthly
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Last tracker upload: {formatDateTime(lastTrackerUploadAt)}
        </p>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-zinc-400">
        Accuracy = (medications audited in the month − reconciliation errors in the month) ÷
        medications audited × 100, from monthly totals. Whole calendar months; the Issue filter
        does not apply.
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
      <p className="text-xs text-zinc-500">
        {previousLabel}: {previous === null ? "—" : formatter(previous)}
      </p>
    );
  }

  const difference = current - previous;
  const direction = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  const isBetter = higherIsBetter ? difference > 0 : difference < 0;

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-zinc-500">
        {previousLabel}: <span className="font-mono text-zinc-300">{formatter(previous)}</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono",
          direction !== "flat" &&
            isBetter &&
            "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
          direction !== "flat" && !isBetter && "border-red-300/25 bg-red-300/10 text-red-200",
          direction === "flat" && "border-white/10 bg-white/[0.04] text-zinc-400",
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
    <Card className="animate-soft-in h-full min-h-[168px] border-white/10 bg-gradient-to-br from-white/[0.075] to-white/[0.035] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">
              {label}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{monthLabel}</p>
            <p className="mt-3 truncate font-mono text-3xl font-semibold leading-none text-white">
              {current === null ? "—" : formatter(current)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        </div>
        <div className="border-t border-white/10 pt-3">
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
    <span className="mt-1 block font-mono text-xs text-zinc-500">
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
    return <span className="text-zinc-600">—</span>;
  }

  const content = cell.hasTrackerData ? (
    <>
      <span
        className={cn(
          "block font-mono text-sm font-semibold",
          cell.errorsExceedAudited ? "text-amber-200" : "text-zinc-100",
        )}
      >
        {formatAccuracy(cell.accuracy)}
      </span>
      <FiguresText figures={cell} />
      {cell.errorsExceedAudited ? (
        <span className="mt-1 block text-xs text-amber-200">Errors exceed audited</span>
      ) : null}
    </>
  ) : (
    <>
      <span className="block text-xs font-medium text-zinc-400">No tracker data</span>
      <span className="mt-1 block font-mono text-xs text-zinc-500">
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
        "w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:border-emerald-300/30 hover:bg-white/[0.04]",
        cell.errorsExceedAudited ? "border-amber-300/30" : "border-transparent",
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
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 px-6 text-center">
          <Pill aria-hidden="true" className="h-7 w-7 text-zinc-500" />
          <p className="mt-3 text-sm font-medium text-white">
            No reconciliation workload uploaded for these months.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
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
        <p className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-sm text-amber-100">
          {formatInteger(latestMonth.excludedErrors)} reconciliation error(s) in{" "}
          {formatMonthLabel(latestMonth.month)} belong to pharmacists with no tracker numbers
          that month and are not included in the team total.
        </p>
      ) : null}
      <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
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
                    <TableCell className="whitespace-nowrap font-medium text-zinc-200">
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
                <TableRow className="bg-white/[0.03]">
                  <TableCell className="whitespace-nowrap font-semibold text-white">
                    Team total
                  </TableCell>
                  {data.months.map((month) => (
                    <TableCell className="align-top" key={month.month}>
                      <span className="block font-mono text-sm font-semibold text-white">
                        {formatAccuracy(month.team.accuracy)}
                      </span>
                      <FiguresText figures={month.team} />
                      {month.excludedErrors > 0 ? (
                        <span className="mt-1 block text-xs text-amber-200">
                          {formatInteger(month.excludedErrors)} excluded
                        </span>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="border-t border-white/10 px-4 py-3 text-xs text-zinc-500">
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
