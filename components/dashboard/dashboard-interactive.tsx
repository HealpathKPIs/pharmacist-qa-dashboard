"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  CircleGauge,
  ClipboardList,
  Minus,
  Search,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type {
  DailyPatientDetail,
  DailyTrendPoint,
  DashboardTotals,
  ErrorsByIssue,
  ErrorsByPharmacist,
  QaErrorDetail,
  SeverityDistributionPoint,
} from "@/lib/dashboard-queries";
import { cn } from "@/lib/utils";

const chartColors = ["#34d399", "#60a5fa", "#f59e0b", "#f472b6", "#a78bfa", "#22d3ee"];

type DialogState =
  | {
      description: string;
      patientRows: DailyPatientDetail[];
      title: string;
      type: "patients";
    }
  | {
      description: string;
      errorRows: QaErrorDetail[];
      title: string;
      type: "errors";
    }
  | null;

type DashboardInteractiveProps = {
  dailyPatientDetails: DailyPatientDetail[];
  dailyTrend: DailyTrendPoint[];
  errorsByIssue: ErrorsByIssue[];
  errorsByPharmacist: ErrorsByPharmacist[];
  previousTotals: DashboardTotals;
  qaErrorDetails: QaErrorDetail[];
  severityDistribution: SeverityDistributionPoint[];
  totals: DashboardTotals;
};

type ChartDatum = {
  name: string;
  value: number;
};

type BarClickPayload = {
  payload?: ChartDatum;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function calculatePercentDifference(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / previous) * 100;
}

