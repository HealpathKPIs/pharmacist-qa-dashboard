"use client";

import {
  AlertCircle,
  ChevronRight,
  Clock,
  Info,
  ListChecks,
  Timer,
  TimerReset,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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
import type { ProcessingFigures, ProcessingTaskTypeFigures } from "@/lib/processing-time";
import type {
  ProcessingTimeData,
  ProcessingTimePeriod,
  ProcessingTimeResult,
} from "@/lib/processing-time-queries";
import { cn } from "@/lib/utils";

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

// A fixed time zone, so the server and the browser show the same text.
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
});

const ALL_TASK_TYPES = "";

function toDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercentValue(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : formatPercentValue(value);
}

function formatPercentDifference(value: number) {
  return `${value.toFixed(2)} pp`;
}

function formatPeriod(period: ProcessingTimePeriod | null) {
  if (!period) {
    return "All dates";
  }

  const { endDate, startDate } = period;

  if (startDate === endDate) {
    return dateFormatter.format(toDate(startDate));
  }

  const startFormatter =
    startDate.slice(0, 4) === endDate.slice(0, 4) ? dayFormatter : dateFormatter;

  return `${startFormatter.format(toDate(startDate))} – ${dateFormatter.format(toDate(endDate))}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatInteger(count)} ${count === 1 ? singular : pluralForm}`;
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
          Processing Time KPI
        </h2>
        {caption ? <p className="mt-1 text-xs text-fg-subtle">{caption}</p> : null}
        {lastUploadAt !== undefined ? (
          <p className="mt-1 text-xs text-fg-subtle">
            Last tracker upload:{" "}
            {lastUploadAt ? dateTimeFormatter.format(new Date(lastUploadAt)) : "No tracker uploaded yet"}
          </p>
        ) : null}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Processing Time = total SLA minutes ÷ total actual minutes × 100. 100% is on SLA, above
        100% is faster than SLA, below 100% is slower. Exact dates selected, compared with the
        previous period of the same length.
      </p>
    </div>
  );
}

function SlaChip({ percent }: { percent: number | null }) {
  if (percent === null) {
    return null;
  }

  const withinSla = percent >= 100;

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        withinSla
          ? "border-brand/25 bg-brand/10 text-brand-strong"
          : "border-warning/30 bg-warning/10 text-warning-strong",
      )}
    >
      {withinSla ? "Within SLA" : "Slower than SLA"}
    </span>
  );
}

function TaskTypeFilter({ options, value }: { options: string[]; value: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectTaskType(taskType: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.delete("pharmacistCleared");

    if (taskType) {
      nextParams.set("taskType", taskType);
    } else {
      nextParams.delete("taskType");
    }

    startTransition(() => {
      router.push(nextParams.size > 0 ? `${pathname}?${nextParams}` : pathname, {
        scroll: false,
      });
    });
  }

  // Keep a selected type that has no rows in the dates, so it stays visible.
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <label className="flex w-full max-w-md flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
        Task Type
      </span>
      <select
        aria-busy={isPending}
        className={cn(
          "flex h-10 w-full rounded-md border border-field-line bg-field px-3 py-2 text-sm text-fg-strong outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isPending && "opacity-70",
        )}
        onChange={(event) => selectTaskType(event.target.value)}
        value={value ?? ALL_TASK_TYPES}
      >
        <option value={ALL_TASK_TYPES}>All task types</option>
        {allOptions.map((taskType) => (
          <option key={taskType} value={taskType}>
            {taskType}
          </option>
        ))}
      </select>
      <span className="text-xs text-fg-subtle">
        Applies to this KPI only. With a task type selected, the Pharmacist filter lists only
        pharmacists with that task type in the dates.
      </span>
    </label>
  );
}

