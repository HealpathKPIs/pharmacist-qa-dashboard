import {
  Activity,
  AlertTriangle,
  CircleGauge,
  ClipboardList,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DailyTrendPoint,
  DashboardTotals,
  ErrorsByIssue,
  ErrorsByPharmacist,
} from "@/lib/dashboard-queries";
import {
  getAuditModule,
  type AuditType,
} from "@/lib/audit-types";
import { PlatformShell } from "@/components/layout/platform-shell";
import { cn } from "@/lib/utils";

type KpiCardConfig = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getChartMax(values: number[]) {
  return Math.max(1, ...values);
}

export function DashboardShell({
  auditType = "clinical",
  children,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
}) {
  return <PlatformShell auditType={auditType}>{children}</PlatformShell>;
}

export function DashboardHeader({
  auditType = "clinical",
  children,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
}) {
  const moduleConfig = getAuditModule(auditType);

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0d0f]/95 backdrop-blur">
      <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-emerald-300">QA Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">
              {moduleConfig.dashboardTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Monitor {moduleConfig.workloadLabelLower}, QA errors, {moduleConfig.actorLabel.toLowerCase()} performance, and issue mix.
            </p>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

export function KpiCards({ totals }: { totals: DashboardTotals }) {
  const cards: KpiCardConfig[] = [
    {
      label: "Total Patients",
      value: formatInteger(totals.totalPatients),
      detail: "Daily patient count",
      icon: Users,
    },
    {
      label: "Total QA Errors",
      value: formatInteger(totals.totalQaErrors),
      detail: "Validated QA records",
      icon: ClipboardList,
    },
    {
      label: "Error Rate",
      value: formatPercent(totals.errorRate),
      detail: "Errors per 100 patients",
      icon: CircleGauge,
    },
    {
      label: "Total Pharmacists",
      value: formatInteger(totals.totalPharmacists),
      detail: "Active in QA rows",
      icon: Activity,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none transition-transform duration-200 hover:-translate-y-0.5"
            key={card.label}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                    {card.label}
                  </p>
                  <p className="mt-3 font-mono text-3xl font-semibold text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">{card.detail}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

export function DailyTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = 24;
  const maxRate = getChartMax(data.map((point) => point.errorRate));
  const points = data.map((point, index) => {
    const x =
      data.length === 1
        ? chartWidth / 2
        : padding + (index / (data.length - 1)) * (chartWidth - padding * 2);
    const y =
      chartHeight -
      padding -
      (point.errorRate / maxRate) * (chartHeight - padding * 2);

    return { ...point, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-base text-white">Daily Trend</CardTitle>
        <CardDescription>Error rate over time</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState label="No daily trend data for the selected filters." />
        ) : (
          <div className="overflow-x-auto">
            <svg
              aria-label="Daily trend chart"
              className="min-w-[640px]"
              role="img"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              <line
                stroke="rgba(255,255,255,0.10)"
                x1={padding}
                x2={chartWidth - padding}
                y1={chartHeight - padding}
                y2={chartHeight - padding}
              />
              <path
                d={path}
                fill="none"
                stroke="#34d399"
                strokeLinecap="round"
                strokeWidth="3"
              />
              {points.map((point) => (
                <g key={point.day}>
                  <circle cx={point.x} cy={point.y} fill="#34d399" r="4" />
                  <text
                    fill="#a1a1aa"
                    fontSize="11"
                    textAnchor="middle"
                    x={point.x}
                    y={chartHeight - 4}
                  >
                    {formatDay(point.day)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HorizontalBarChart({
  data,
  emptyLabel,
  labelKey,
  title,
}: {
  data: Array<{ label: string; value: number }>;
  emptyLabel: string;
  labelKey: string;
  title: string;
}) {
  const maxValue = getChartMax(data.map((item) => item.value));

  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
        <CardDescription>{labelKey}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState label={emptyLabel} />
        ) : (
          <div className="space-y-4">
            {data.slice(0, 8).map((item) => (
              <div className="space-y-2" key={item.label}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate text-zinc-300">{item.label}</span>
                  <span className="font-mono text-zinc-500">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-emerald-300 transition-[width] duration-500"
                    style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopPharmacistsTable({
  rows,
  totalErrors,
}: {
  rows: ErrorsByPharmacist[];
  totalErrors: number;
}) {
  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-white">Top Pharmacists</CardTitle>
        <CardDescription>Share of filtered QA errors</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <ChartEmptyState label="No pharmacist rows for the selected filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pharmacist</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 8).map((row) => (
                <TableRow key={row.pharmacistName}>
                  <TableCell className="font-medium text-zinc-200">
                    {row.pharmacistName}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-400">
                    {row.errorCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-400">
                    {formatPercent(
                      totalErrors === 0 ? 0 : (row.errorCount / totalErrors) * 100,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function TopIssuesTable({ rows }: { rows: ErrorsByIssue[] }) {
  return (
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-white">Top Issues</CardTitle>
        <CardDescription>Most frequent issue labels</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <ChartEmptyState label="No issue rows for the selected filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 8).map((row) => (
                <TableRow key={row.issueType}>
                  <TableCell className="font-medium text-zinc-200">
                    {row.issueType}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-400">
                    {row.errorCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardEmptyState() {
  return (
    <Card className="border-dashed border-white/10 bg-white/[0.03] shadow-none">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <TrendingUp aria-hidden="true" className="h-8 w-8 text-zinc-500" />
        <h2 className="mt-4 text-lg font-semibold text-white">No dashboard data yet</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
          No records match the current module and filters. An administrator can
          import data when a new reporting period is available.
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardErrorState({ message }: { message: string }) {
  return (
    <Alert className="border-red-300/25 bg-red-300/10 text-red-100">
      <AlertTriangle aria-hidden="true" className="h-4 w-4 text-red-300" />
      <AlertDescription>
        Dashboard data could not be loaded. {message}
      </AlertDescription>
    </Alert>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "flex min-h-48 items-center justify-center rounded-md border border-dashed border-white/10 px-4 text-center text-sm text-zinc-500",
      )}
    >
      {label}
    </div>
  );
}