function useAnimatedNumber(value: number) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayValueRef = useRef(value);

  useEffect(() => {
    const startValue = displayValueRef.current;
    const difference = value - startValue;
    const startedAt = performance.now();
    let frameId = 0;

    function animate(timestamp: number) {
      const progress = Math.min(1, (timestamp - startedAt) / 650);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + difference * easedProgress;

      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    }

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return displayValue;
}

function AnimatedMetric({
  formatter,
  value,
}: {
  formatter: (value: number) => string;
  value: number;
}) {
  const animatedValue = useAnimatedNumber(value);

  return <>{formatter(animatedValue)}</>;
}

function TrendIndicator({
  current,
  differenceFormatter = formatInteger,
  previous,
  valueFormatter = formatInteger,
}: {
  current: number;
  differenceFormatter?: (value: number) => string;
  previous: number;
  valueFormatter?: (value: number) => string;
}) {
  const difference = current - previous;
  const percentDifference = calculatePercentDifference(current, previous);
  const direction = difference > 0 ? "up" : difference < 0 ? "down" : "flat";

  return (
    <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
      <div className="flex items-center justify-between gap-3 text-zinc-500">
        <span>Previous</span>
        <span className="font-mono text-zinc-300">{valueFormatter(previous)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-zinc-500">Difference</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono",
            direction === "up" &&
              "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
            direction === "down" && "border-red-300/25 bg-red-300/10 text-red-200",
            direction === "flat" && "border-white/10 bg-white/[0.04] text-zinc-400",
          )}
        >
          {direction === "up" ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : null}
          {direction === "down" ? (
            <ArrowDown aria-hidden="true" className="h-3 w-3" />
          ) : null}
          {direction === "flat" ? <Minus aria-hidden="true" className="h-3 w-3" /> : null}
          {difference > 0 ? "+" : ""}
          {differenceFormatter(difference)}
          <span className="text-current/70">({formatSignedPercent(percentDifference)})</span>
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  detail,
  icon: Icon,
  label,
  onClick,
  previousLabel,
  trendCurrent,
  trendDifferenceFormatter,
  trendPrevious,
  trendValueFormatter,
  value,
}: {
  detail: string;
  icon: typeof Users;
  label: string;
  onClick: () => void;
  previousLabel?: string;
  trendCurrent: number;
  trendDifferenceFormatter?: (value: number) => string;
  trendPrevious: number;
  trendValueFormatter?: (value: number) => string;
  value: React.ReactNode;
}) {
  return (
    <button
      className="group animate-soft-in rounded-lg text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-emerald-300"
      onClick={onClick}
      type="button"
    >
      <Card className="h-full border-white/10 bg-white/[0.045] shadow-none transition-colors group-hover:border-emerald-300/30 group-hover:bg-white/[0.07]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                {label}
              </p>
              <p className="mt-3 truncate font-mono text-3xl font-semibold text-white">
                {value}
              </p>
              <p className="mt-2 text-sm text-zinc-400">{detail}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-300 transition-colors group-hover:border-emerald-300/40">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
          {previousLabel ? (
            <div className="mt-4 border-t border-white/10 pt-3 text-xs">
              <div className="flex items-center justify-between gap-3 text-zinc-500">
                <span>Previous</span>
                <span className="truncate text-right font-mono text-zinc-300">
                  {previousLabel}
                </span>
              </div>
              <TrendIndicator
                current={trendCurrent}
                differenceFormatter={trendDifferenceFormatter}
                previous={trendPrevious}
                valueFormatter={trendValueFormatter}
              />
            </div>
          ) : (
            <TrendIndicator
              current={trendCurrent}
              differenceFormatter={trendDifferenceFormatter}
              previous={trendPrevious}
              valueFormatter={trendValueFormatter}
            />
          )}
        </CardContent>
      </Card>
    </button>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-white/10 px-4 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

function PatientRowsTable({ rows }: { rows: DailyPatientDetail[] }) {
  if (rows.length === 0) {
    return <ChartEmptyState label="No daily patient rows match this selection." />;
  }

  return (
    <div className="max-h-[58vh] overflow-auto rounded-md border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead className="text-right">Patients</TableHead>
            <TableHead>Source file</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-zinc-200">
                {formatDay(row.day)}
              </TableCell>
              <TableCell className="text-right font-mono text-zinc-300">
                {formatInteger(row.patientCount)}
              </TableCell>
              <TableCell className="text-zinc-400">{row.sourceFile ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QaErrorRowsTable({ rows }: { rows: QaErrorDetail[] }) {
  if (rows.length === 0) {
    return <ChartEmptyState label="No QA error records match this selection." />;
  }

  return (
    <div className="max-h-[58vh] overflow-auto rounded-md border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Pharmacist</TableHead>
            <TableHead>Patient ID</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-zinc-300">
                {formatDay(row.day)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium text-zinc-200">
                {row.pharmacistName}
              </TableCell>
              <TableCell className="font-mono text-zinc-400">{row.patientId}</TableCell>
              <TableCell className="min-w-64 text-zinc-300">{row.issueType}</TableCell>
              <TableCell className="text-right font-mono text-zinc-400">
                {row.score}
              </TableCell>
              <TableCell className="min-w-80 text-zinc-400">
                {row.issueDetails ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DashboardInteractive({
  dailyPatientDetails,
  dailyTrend,
  errorsByIssue,
  errorsByPharmacist,
  previousTotals,
  qaErrorDetails,
  severityDistribution,
  totals,
}: DashboardInteractiveProps) {
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const pharmacistChartData = useMemo(
    () =>
      errorsByPharmacist.map((row) => ({
        name: row.pharmacistName,
        value: row.errorCount,
      })),
    [errorsByPharmacist],
  );
  const issueChartData = useMemo(
    () =>
      errorsByIssue.map((row) => ({
        name: row.issueType,
        value: row.errorCount,
      })),
    [errorsByIssue],
  );
  const severityChartData = useMemo(
    () =>
      severityDistribution.map((row) => ({
        name: `Score ${row.score}`,
        value: row.errorCount,
      })),
    [severityDistribution],
  );

  function openErrorsDialog(title: string, description: string, rows: QaErrorDetail[]) {
    setDialogState({
      description,
      errorRows: rows,
      title,
      type: "errors",
    });
  }

  function openPatientDialog() {
    setDialogState({
      description: "Daily patient rows for the selected dashboard filters.",
      patientRows: dailyPatientDetails,
      title: "Daily Patients",
      type: "patients",
    });
  }

  function openMostCommonIssueDialog() {
    const issueType = totals.mostCommonIssue;
    const rows = issueType
      ? qaErrorDetails.filter((row) => row.issueType === issueType)
      : [];

    openErrorsDialog(
      issueType ? `Most Common Issue: ${issueType}` : "Most Common Issue",
      "All QA records for the current most common issue.",
      rows,
    );
  }

  function handleBarClick(payload: BarClickPayload, type: "issue" | "pharmacist") {
    const label = payload.payload?.name;

    if (!label) {
      return;
    }

    const rows =
      type === "pharmacist"
        ? qaErrorDetails.filter((row) => row.pharmacistName === label)
        : qaErrorDetails.filter((row) => row.issueType === label);

    openErrorsDialog(
      type === "pharmacist" ? `Errors by ${label}` : `Issue: ${label}`,
      `All QA error records matching ${label}.`,
      rows,
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <KpiCard
          detail="Daily patient count"
          icon={Users}
          label="Total Patients"
          onClick={openPatientDialog}
          trendCurrent={totals.totalPatients}
          trendPrevious={previousTotals.totalPatients}
          value={
            <AnimatedMetric formatter={(value) => formatInteger(Math.round(value))} value={totals.totalPatients} />
          }
        />
        <KpiCard
          detail="Validated QA records"
          icon={ClipboardList}
          label="Total QA Errors"
          onClick={() =>
            openErrorsDialog(
              "All QA Errors",
              "QA error records for the selected dashboard filters.",
              qaErrorDetails,
            )
          }
          trendCurrent={totals.totalQaErrors}
          trendPrevious={previousTotals.totalQaErrors}
          value={
            <AnimatedMetric formatter={(value) => formatInteger(Math.round(value))} value={totals.totalQaErrors} />
          }
        />
        <KpiCard
          detail="Errors per 100 patients"
          icon={CircleGauge}
          label="Error Rate"
          onClick={() =>
            openErrorsDialog(
              "QA Errors Behind Error Rate",
              "Filtered QA error records used in the current error-rate calculation.",
              qaErrorDetails,
            )
          }
          trendCurrent={totals.errorRate}
          trendDifferenceFormatter={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`}
          trendPrevious={previousTotals.errorRate}
          trendValueFormatter={formatPercent}
          value={<AnimatedMetric formatter={formatPercent} value={totals.errorRate} />}
        />
        <KpiCard
          detail="Active in QA rows"
          icon={Activity}
          label="Total Pharmacists"
          onClick={() =>
            openErrorsDialog(
              "Errors by All Pharmacists",
              "QA error records across active pharmacists in the selected filters.",
              qaErrorDetails,
            )
          }
          trendCurrent={totals.totalPharmacists}
          trendPrevious={previousTotals.totalPharmacists}
          value={
            <AnimatedMetric formatter={(value) => formatInteger(Math.round(value))} value={totals.totalPharmacists} />
          }
        />
        <KpiCard
          detail={`${formatInteger(totals.mostCommonIssueCount)} matching records`}
          icon={Star}
          label="Most Common Issue"
          onClick={openMostCommonIssueDialog}
          previousLabel={
            previousTotals.mostCommonIssue
              ? `${previousTotals.mostCommonIssue} (${formatInteger(previousTotals.mostCommonIssueCount)})`
              : "No issue"
          }
          trendCurrent={totals.mostCommonIssueCount}
          trendPrevious={previousTotals.mostCommonIssueCount}
          value={
            <span className="block truncate text-xl leading-9">
              {totals.mostCommonIssue ?? "No issue"}
            </span>
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-white">Daily Trend</CardTitle>
            <CardDescription>Error rate over time</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {dailyTrend.length === 0 ? (
              <ChartEmptyState label="No daily trend data for the selected filters." />
            ) : (
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={dailyTrend} margin={{ bottom: 8, left: 0, right: 12, top: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    minTickGap={24}
                    stroke="#71717a"
                    tickFormatter={(value: string) => formatDay(value).slice(0, 6)}
                    tickLine={false}
                  />
                  <YAxis stroke="#71717a" tickFormatter={(value: number) => `${value}%`} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0b0d0f",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "8px",
                      color: "#f4f4f5",
                    }}
                    formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);
                      const label = String(name);

                      return [
                        label === "Error rate"
                          ? formatPercent(numericValue)
                          : formatInteger(numericValue),
                        label,
                      ];
                    }}
                    labelFormatter={(value) => formatDay(String(value))}
                  />
                  <Line
                    dataKey="errorRate"
                    dot={{ fill: "#34d399", r: 3 }}
                    name="Error rate"
                    stroke="#34d399"
                    strokeWidth={3}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <DonutChartCard
          data={severityChartData}
          emptyLabel="No severity records for the selected filters."
          title="Severity Distribution"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <InteractiveBarChart
          data={pharmacistChartData}
          emptyLabel="No pharmacist chart data for the selected filters."
          onBarClick={(payload) => handleBarClick(payload, "pharmacist")}
          title="Errors by Pharmacist"
        />
        <InteractiveBarChart
          data={issueChartData}
          emptyLabel="No issue chart data for the selected filters."
          onBarClick={(payload) => handleBarClick(payload, "issue")}
          title="Errors by Issue"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DonutChartCard
          data={pharmacistChartData}
          emptyLabel="No pharmacist distribution for the selected filters."
          onSliceClick={(name) =>
            openErrorsDialog(
              `Errors by ${name}`,
              "All QA error records for this pharmacist.",
              qaErrorDetails.filter((row) => row.pharmacistName === name),
            )
          }
          title="QA Errors by Pharmacist"
        />
        <DonutChartCard
          data={issueChartData}
          emptyLabel="No issue distribution for the selected filters."
          onSliceClick={(name) =>
            openErrorsDialog(
              `Issue: ${name}`,
              "All QA error records for this issue type.",
              qaErrorDetails.filter((row) => row.issueType === name),
            )
          }
          title="QA Errors by Issue Type"
        />
        <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-white">Top Records</CardTitle>
            <CardDescription>Quick scan of current filter results</CardDescription>
          </CardHeader>
          <CardContent>
            {qaErrorDetails.length === 0 ? (
              <ChartEmptyState label="No QA records to preview." />
            ) : (
              <div className="space-y-3">
                {qaErrorDetails.slice(0, 5).map((row) => (
                  <button
                    className="flex w-full items-start gap-3 rounded-md border border-white/10 bg-black/20 p-3 text-left transition-colors hover:border-emerald-300/25 hover:bg-white/[0.04]"
                    key={row.id}
                    onClick={() =>
                      openErrorsDialog(
                        `Record ${row.id}`,
                        "Selected QA error record.",
                        [row],
                      )
                    }
                    type="button"
                  >
                    <Search aria-hidden="true" className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {row.issueType}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {formatDay(row.day)} · {row.pharmacistName} · Score {row.score}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <DetailDialog dialogState={dialogState} onOpenChange={(open) => !open && setDialogState(null)} />
    </>
  );
}

function InteractiveBarChart({
  data,
  emptyLabel,
  onBarClick,
  title,
}: {
  data: ChartDatum[];
  emptyLabel: string;
  onBarClick: (payload: BarClickPayload) => void;
  title: string;
}) {
  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
        <CardDescription>Click a bar to inspect matching records</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <ChartEmptyState label={emptyLabel} />
        ) : (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={data.slice(0, 8)}
              layout="vertical"
              margin={{ bottom: 8, left: 12, right: 12, top: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis stroke="#71717a" tickLine={false} type="number" />
              <YAxis
                dataKey="name"
                stroke="#a1a1aa"
                tickLine={false}
                type="category"
                width={128}
              />
              <Tooltip
                contentStyle={{
                  background: "#0b0d0f",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                }}
                formatter={(value) => [formatInteger(Number(value ?? 0)), "Errors"]}
              />
              <Bar
                className="cursor-pointer"
                dataKey="value"
                fill="#34d399"
                onClick={(payload) => onBarClick(payload as BarClickPayload)}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function DonutChartCard({
  data,
  emptyLabel,
  onSliceClick,
  title,
}: {
  data: ChartDatum[];
  emptyLabel: string;
  onSliceClick?: (name: string) => void;
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
        <CardDescription>
          {onSliceClick ? "Click a slice to inspect matching records" : "Filtered distribution"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState label={emptyLabel} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="h-48">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={data}
                    dataKey="value"
                    innerRadius={52}
                    nameKey="name"
                    onClick={(payload) => onSliceClick?.(String(payload.name))}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        className={cn(onSliceClick && "cursor-pointer")}
                        fill={chartColors[index % chartColors.length]}
                        key={entry.name}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0b0d0f",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "8px",
                      color: "#f4f4f5",
                    }}
                    formatter={(value) => [formatInteger(Number(value ?? 0)), "Records"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {data.slice(0, 6).map((item, index) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.name}>
                  <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-mono text-zinc-500">
                    {formatInteger(item.value)} ·{" "}
                    {total === 0 ? "0.0%" : formatSignedPercent((item.value / total) * 100).replace("+", "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailDialog({
  dialogState,
  onOpenChange,
}: {
  dialogState: DialogState;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(dialogState)}>
      <DialogContent>
        {dialogState ? (
          <>
            <DialogHeader>
              <DialogTitle>{dialogState.title}</DialogTitle>
              <DialogDescription>{dialogState.description}</DialogDescription>
            </DialogHeader>
            {dialogState.type === "patients" ? (
              <PatientRowsTable rows={dialogState.patientRows} />
            ) : (
              <QaErrorRowsTable rows={dialogState.errorRows} />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