function MetricCards({
  figures,
  periodLabel,
  previous,
}: {
  figures: ProcessingFigures;
  periodLabel: string;
  previous: ProcessingFigures | null;
}) {
  const previousLabel = "vs previous period";

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <MonthlyMetricCard
        current={figures.percent}
        differenceFormatter={formatPercentDifference}
        formatter={formatPercentValue}
        icon={Timer}
        label="Processing Time"
        monthLabel={`${periodLabel} · SLA ÷ actual minutes`}
        previous={previous?.percent ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.slaMinutes}
        formatter={formatMinutes}
        icon={TimerReset}
        label="SLA Minutes"
        monthLabel="Expected minutes (items × SLA per item)"
        previous={previous?.slaMinutes ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.actualMinutes}
        formatter={formatMinutes}
        higherIsBetter={false}
        icon={Clock}
        label="Actual Minutes"
        monthLabel="Time actually spent"
        previous={previous?.actualMinutes ?? null}
        previousLabel={previousLabel}
      />
      <MonthlyMetricCard
        current={figures.tasks}
        formatter={formatInteger}
        icon={ListChecks}
        label="Task Rows"
        monthLabel={`${formatMinutes(figures.items)} items completed`}
        previous={previous?.tasks ?? null}
        previousLabel={previousLabel}
      />
    </div>
  );
}

function FigureCells({ figures, strong = false }: { figures: ProcessingFigures; strong?: boolean }) {
  return (
    <>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {figures.tasks > 0 ? formatInteger(figures.tasks) : "—"}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {figures.tasks > 0 ? formatMinutes(figures.items) : "—"}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {figures.tasks > 0 ? formatMinutes(figures.slaMinutes) : "—"}
      </TableCell>
      <TableCell className="text-right align-top font-mono text-sm text-foreground">
        {figures.tasks > 0 ? formatMinutes(figures.actualMinutes) : "—"}
      </TableCell>
      <TableCell className="align-top">
        <span
          className={cn(
            "block font-mono text-sm font-semibold",
            strong ? "text-fg-strong" : "text-foreground",
          )}
        >
          {formatPercent(figures.percent)}
        </span>
        <span className="mt-1 block">
          <SlaChip percent={figures.percent} />
        </span>
      </TableCell>
    </>
  );
}

function FigureHeadings({ firstLabel }: { firstLabel: string }) {
  return (
    <TableRow>
      <TableHead className="min-w-48">{firstLabel}</TableHead>
      <TableHead className="text-right">Task Rows</TableHead>
      <TableHead className="text-right">Items</TableHead>
      <TableHead className="text-right">SLA Minutes</TableHead>
      <TableHead className="text-right">Actual Minutes</TableHead>
      <TableHead className="min-w-36">Processing Time</TableHead>
    </TableRow>
  );
}

function PharmacistTable({
  data,
  onSelect,
}: {
  data: ProcessingTimeData;
  onSelect: (pharmacist: string) => void;
}) {
  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <FigureHeadings firstLabel="Pharmacist" />
            </TableHeader>
            <TableBody>
              {data.pharmacists.length === 0 ? (
                <TableRow>
                  <TableCell className="text-sm text-fg-subtle" colSpan={6}>
                    No active pharmacist has rows for this selection.
                  </TableCell>
                </TableRow>
              ) : null}
              {data.pharmacists.map((pharmacist) => {
                const figures = data.byPharmacist[pharmacist];

                return (
                  <TableRow key={pharmacist}>
                    <TableCell className="align-top">
                      {figures.tasks > 0 ? (
                        <button
                          aria-label={`${pharmacist}: ${formatPercent(figures.percent)} Processing Time. Show the task types.`}
                          className="group inline-flex items-center gap-1 whitespace-nowrap rounded-md text-left font-medium text-fg-secondary transition-colors hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          onClick={() => onSelect(pharmacist)}
                          type="button"
                        >
                          {pharmacist}
                          <ChevronRight
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-fg-subtle transition-transform group-hover:translate-x-0.5"
                          />
                        </button>
                      ) : (
                        <span className="font-medium text-fg-secondary">{pharmacist}</span>
                      )}
                    </TableCell>
                    <FigureCells figures={figures} />
                  </TableRow>
                );
              })}
              <TableRow className="bg-tint/[0.03]">
                <TableCell className="align-top font-semibold text-fg-strong">Team total</TableCell>
                <FigureCells figures={data.team} strong />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
          The team total adds every pharmacist&apos;s SLA minutes and actual minutes, then divides
          once; it is not an average of pharmacist percentages. &quot;—&quot; means no task rows in
          the dates. Click a name to see their task types.
        </p>
      </CardContent>
    </Card>
  );
}

