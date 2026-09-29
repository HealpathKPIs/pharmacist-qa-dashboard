"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Download,
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
import { Button } from "@/components/ui/button";
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
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import {
  SEVERITY_LEVEL_SCORES,
  SEVERITY_LEVELS,
  scoreNonMedicalQaError,
  type SeverityLevel,
} from "@/lib/non-medical-scoring";
import { calculateQualityDeduction } from "@/lib/quality-deduction";
import { cn } from "@/lib/utils";

// Chart colours are theme tokens (app/globals.css), so charts follow Light/Dark.
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const chartTooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "8px",
  color: "var(--chart-tooltip-text)",
};

type DashboardQaErrorRow = QaErrorDetail & {
  // Non-Medical only: the severity derived from the row's Category and Issue
  // type (lib/non-medical-scoring.ts); null when no scoring criterion matches.
  derivedSeverity?: { level: SeverityLevel; score: number } | null;
};

type DialogState =
  | {
      description: string;
      patientRows: DailyPatientDetail[];
      title: string;
      type: "patients";
    }
  | {
      description: string;
      errorRows: DashboardQaErrorRow[];
      title: string;
      type: "errors";
    }
  | null;

type DashboardInteractiveProps = {
  auditType: AuditType;
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
  label: string;
  name: string;
  severityScoreRate: number;
  tone: "good" | "bad" | "neutral";
  totalPatients: number;
  totalQaErrors: number;
  totalSeverityScore: number;
  trendDelta?: number;
};

type PharmacistQualitySummary = {
  decline: number;
  improvement: number;
  name: string;
  severityScoreRate: number;
  totalPatients: number;
  totalQaErrors: number;
  totalSeverityScore: number;
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

function formatRate(value: number) {
  return value.toFixed(2);
}

function formatSignedRate(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}`;
}

function formatPoints(value: number) {
  return `${value.toFixed(2)} pts`;
}

function formatSignedPointsValue(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)} pts`;
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

// Non-Medical severity is derived when the data is analyzed; the stored score
// column (the Need Edit flag) is not a severity.
function withDerivedSeverity(rows: QaErrorDetail[]): DashboardQaErrorRow[] {
  return rows.map((row) => {
    const result = scoreNonMedicalQaError(row);

    return {
      ...row,
      derivedSeverity:
        result.status === "scored"
          ? { level: result.severityLevel, score: result.score }
          : null,
    };
  });
}

// Severity points of a QA error row: the derived score on Non-Medical rows,
// the stored score elsewhere. null: no scoring criterion, so no score.
function getSeverityPoints(row: DashboardQaErrorRow) {
  return row.derivedSeverity === undefined
    ? row.score
    : (row.derivedSeverity?.score ?? null);
}

function formatSeverityPoints(row: DashboardQaErrorRow) {
  return String(getSeverityPoints(row) ?? "—");
}

function getTotalSeverityScore(rows: DashboardQaErrorRow[]) {
  // Rows without a scoring criterion add nothing.
  return rows.reduce((sum, row) => sum + (getSeverityPoints(row) ?? 0), 0);
}

const NO_CRITERION_LABEL = "No criterion";

function getSeverityLevelLabel(level: SeverityLevel) {
  return `${level} (${SEVERITY_LEVEL_SCORES[level]})`;
}

// Non-Medical Severity Distribution: QA errors per derived severity level.
// Rows without a criterion are their own slice, never a score.
function getDerivedSeverityChartData(rows: DashboardQaErrorRow[]): ChartDatum[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = row.derivedSeverity
      ? getSeverityLevelLabel(row.derivedSeverity.level)
      : NO_CRITERION_LABEL;

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...SEVERITY_LEVELS.map(getSeverityLevelLabel), NO_CRITERION_LABEL]
    .filter((label) => counts.has(label))
    .map((label) => ({ name: label, value: counts.get(label) ?? 0 }));
}

function getSeverityScoreRate(totalSeverityScore: number, totalPatients: number) {
  if (totalPatients === 0) {
    return 0;
  }

  return totalSeverityScore / totalPatients;
}

