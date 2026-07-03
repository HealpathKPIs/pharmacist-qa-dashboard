"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Minus,
  Search,
  Star,
  UploadCloud,
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
  databaseHealthy: boolean;
  errorsByIssue: ErrorsByIssue[];
  errorsByPharmacist: ErrorsByPharmacist[];
  previousQaErrorDetails: QaErrorDetail[];
  previousTotals: DashboardTotals;
  qaErrorDetails: QaErrorDetail[];
  recentUpload: RecentUpload | null;
  severityDistribution: SeverityDistributionPoint[];
  totals: DashboardTotals;
};

type ChartDatum = {
  name: string;
  value: number;
};

type RecentUpload = {
  failedRows: number;
  fileName: string;
  insertedRows: number;
  skippedRows: number;
  status: string;
  uploadedAt: string | null;
};

type BarClickPayload = {
  payload?: ChartDatum;
};

type SelectedBar = {
  name: string;
  type: "issue" | "pharmacist";
} | null;

type Insight = {
  currentRate: number;
  difference: number;
  label: string;
  name: string;
  previousRate: number;
  tone: "good" | "bad" | "neutral";
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

function formatSignedPoints(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)} pp`;
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "No import yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function truncateLabel(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function getAverageSeverity(rows: QaErrorDetail[]) {
  if (rows.length === 0) {
    return 0;
  }

  return rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
}

function getErrorRate(errorCount: number, totalPatients: number) {
  if (totalPatients === 0) {
    return 0;
  }

  return (errorCount / totalPatients) * 100;
}

function countErrorsByPharmacist(rows: QaErrorDetail[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.pharmacistName] = (counts[row.pharmacistName] ?? 0) + 1;

    return counts;
  }, {});
}

function buildExecutiveInsights({
  currentRows,
  currentTotalPatients,
  previousRows,
  previousTotalPatients,
}: {
  currentRows: QaErrorDetail[];
  currentTotalPatients: number;
  previousRows: QaErrorDetail[];
  previousTotalPatients: number;
}): Insight[] {
  const currentCounts = countErrorsByPharmacist(currentRows);
  const previousCounts = countErrorsByPharmacist(previousRows);
  const names = Array.from(
    new Set([...Object.keys(currentCounts), ...Object.keys(previousCounts)]),
  );

  const rows = names.map((name) => {
    const currentRate = getErrorRate(currentCounts[name] ?? 0, currentTotalPatients);
    const previousRate = getErrorRate(previousCounts[name] ?? 0, previousTotalPatients);

    return {
      currentRate,
      difference: currentRate - previousRate,
      name,
      previousRate,
    };
  });

  const bestPerformer = rows
    .filter((row) => currentCounts[row.name] > 0)
    .sort((a, b) => a.currentRate - b.currentRate)[0];
  const needsAttention = rows
    .filter((row) => currentCounts[row.name] > 0)
    .sort((a, b) => b.currentRate - a.currentRate)[0];
  const biggestImprovement = rows
    .filter((row) => row.previousRate > 0 || row.currentRate > 0)
    .sort((a, b) => a.difference - b.difference)[0];
  const biggestDecline = rows
    .filter((row) => row.previousRate > 0 || row.currentRate > 0)
    .sort((a, b) => b.difference - a.difference)[0];

  return [
    {
      ...(bestPerformer ?? {
        currentRate: 0,
        difference: 0,
        name: "No data",
        previousRate: 0,
      }),
      label: "Best Performer",
      tone: "good" as const,
    },
    {
      ...(needsAttention ?? {
        currentRate: 0,
        difference: 0,
        name: "No data",
        previousRate: 0,
      }),
      label: "Needs Attention",
      tone: "bad" as const,
    },
    {
      ...(biggestImprovement ?? {
        currentRate: 0,
        difference: 0,
        name: "No data",
        previousRate: 0,
      }),
      label: "Biggest Improvement",
      tone:
        biggestImprovement && biggestImprovement.difference < 0
          ? ("good" as const)
          : ("neutral" as const),
    },
    {
      ...(biggestDecline ?? {
        currentRate: 0,
        difference: 0,
        name: "No data",
        previousRate: 0,
      }),
      label: "Biggest Decline",
      tone:
        biggestDecline && biggestDecline.difference > 0
          ? ("bad" as const)
          : ("neutral" as const),
    },
  ];
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
    <div className="space-y-2 text-xs">
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
      className="group animate-soft-in h-full rounded-xl text-left outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-emerald-300"
      onClick={onClick}
      type="button"
    >
      <Card className="h-full min-h-[226px] border-white/10 bg-white/[0.05] shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-all duration-300 group-hover:border-emerald-300/35 group-hover:bg-white/[0.075] group-hover:shadow-[0_22px_70px_rgba(16,185,129,0.08)]">
        <CardContent className="flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">
                {label}
              </p>
              <p className="mt-4 truncate font-mono text-3xl font-semibold leading-none text-white">
                {value}
              </p>
              <p className="mt-3 text-sm leading-5 text-zinc-400">{detail}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300 transition-colors group-hover:border-emerald-300/45">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            {previousLabel ? (
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span>Previous issue</span>
                <span className="truncate text-right font-mono text-zinc-300">
                  {previousLabel}
                </span>
              </div>
            ) : null}
            <TrendIndicator
              current={trendCurrent}
              differenceFormatter={trendDifferenceFormatter}
              previous={trendPrevious}
              valueFormatter={trendValueFormatter}
            />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function ExecutiveMetricCard({
  detail,
  icon: Icon,
  label,
  previous,
  trendDifferenceFormatter,
  trendValueFormatter,
  value,
}: {
  detail: string;
  icon: typeof Users;
  label: string;
  previous: number;
  trendDifferenceFormatter?: (value: number) => string;
  trendValueFormatter?: (value: number) => string;
  value: number;
}) {
  const formatter = trendValueFormatter ?? ((metric: number) => formatInteger(Math.round(metric)));

  return (
    <Card className="animate-soft-in h-full min-h-[184px] border-white/10 bg-gradient-to-br from-white/[0.075] to-white/[0.035] shadow-[0_20px_70px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/35 hover:shadow-[0_26px_80px_rgba(16,185,129,0.1)]">
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">
              {label}
            </p>
            <p className="mt-4 truncate font-mono text-3xl font-semibold leading-none text-white">
              <AnimatedMetric formatter={formatter} value={value} />
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-sm leading-5 text-zinc-400">{detail}</p>
          <div className="border-t border-white/10 pt-3">
            <TrendIndicator
              current={value}
              differenceFormatter={trendDifferenceFormatter}
              previous={previous}
              valueFormatter={trendValueFormatter}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const isImprovement = insight.tone === "good";
  const isDecline = insight.tone === "bad";
  const ArrowIcon = isImprovement ? ArrowDown : isDecline ? ArrowUp : Minus;

  return (
    <Card className="animate-soft-in h-full min-h-[178px] border-white/10 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.065]">
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">
              {insight.label}
            </p>
            <p className="mt-3 truncate text-lg font-semibold text-white">{insight.name}</p>
          </div>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              isImprovement && "border-emerald-300/25 bg-emerald-300/10 text-emerald-300",
              isDecline && "border-red-300/25 bg-red-300/10 text-red-300",
              !isImprovement && !isDecline && "border-white/10 bg-white/[0.04] text-zinc-400",
            )}
          >
            <ArrowIcon aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
          <div>
            <p className="text-zinc-500">Current</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {formatPercent(insight.currentRate)}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Previous</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {formatPercent(insight.previousRate)}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Diff</p>
            <p
              className={cn(
                "mt-1 font-mono text-sm",
                isImprovement && "text-emerald-300",
                isDecline && "text-red-300",
                !isImprovement && !isDecline && "text-zinc-400",
              )}
            >
              {formatSignedPoints(insight.difference)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-300">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">{title}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-zinc-400">{subtitle}</p>
    </div>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm leading-6 text-zinc-500">
      {label}
    </div>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-white">
        {formatInteger(value)}
      </p>
    </div>
  );
}

function RecentActivityCard({ recentUpload }: { recentUpload: RecentUpload | null }) {
  return (
    <Card className="animate-soft-in h-full border-white/10 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/10 text-sky-300">
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base text-white">Recent Activity</CardTitle>
            <CardDescription>Latest import batch</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentUpload ? (
          <div className="space-y-4">
            <div>
              <p className="truncate text-sm font-medium text-white">{recentUpload.fileName}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDateTime(recentUpload.uploadedAt)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ActivityStat label="Rows imported" value={recentUpload.insertedRows} />
              <ActivityStat label="Rows failed" value={recentUpload.failedRows} />
              <ActivityStat label="Rows skipped" value={recentUpload.skippedRows} />
            </div>
          </div>
        ) : (
          <ChartEmptyState label="No uploads have been recorded yet." />
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  healthy,
  label,
  value,
}: {
  healthy: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-zinc-300">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            healthy
              ? "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.45)]"
              : "bg-red-300",
          )}
        />
        {label}
      </span>
      <span className={cn("text-xs", healthy ? "text-emerald-200" : "text-red-200")}>
        {value}
      </span>
    </div>
  );
}

function SystemStatusCard({
  databaseHealthy,
  recentUpload,
}: {
  databaseHealthy: boolean;
  recentUpload: RecentUpload | null;
}) {
  const lastImportHealthy = recentUpload ? recentUpload.status !== "failed" : true;
  const overallHealthy = databaseHealthy && lastImportHealthy;

  return (
    <Card className="animate-soft-in h-full border-white/10 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base text-white">System Status</CardTitle>
            <CardDescription>Operational readiness</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusRow
          healthy={databaseHealthy}
          label="Database"
          value={databaseHealthy ? "Healthy" : "Issue detected"}
        />
        <StatusRow healthy label="Authentication" value="Protected" />
        <StatusRow
          healthy={lastImportHealthy}
          label="Last Import"
          value={recentUpload ? recentUpload.status : "No imports"}
        />
        <StatusRow
          healthy={overallHealthy}
          label="Overall Status"
          value={overallHealthy ? "Healthy" : "Needs review"}
        />
      </CardContent>
    </Card>
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
  databaseHealthy,
  errorsByIssue,
  errorsByPharmacist,
  previousQaErrorDetails,
  previousTotals,
  qaErrorDetails,
  recentUpload,
  severityDistribution,
  totals,
}: DashboardInteractiveProps) {
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [selectedBar, setSelectedBar] = useState<SelectedBar>(null);
  const averageSeverity = getAverageSeverity(qaErrorDetails);
  const previousAverageSeverity = getAverageSeverity(previousQaErrorDetails);
  const executiveInsights = useMemo(
    () =>
      buildExecutiveInsights({
        currentRows: qaErrorDetails,
        currentTotalPatients: totals.totalPatients,
        previousRows: previousQaErrorDetails,
        previousTotalPatients: previousTotals.totalPatients,
      }),
    [
      previousQaErrorDetails,
      previousTotals.totalPatients,
      qaErrorDetails,
      totals.totalPatients,
    ],
  );
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

    setSelectedBar({ name: label, type });

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
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Executive Dashboard"
          subtitle="Leadership snapshot for the selected filters and the matching previous period."
          title="Executive Summary"
        />
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <ExecutiveMetricCard
            detail="Patients in the selected date range"
            icon={Users}
            label="Total Patients"
            previous={previousTotals.totalPatients}
            value={totals.totalPatients}
          />
          <ExecutiveMetricCard
            detail="Validated QA error records"
            icon={ClipboardList}
            label="Total QA Errors"
            previous={previousTotals.totalQaErrors}
            value={totals.totalQaErrors}
          />
          <ExecutiveMetricCard
            detail="QA errors per 100 patients"
            icon={CircleGauge}
            label="Error Rate"
            previous={previousTotals.errorRate}
            trendDifferenceFormatter={formatSignedPoints}
            trendValueFormatter={formatPercent}
            value={totals.errorRate}
          />
          <ExecutiveMetricCard
            detail="Average score across filtered QA errors"
            icon={Activity}
            label="Average Severity"
            previous={previousAverageSeverity}
            trendDifferenceFormatter={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`}
            trendValueFormatter={(value) => value.toFixed(2)}
            value={averageSeverity}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {executiveInsights.map((insight) => (
            <InsightCard insight={insight} key={insight.label} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <RecentActivityCard recentUpload={recentUpload} />
          <SystemStatusCard databaseHealthy={databaseHealthy} recentUpload={recentUpload} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          subtitle="Click any card to inspect the records behind the metric."
          title="Operational KPIs"
        />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
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
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          subtitle="Trend, severity, pharmacist, and issue distributions update with every filter change."
          title="Performance Trends"
        />
        <div className="grid gap-4 xl:grid-cols-3">
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
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <InteractiveBarChart
          data={pharmacistChartData}
          emptyLabel="No pharmacist chart data for the selected filters."
          onBarClick={(payload) => handleBarClick(payload, "pharmacist")}
          selectedName={selectedBar?.type === "pharmacist" ? selectedBar.name : null}
          title="Errors by Pharmacist"
        />
        <InteractiveBarChart
          data={issueChartData}
          emptyLabel="No issue chart data for the selected filters."
          onBarClick={(payload) => handleBarClick(payload, "issue")}
          selectedName={selectedBar?.type === "issue" ? selectedBar.name : null}
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
  selectedName,
  title,
}: {
  data: ChartDatum[];
  emptyLabel: string;
  onBarClick: (payload: BarClickPayload) => void;
  selectedName: string | null;
  title: string;
}) {
  const visibleData = data.slice(0, 8);

  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition-colors hover:border-white/15">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base text-white">{title}</CardTitle>
        <CardDescription className="leading-6">
          Click a bar to inspect matching records
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[380px] pt-3">
        {data.length === 0 ? (
          <ChartEmptyState label={emptyLabel} />
        ) : (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={visibleData}
              layout="vertical"
              margin={{ bottom: 24, left: 18, right: 28, top: 16 }}
            >
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis
                axisLine={false}
                stroke="#71717a"
                tickLine={false}
                tickMargin={10}
                type="number"
              />
              <YAxis
                dataKey="name"
                stroke="#a1a1aa"
                tickFormatter={(value: string) => truncateLabel(value, 22)}
                tickLine={false}
                tickMargin={10}
                type="category"
                width={152}
              />
              <Tooltip
                contentStyle={{
                  background: "#0b0d0f",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                }}
                cursor={{ fill: "rgba(52,211,153,0.08)" }}
                formatter={(value) => [formatInteger(Number(value ?? 0)), "Errors"]}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
              />
              <Bar
                activeBar={{ fill: "#6ee7b7" }}
                className="cursor-pointer"
                dataKey="value"
                onClick={(payload) => onBarClick(payload as BarClickPayload)}
                radius={[0, 6, 6, 0]}
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    fill={
                      selectedName === entry.name
                        ? "#6ee7b7"
                        : chartColors[index % chartColors.length]
                    }
                    key={entry.name}
                    opacity={selectedName && selectedName !== entry.name ? 0.52 : 1}
                  />
                ))}
              </Bar>
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