function TaskTypeTable({
  rows,
  team,
}: {
  rows: ProcessingTaskTypeFigures[];
  team?: ProcessingFigures;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <FigureHeadings firstLabel="Task Type" />
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.taskType}>
              <TableCell className="align-top font-medium text-fg-secondary">{row.taskType}</TableCell>
              <FigureCells figures={row.figures} />
            </TableRow>
          ))}
          {team ? (
            <TableRow className="bg-tint/[0.03]">
              <TableCell className="align-top font-semibold text-fg-strong">Total</TableCell>
              <FigureCells figures={team} strong />
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function PharmacistDialog({
  data,
  onClose,
  periodLabel,
  pharmacist,
}: {
  data: ProcessingTimeData;
  onClose: () => void;
  periodLabel: string;
  pharmacist: string | null;
}) {
  const figures = pharmacist ? data.byPharmacist[pharmacist] : null;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(pharmacist)}>
      <DialogContent className="max-w-4xl">
        {pharmacist && figures ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Task types: {pharmacist}, {periodLabel}
              </DialogTitle>
              <DialogDescription>
                Processing Time {formatPercent(figures.percent)} ·{" "}
                {plural(figures.tasks, "task row")} · {formatMinutes(figures.slaMinutes)} SLA
                minutes ÷ {formatMinutes(figures.actualMinutes)} actual minutes
                {data.taskType ? ` · ${data.taskType} only` : ""}
              </DialogDescription>
            </DialogHeader>
            <TaskTypeTable rows={data.byPharmacistTaskType[pharmacist] ?? []} team={figures} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ProcessingTimeSection({
  pharmacistCleared,
  result,
}: {
  pharmacistCleared: string | null;
  result: ProcessingTimeResult;
}) {
  const [selectedPharmacist, setSelectedPharmacist] = useState<string | null>(null);

  if (result.error !== null) {
    return (
      <section className="space-y-4">
        <SectionHeader />
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            The Processing Time KPI could not be loaded. The rest of the page is not affected.{" "}
            {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const periodLabel = formatPeriod(data.period);
  const caption = [
    periodLabel,
    data.pharmacistName ?? "All active Clinical pharmacists",
    data.taskType ?? "All task types",
  ].join(" · ");

  if (!data.hasUploads) {
    return (
      <section className="space-y-4">
        <SectionHeader caption={caption} lastUploadAt={data.lastUploadAt} />
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <Timer aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">No Processing Time tracker uploaded yet.</p>
          <p className="mt-1 text-sm text-fg-subtle">
            Upload the monthly tracker on Upload Data → Processing Time Tracker.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader caption={caption} lastUploadAt={data.lastUploadAt} />
      <TaskTypeFilter options={data.taskTypeOptions} value={data.taskType} />
      {pharmacistCleared && data.taskType ? (
        <p className="flex items-start gap-2 rounded-md border border-info/25 bg-info/[0.06] px-3 py-2 text-sm text-fg-secondary">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          {pharmacistCleared} has no {data.taskType} rows in this period, so the pharmacist filter
          was cleared.
        </p>
      ) : null}
      <MetricCards figures={data.team} periodLabel={periodLabel} previous={data.previous} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-fg-strong">By Pharmacist</h3>
        <PharmacistTable data={data} onSelect={setSelectedPharmacist} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-fg-strong">By Task Type</h3>
        <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
          <CardContent className="p-0">
            {data.byTaskType.length > 0 ? (
              <TaskTypeTable rows={data.byTaskType} team={data.team} />
            ) : (
              <p className="px-4 py-3 text-sm text-fg-subtle">No task rows for this selection.</p>
            )}
            <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
              Same formula per task type: that type&apos;s SLA minutes ÷ its actual minutes.
            </p>
          </CardContent>
        </Card>
      </div>
      <PharmacistDialog
        data={data}
        onClose={() => setSelectedPharmacist(null)}
        periodLabel={periodLabel}
        pharmacist={selectedPharmacist}
      />
    </section>
  );
}