function getQaDeduction(totalSeverityScore: number, totalQaErrors: number) {
  if (totalQaErrors === 0) {
    return 0;
  }

  return totalSeverityScore / totalQaErrors;
}

function getPatientCountsByDay(rows: DailyPatientDetail[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.day] = (counts[row.day] ?? 0) + row.patientCount;

    return counts;
  }, {});
}

function getBoundaryDays(rows: DailyPatientDetail[]) {
  const days = Array.from(
    new Set(rows.filter((row) => row.patientCount > 0).map((row) => row.day)),
  ).sort();

  return {
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
  };
}

function buildPharmacistQualitySummaries({
  dailyPatientRows,
  qaRows,
  totalPatients,
}: {
  dailyPatientRows: DailyPatientDetail[];
  qaRows: DashboardQaErrorRow[];
  totalPatients: number;
}): PharmacistQualitySummary[] {
  const patientCountsByDay = getPatientCountsByDay(dailyPatientRows);
  const { firstDay, lastDay } = getBoundaryDays(dailyPatientRows);
  const firstDayPatients = firstDay ? patientCountsByDay[firstDay] ?? 0 : 0;
  const lastDayPatients = lastDay ? patientCountsByDay[lastDay] ?? 0 : 0;
  const rowsByPharmacist = qaRows.reduce<Record<string, DashboardQaErrorRow[]>>(
    (groups, row) => {
      groups[row.pharmacistName] = groups[row.pharmacistName] ?? [];
      groups[row.pharmacistName].push(row);

      return groups;
    },
    {},
  );

  return Object.entries(rowsByPharmacist)
    .map(([name, rows]) => {
      const totalSeverityScore = getTotalSeverityScore(rows);
      const firstDaySeverityScore = firstDay
        ? getTotalSeverityScore(rows.filter((row) => row.day === firstDay))
        : 0;
      const lastDaySeverityScore = lastDay
        ? getTotalSeverityScore(rows.filter((row) => row.day === lastDay))
        : 0;
      const firstDayRate = getSeverityScoreRate(firstDaySeverityScore, firstDayPatients);
      const lastDayRate = getSeverityScoreRate(lastDaySeverityScore, lastDayPatients);

      return {
        decline: lastDayRate - firstDayRate,
        improvement: firstDayRate - lastDayRate,
        name,
        severityScoreRate: getSeverityScoreRate(totalSeverityScore, totalPatients),
        totalPatients,
        totalQaErrors: rows.length,
        totalSeverityScore,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function toEmptyInsight(label: string): Insight {
  return {
    label,
    name: "No data",
    severityScoreRate: 0,
    tone: "neutral",
    totalPatients: 0,
    totalQaErrors: 0,
    totalSeverityScore: 0,
  };
}

function toInsight(
  label: string,
  row: PharmacistQualitySummary | undefined,
  tone: Insight["tone"],
  trendDelta?: number,
): Insight {
  if (!row) {
    return toEmptyInsight(label);
  }

  return {
    label,
    name: row.name,
    severityScoreRate: row.severityScoreRate,
    tone,
    totalPatients: row.totalPatients,
    totalQaErrors: row.totalQaErrors,
    totalSeverityScore: row.totalSeverityScore,
    trendDelta,
  };
}

function buildExecutiveInsights(
  rows: PharmacistQualitySummary[],
  bestLabel = "Best Performer",
): Insight[] {
  const rankedByRate = [...rows].sort(
    (left, right) =>
      left.severityScoreRate - right.severityScoreRate ||
      left.totalSeverityScore - right.totalSeverityScore ||
      left.name.localeCompare(right.name),
  );
  const rankedByImprovement = [...rows]
    .filter((row) => row.improvement > 0)
    .sort(
      (left, right) =>
        right.improvement - left.improvement ||
        left.severityScoreRate - right.severityScoreRate ||
        left.name.localeCompare(right.name),
    );
  const rankedByDecline = [...rows]
    .filter((row) => row.decline > 0)
    .sort(
      (left, right) =>
        right.decline - left.decline ||
        right.severityScoreRate - left.severityScoreRate ||
        left.name.localeCompare(right.name),
    );

  return [
    toInsight(bestLabel, rankedByRate[0], rankedByRate[0] ? "good" : "neutral"),
    toInsight(
      "Needs Attention",
      rankedByRate[rankedByRate.length - 1],
      rankedByRate.length > 0 ? "bad" : "neutral",
    ),
    toInsight(
      "Biggest Improvement",
      rankedByImprovement[0],
      rankedByImprovement[0] ? "good" : "neutral",
      rankedByImprovement[0]?.improvement,
    ),
    toInsight(
      "Biggest Decline",
      rankedByDecline[0],
      rankedByDecline[0] ? "bad" : "neutral",
      rankedByDecline[0]?.decline,
    ),
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
  // null: the metric has no value ("—"), so there is no difference either.
  current: number | null;
  differenceFormatter?: (value: number) => string;
  previous: number | null;
  valueFormatter?: (value: number) => string;
}) {
  const comparison =
    current === null || previous === null
      ? null
      : {
          difference: current - previous,
          percentDifference: calculatePercentDifference(current, previous),
        };
  const direction = !comparison
    ? null
    : comparison.difference > 0
      ? "up"
      : comparison.difference < 0
        ? "down"
        : "flat";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-3 text-fg-subtle">
        <span>Previous</span>
        <span className="font-mono text-fg-tertiary">
          {previous === null ? "—" : valueFormatter(previous)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-fg-subtle">Difference</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono",
            direction === "up" &&
              "border-brand/25 bg-brand/10 text-brand-strong",
            direction === "down" && "border-danger/25 bg-danger/10 text-danger-strong",
            (direction === "flat" || direction === null) &&
              "border-tint/10 bg-tint/[0.04] text-fg-muted",
          )}
        >
          {direction === "up" ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : null}
          {direction === "down" ? (
            <ArrowDown aria-hidden="true" className="h-3 w-3" />
          ) : null}
          {direction === "flat" ? <Minus aria-hidden="true" className="h-3 w-3" /> : null}
          {comparison ? (
            <>
              {differenceFormatter(comparison.difference)}
              <span className="dark:text-current/70">
                ({formatSignedPercent(comparison.percentDifference)})
              </span>
            </>
          ) : (
            "—"
          )}
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
      className="group animate-soft-in h-full rounded-xl text-left outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand"
      onClick={onClick}
      type="button"
    >
      <Card className="h-full min-h-[226px] border-tint/10 bg-surface dark:bg-white/[0.05] shadow-(--shadow-card) transition-all duration-300 group-hover:border-brand/35 dark:group-hover:bg-white/[0.075] group-hover:shadow-(--shadow-glow)">
        <CardContent className="flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
                {label}
              </p>
              <p className="mt-4 truncate font-mono text-3xl font-semibold leading-none text-fg-strong">
                {value}
              </p>
              <p className="mt-3 text-sm leading-5 text-fg-muted">{detail}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand transition-colors group-hover:border-brand/45">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-5 border-t border-tint/10 pt-4">
            {previousLabel ? (
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-fg-subtle">
                <span>Previous issue</span>
                <span className="truncate text-right font-mono text-fg-tertiary">
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
  previous: number | null;
  trendDifferenceFormatter?: (value: number) => string;
  trendValueFormatter?: (value: number) => string;
  // null is shown as "—" (for example QA Deduction without QA errors).
  value: number | null;
}) {
  const formatter = trendValueFormatter ?? ((metric: number) => formatInteger(Math.round(metric)));

  return (
    <Card className="animate-soft-in h-full min-h-[184px] border-tint/10 bg-transparent bg-gradient-to-br from-surface-from to-surface-to shadow-(--shadow-card-lg) transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-(--shadow-glow-lg)">
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
              {label}
            </p>
            <p className="mt-4 truncate font-mono text-3xl font-semibold leading-none text-fg-strong">
              {value === null ? "—" : <AnimatedMetric formatter={formatter} value={value} />}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-sm leading-5 text-fg-muted">{detail}</p>
          <div className="border-t border-tint/10 pt-3">
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

function InsightCard({
  insight,
  workloadLabel = "Patients",
}: {
  insight: Insight;
  workloadLabel?: string;
}) {
  const isImprovement = insight.tone === "good";
  const isDecline = insight.tone === "bad";
  const ArrowIcon = isImprovement ? ArrowDown : isDecline ? ArrowUp : Minus;

  return (
    <Card className="animate-soft-in h-full min-h-[178px] border-tint/10 bg-surface dark:bg-white/[0.045] shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 dark:hover:bg-white/[0.065]">
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
              {insight.label}
            </p>
            <p className="mt-3 truncate text-lg font-semibold text-fg-strong">{insight.name}</p>
          </div>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              isImprovement && "border-brand/25 bg-brand/10 text-brand",
              isDecline && "border-danger/25 bg-danger/10 text-danger",
              !isImprovement && !isDecline && "border-tint/10 bg-tint/[0.04] text-fg-muted",
            )}
          >
            <ArrowIcon aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-tint/10 pt-4 text-xs">
          <div>
            <p className="text-fg-subtle">Severity rate</p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {formatRate(insight.severityScoreRate)}
            </p>
          </div>
          <div>
            <p className="text-fg-subtle">Severity score</p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {formatInteger(insight.totalSeverityScore)}
            </p>
          </div>
          <div>
            <p className="text-fg-subtle">QA errors</p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {formatInteger(insight.totalQaErrors)}
            </p>
          </div>
          <div>
            <p className="text-fg-subtle">{workloadLabel}</p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {formatInteger(insight.totalPatients)}
            </p>
          </div>
        </div>
        {typeof insight.trendDelta === "number" ? (
          <p
            className={cn(
              "mt-3 rounded-lg border px-3 py-2 text-xs font-medium",
              isImprovement && "border-brand/20 bg-brand/10 text-brand-strong",
              isDecline && "border-danger/20 bg-danger/10 text-danger-strong",
              !isImprovement && !isDecline && "border-tint/10 bg-tint/[0.04] text-fg-muted",
            )}
          >
            {isImprovement ? "Improvement" : isDecline ? "Decline" : "Change"}{" "}
            {formatSignedRate(insight.trendDelta)}
          </p>
        ) : null}
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
          <p className="text-xs font-semibold uppercase tracking-normal text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-fg-strong">{title}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">{subtitle}</p>
    </div>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center text-sm leading-6 text-fg-subtle">
      {label}
    </div>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-tint/10 bg-inset p-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-fg-strong">
        {formatInteger(value)}
      </p>
    </div>
  );
}

function RecentActivityCard({ recentUpload }: { recentUpload: RecentUpload | null }) {
  return (
    <Card className="animate-soft-in h-full border-tint/10 bg-surface dark:bg-white/[0.045] shadow-(--shadow-card)">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-info/20 bg-info/10 text-info">
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base text-fg-strong">Recent Activity</CardTitle>
            <CardDescription>Latest import batch</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentUpload ? (
          <div className="space-y-4">
            <div>
              <p className="truncate text-sm font-medium text-fg-strong">{recentUpload.fileName}</p>
              <p className="mt-1 text-xs text-fg-subtle">
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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-tint/10 bg-inset px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-fg-tertiary">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            healthy
              ? "bg-brand shadow-(--shadow-status-dot)"
              : "bg-danger",
          )}
        />
        {label}
      </span>
      <span className={cn("text-xs", healthy ? "text-brand-strong" : "text-danger-strong")}>
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
    <Card className="animate-soft-in h-full border-tint/10 bg-surface dark:bg-white/[0.045] shadow-(--shadow-card)">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base text-fg-strong">System Status</CardTitle>
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

function PatientRowsTable({
  rows,
  workloadLabel = "Patients",
}: {
  rows: DailyPatientDetail[];
  workloadLabel?: string;
}) {
  if (rows.length === 0) {
    return <ChartEmptyState label={`No daily ${workloadLabel.toLowerCase()} rows match this selection.`} />;
  }

  return (
    <div className="max-h-[58vh] overflow-auto rounded-md border border-tint/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead className="text-right">{workloadLabel}</TableHead>
            <TableHead>Source file</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-fg-secondary">
                {formatDay(row.day)}
              </TableCell>
              <TableCell className="text-right font-mono text-fg-tertiary">
                {formatInteger(row.patientCount)}
              </TableCell>
              <TableCell className="text-fg-muted">{row.sourceFile ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function QaErrorRowsTable({
  actorLabel = "Pharmacist",
  idLabel = "Patient ID",
  rows,
}: {
  actorLabel?: string;
  idLabel?: string;
  rows: DashboardQaErrorRow[];
}) {
  if (rows.length === 0) {
    return <ChartEmptyState label="No QA error records match this selection." />;
  }

  return (
    <div className="max-h-[58vh] overflow-auto rounded-md border border-tint/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>{actorLabel}</TableHead>
            <TableHead>{idLabel}</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-fg-tertiary">
                {formatDay(row.day)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                {row.pharmacistName}
              </TableCell>
              <TableCell className="font-mono text-fg-muted">{row.patientId}</TableCell>
              <TableCell className="min-w-64 text-fg-tertiary">{row.issueType}</TableCell>
              <TableCell
                className="text-right font-mono text-fg-muted"
                title={row.derivedSeverity === null ? "No scoring criterion" : row.derivedSeverity?.level}
              >
                {formatSeverityPoints(row)}
              </TableCell>
              <TableCell className="min-w-80 text-fg-muted">
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
  auditType,
  dailyPatientDetails,
  dailyTrend,
  databaseHealthy,
  errorsByIssue,
  errorsByPharmacist,
  previousQaErrorDetails: storedPreviousQaErrorDetails,
  previousTotals,
  qaErrorDetails: storedQaErrorDetails,
  recentUpload,
  severityDistribution,
  totals,
}: DashboardInteractiveProps) {
  const moduleConfig = getAuditModule(auditType);
  const dailyTrendShowsErrorCount = auditType !== "clinical";
  const derivesSeverity = auditType === "non_medical";
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [selectedBar, setSelectedBar] = useState<SelectedBar>(null);
  // The rows are already filtered by the dashboard filters, so every severity
  // figure below is recalculated from the filtered QA errors.
  const qaErrorDetails = useMemo<DashboardQaErrorRow[]>(
    () => (derivesSeverity ? withDerivedSeverity(storedQaErrorDetails) : storedQaErrorDetails),
    [derivesSeverity, storedQaErrorDetails],
  );
  const previousQaErrorDetails = useMemo<DashboardQaErrorRow[]>(
    () =>
      derivesSeverity
        ? withDerivedSeverity(storedPreviousQaErrorDetails)
        : storedPreviousQaErrorDetails,
    [derivesSeverity, storedPreviousQaErrorDetails],
  );
  const unscoredQaErrors = useMemo(
    () => qaErrorDetails.filter((row) => row.derivedSeverity === null).length,
    [qaErrorDetails],
  );
  const totalSeverityScore = useMemo(() => getTotalSeverityScore(qaErrorDetails), [qaErrorDetails]);
  const previousTotalSeverityScore = useMemo(
    () => getTotalSeverityScore(previousQaErrorDetails),
    [previousQaErrorDetails],
  );
  const severityScoreRate = getSeverityScoreRate(totalSeverityScore, totals.totalPatients);
  const previousSeverityScoreRate = getSeverityScoreRate(
    previousTotalSeverityScore,
    previousTotals.totalPatients,
  );
  const qaDeduction = getQaDeduction(totalSeverityScore, totals.totalQaErrors);
  const previousQaDeduction = getQaDeduction(
    previousTotalSeverityScore,
    previousTotals.totalQaErrors,
  );
  // Non-Medical: SUM(score) ÷ COUNT(QA errors), "—" when there are no QA errors.
  const executiveQaDeduction = derivesSeverity
    ? {
        current: calculateQualityDeduction(totalSeverityScore, totals.totalQaErrors).score,
        previous: calculateQualityDeduction(
          previousTotalSeverityScore,
          previousTotals.totalQaErrors,
        ).score,
      }
    : { current: qaDeduction, previous: previousQaDeduction };
  const pharmacistQualitySummaries = useMemo(
    () =>
      buildPharmacistQualitySummaries({
        dailyPatientRows: dailyPatientDetails,
        qaRows: qaErrorDetails,
        totalPatients: totals.totalPatients,
      }),
    [dailyPatientDetails, qaErrorDetails, totals.totalPatients],
  );
  const executiveInsights = useMemo(
    () =>
      buildExecutiveInsights(
        pharmacistQualitySummaries,
        auditType === "non_medical" ? "Best Agent" : "Best Performer",
      ),
    [auditType, pharmacistQualitySummaries],
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
      derivesSeverity
        ? getDerivedSeverityChartData(qaErrorDetails)
        : severityDistribution.map((row) => ({
            name: `Score ${row.score}`,
            value: row.errorCount,
          })),
    [derivesSeverity, qaErrorDetails, severityDistribution],
  );

  function openErrorsDialog(title: string, description: string, rows: DashboardQaErrorRow[]) {
    setDialogState({
      description,
      errorRows: rows,
      title,
      type: "errors",
    });
  }

  function openPatientDialog() {
    setDialogState({
      description: `Daily ${moduleConfig.workloadLabelLower} rows for the selected dashboard filters.`,
      patientRows: dailyPatientDetails,
      title: `Daily ${moduleConfig.workloadLabel}`,
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

  function exportReport() {
    const headers = [
      "Date",
      moduleConfig.actorLabel,
      auditType === "doctors" ? "Consultation ID" : "Patient ID",
      "Issue",
      "Score",
      "Details",
    ];
    const csvRows = qaErrorDetails.map((row) =>
      [
        row.day,
        row.pharmacistName,
        row.patientId,
        row.issueType,
        getSeverityPoints(row) ?? "",
        row.issueDetails ?? "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${auditType.replaceAll("_", "-")}-qa-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="space-y-5">
        <div className="flex justify-end">
          <Button onClick={exportReport} type="button" variant="outline">
            <Download aria-hidden="true" className="h-4 w-4" />
            Export Report
          </Button>
        </div>
        <SectionHeading
          eyebrow="Executive Dashboard"
          subtitle={`Quality scoring uses severity score per ${auditType === "clinical" ? "patient" : "case"}, with ${moduleConfig.actorLabel.toLowerCase()} ranking based on severity score rate.`}
          title="Executive Summary"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {auditType !== "clinical" ? (
            <ExecutiveMetricCard
              detail={`${moduleConfig.actorLabelPlural} represented in QA error records`}
              icon={Users}
              label={`Total ${moduleConfig.actorLabelPlural}`}
              previous={previousTotals.totalPharmacists}
              value={totals.totalPharmacists}
            />
          ) : (
            <>
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
            </>
          )}
          {auditType !== "clinical" ? (
            <>
              <ExecutiveMetricCard
                detail="Cases reviewed in the selected date range"
                icon={ClipboardList}
                label="Cases Reviewed"
                previous={previousTotals.totalPatients}
                value={totals.totalPatients}
              />
              <ExecutiveMetricCard
                detail={`Validated ${moduleConfig.moduleLabel} errors`}
                icon={CircleGauge}
                label={derivesSeverity ? "Total QA Errors" : "QA Errors"}
                previous={previousTotals.totalQaErrors}
                value={totals.totalQaErrors}
              />
            </>
          ) : null}
          <ExecutiveMetricCard
            detail={
              !derivesSeverity
                ? "Sum of QA severity scores"
                : unscoredQaErrors > 0
                  ? `Sum of derived severity scores; ${formatInteger(unscoredQaErrors)} QA ${unscoredQaErrors === 1 ? "error has" : "errors have"} no scoring criterion`
                  : "Sum of derived severity scores"
            }
            icon={Activity}
            label="Total Severity Score"
            previous={previousTotalSeverityScore}
            value={totalSeverityScore}
          />
          {auditType === "clinical" || derivesSeverity ? (
            <ExecutiveMetricCard
              detail={`Total severity score per ${derivesSeverity ? "case reviewed" : "patient"}`}
              icon={Activity}
              label="Severity Score Rate"
              previous={previousSeverityScoreRate}
              trendDifferenceFormatter={formatSignedRate}
              trendValueFormatter={formatRate}
              value={severityScoreRate}
            />
          ) : null}
          <ExecutiveMetricCard
            detail="Average severity points per QA error"
            icon={ClipboardList}
            label="QA Deduction (pts)"
            previous={executiveQaDeduction.previous}
            trendDifferenceFormatter={formatSignedPointsValue}
            trendValueFormatter={formatPoints}
            value={executiveQaDeduction.current}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {executiveInsights.map((insight) => (
            <InsightCard insight={insight} key={insight.label} workloadLabel={moduleConfig.workloadLabel} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <RecentActivityCard recentUpload={recentUpload} />
          <SystemStatusCard databaseHealthy={databaseHealthy} recentUpload={recentUpload} />
        </div>
      </section>

      {auditType === "clinical" ? (
      <section className="space-y-4">
        <SectionHeading
          subtitle="Click any card to inspect the records behind the metric."
          title="Operational KPIs"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
        <KpiCard
          detail="Average severity points per QA error"
          icon={ClipboardList}
          label="QA Deduction (pts)"
          onClick={() =>
            openErrorsDialog(
              "QA Deduction Records",
              "Filtered QA error records used in the current QA deduction calculation.",
              qaErrorDetails,
            )
          }
          trendCurrent={qaDeduction}
          trendDifferenceFormatter={formatSignedPointsValue}
          trendPrevious={previousQaDeduction}
          trendValueFormatter={formatPoints}
          value={<AnimatedMetric formatter={formatPoints} value={qaDeduction} />}
        />
        </div>
      </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          subtitle={`Trend, severity, ${moduleConfig.actorLabel.toLowerCase()}, and issue distributions update with every filter change.`}
          title="Performance Trends"
        />
        <div className="grid gap-4 xl:grid-cols-3">
        <Card className="animate-soft-in border-tint/10 bg-surface shadow-none xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-fg-strong">Daily Trend</CardTitle>
            <CardDescription>
              {dailyTrendShowsErrorCount ? "Total errors per day" : "Error rate over time"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {dailyTrend.length === 0 ? (
              <ChartEmptyState label="No daily trend data for the selected filters." />
            ) : (
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={dailyTrend} margin={{ bottom: 8, left: 0, right: 12, top: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    minTickGap={24}
                    stroke="var(--chart-axis)"
                    tickFormatter={(value: string) => formatDay(value).slice(0, 6)}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={!dailyTrendShowsErrorCount}
                    stroke="var(--chart-axis)"
                    tickFormatter={(value: number) =>
                      dailyTrendShowsErrorCount ? formatInteger(value) : `${value}%`
                    }
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);

                      return [
                        dailyTrendShowsErrorCount
                          ? formatInteger(numericValue)
                          : formatPercent(numericValue),
                        dailyTrendShowsErrorCount ? "Total Errors" : String(name),
                      ];
                    }}
                    labelFormatter={(value) =>
                      dailyTrendShowsErrorCount
                        ? `Date: ${formatDay(String(value))}`
                        : formatDay(String(value))
                    }
                  />
                  <Line
                    dataKey={dailyTrendShowsErrorCount ? "errorCount" : "errorRate"}
                    dot={{ fill: "var(--chart-1)", r: 3 }}
                    name={dailyTrendShowsErrorCount ? "Total Errors" : "Error rate"}
                    stroke="var(--chart-1)"
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
          emptyLabel={`No ${moduleConfig.actorLabel.toLowerCase()} chart data for the selected filters.`}
          onBarClick={(payload) => handleBarClick(payload, "pharmacist")}
          selectedName={selectedBar?.type === "pharmacist" ? selectedBar.name : null}
          title={`Errors by ${moduleConfig.actorLabel}`}
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
          emptyLabel={`No ${moduleConfig.actorLabel.toLowerCase()} distribution for the selected filters.`}
          onSliceClick={(name) =>
            openErrorsDialog(
              `Errors by ${name}`,
              `All QA error records for this ${moduleConfig.actorLabel.toLowerCase()}.`,
              qaErrorDetails.filter((row) => row.pharmacistName === name),
            )
          }
          title={`QA Errors by ${moduleConfig.actorLabel}`}
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
        <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-fg-strong">Top Records</CardTitle>
            <CardDescription>Quick scan of current filter results</CardDescription>
          </CardHeader>
          <CardContent>
            {qaErrorDetails.length === 0 ? (
              <ChartEmptyState label="No QA records to preview." />
            ) : (
              <div className="space-y-3">
                {qaErrorDetails.slice(0, 5).map((row) => (
                  <button
                    className="flex w-full items-start gap-3 rounded-md border border-tint/10 bg-inset p-3 text-left transition-colors hover:border-brand/25 hover:bg-tint/[0.04]"
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
                    <Search aria-hidden="true" className="mt-0.5 h-4 w-4 text-brand" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg-strong">
                        {row.issueType}
                      </span>
                      <span className="mt-1 block text-xs text-fg-subtle">
                        {formatDay(row.day)} · {row.pharmacistName} · Score {formatSeverityPoints(row)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <DetailDialog
        actorLabel={moduleConfig.actorLabel}
        dialogState={dialogState}
        idLabel={auditType === "non_medical" ? "Case ID" : "Patient ID"}
        onOpenChange={(open) => !open && setDialogState(null)}
        workloadLabel={moduleConfig.workloadLabel}
      />
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
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-(--shadow-card-sm) transition-colors hover:border-tint/15">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base text-fg-strong">{title}</CardTitle>
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
              <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
              <XAxis
                axisLine={false}
                stroke="var(--chart-axis)"
                tickLine={false}
                tickMargin={10}
                type="number"
              />
              <YAxis
                dataKey="name"
                stroke="var(--chart-label)"
                tickFormatter={(value: string) => truncateLabel(value, 22)}
                tickLine={false}
                tickMargin={10}
                type="category"
                width={152}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                cursor={{ fill: "var(--chart-cursor)" }}
                formatter={(value) => [formatInteger(Number(value ?? 0)), "Errors"]}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
              />
              <Bar
                activeBar={{ fill: "var(--chart-active)" }}
                className="cursor-pointer"
                dataKey="value"
                onClick={(payload) => onBarClick(payload as BarClickPayload)}
                radius={[0, 6, 6, 0]}
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    fill={
                      selectedName === entry.name
                        ? "var(--chart-active)"
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
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-fg-strong">{title}</CardTitle>
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
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [formatInteger(Number(value ?? 0)), "Records"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {data.slice(0, 6).map((item, index) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.name}>
                  <span className="flex min-w-0 items-center gap-2 text-fg-tertiary">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-mono text-fg-subtle">
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
  actorLabel,
  dialogState,
  idLabel,
  onOpenChange,
  workloadLabel,
}: {
  actorLabel: string;
  dialogState: DialogState;
  idLabel: string;
  onOpenChange: (open: boolean) => void;
  workloadLabel: string;
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
              <PatientRowsTable rows={dialogState.patientRows} workloadLabel={workloadLabel} />
            ) : (
              <QaErrorRowsTable actorLabel={actorLabel} idLabel={idLabel} rows={dialogState.errorRows} />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
