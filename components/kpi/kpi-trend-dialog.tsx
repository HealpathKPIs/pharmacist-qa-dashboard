"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { formatMonthLabel, type MonthKey } from "@/lib/reconciliation";

// One agent's monthly KPI value against a team comparison line. Lower is
// better unless higherIsBetter is set. The agent line uses the first series
// colour; the comparison line stays neutral and dashed, so the two never rely
// on colour alone. Tokens: app/globals.css.
const AGENT_COLOR = "var(--chart-1)";
const TEAM_COLOR = "var(--chart-axis)";

export type KpiTrendPoint = {
  // null = no value that month (a gap in the line).
  agent: number | null;
  // Extra figures shown beside the agent's value in the table.
  agentDetail?: string | null;
  month: MonthKey;
  team: number | null;
};

type ChartPoint = KpiTrendPoint & { label: string };

export type KpiTrendDialogProps = {
  actorLabel: string;
  // Screen-reader description of the chart.
  chartLabel: string;
  // What the comparison line is, inside sentences: "team", "average".
  comparisonNoun: string;
  description: string;
  // Best/Worst month note when no month has a value.
  emptyMonthsLabel: string;
  footnote: string;
  formatAxis: (value: number) => string;
  // Size of a difference, without its sign.
  formatDifference: (value: number) => string;
  formatValue: (value: number) => string;
  // Best month = highest value instead of lowest.
  higherIsBetter?: boolean;
  onClose: () => void;
  period: { agent: number | null; team: number | null };
  pharmacist: string | null;
  points: KpiTrendPoint[];
  teamLabel: string;
  title: string;
};

function SummaryTile({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-tint/10 bg-inset px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-normal text-fg-muted">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold leading-tight text-fg-strong">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-fg-subtle">{sub}</p> : null}
    </div>
  );
}

function LegendKey({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <svg aria-hidden="true" height="8" width="22">
        <line
          stroke={color}
          strokeDasharray={dashed ? "4 3" : undefined}
          strokeLinecap="round"
          strokeWidth="2"
          x1="1"
          x2="21"
          y1="4"
          y2="4"
        />
      </svg>
      {label}
    </span>
  );
}

export function KpiTrendDialog({
  actorLabel,
  chartLabel,
  comparisonNoun,
  description,
  emptyMonthsLabel,
  footnote,
  formatAxis,
  formatDifference,
  formatValue,
  higherIsBetter = false,
  onClose,
  period,
  pharmacist,
  points,
  teamLabel,
  title,
}: KpiTrendDialogProps) {
  const format = (value: number | null) => (value === null ? "—" : formatValue(value));

  // States the gap only ("above" / "below"); the description says which is better.
  function describeGap(agent: number | null, team: number | null) {
    if (agent === null || team === null) {
      return "—";
    }

    const gap = agent - team;

    if (Math.abs(gap) < 0.005) {
      return `Same as ${comparisonNoun}`;
    }

    return `${gap > 0 ? "+" : "−"}${formatDifference(Math.abs(gap))} ${
      gap > 0 ? "above" : "below"
    } ${comparisonNoun}`;
  }

  function TrendTooltip({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: ChartPoint }[];
  }) {
    const point = payload?.[0]?.payload;

    if (!active || !point) {
      return null;
    }

    return (
      <div className="min-w-48 rounded-lg border border-tint/10 bg-panel px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-fg-strong">{formatMonthLabel(point.month)}</p>
        <dl className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-fg-muted">{pharmacist}</dt>
            <dd className="font-mono font-semibold text-fg-strong">{format(point.agent)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-fg-muted">{teamLabel}</dt>
            <dd className="font-mono text-foreground">{format(point.team)}</dd>
          </div>
        </dl>
        <p className="mt-2 border-t border-tint/10 pt-2 text-fg-subtle">
          {describeGap(point.agent, point.team)}
        </p>
      </div>
    );
  }

  const chartPoints: ChartPoint[] = points.map((point) => ({
    ...point,
    label: formatMonthLabel(point.month, "short"),
  }));
  const valued = points.filter((point) => point.agent !== null);
  const lowest = valued.reduce<KpiTrendPoint | null>(
    (found, point) => (found === null || point.agent! < found.agent! ? point : found),
    null,
  );
  const highest = valued.reduce<KpiTrendPoint | null>(
    (found, point) => (found === null || point.agent! > found.agent! ? point : found),
    null,
  );
  const best = higherIsBetter ? highest : lowest;
  const worst = higherIsBetter ? lowest : highest;
  const monthsAbove = valued.filter(
    (point) => point.team !== null && point.agent! - point.team > 0.005,
  ).length;
  const isAbove = period.agent !== null && period.team !== null && period.agent > period.team;
  const GapIcon = isAbove ? TrendingUp : TrendingDown;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={pharmacist !== null}>
      <DialogContent className="max-w-4xl">
        {pharmacist ? (
          <div className="-mx-6 -mb-6 max-h-[calc(86vh-3rem)] space-y-5 overflow-y-auto px-6 pb-6">
            <DialogHeader>
              <DialogTitle>
                {title}: {pharmacist}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile
                label="Selected period"
                sub={describeGap(period.agent, period.team)}
                value={format(period.agent)}
              />
              <SummaryTile label={teamLabel} sub="Same period" value={format(period.team)} />
              <SummaryTile
                label="Best month"
                sub={best ? formatMonthLabel(best.month) : emptyMonthsLabel}
                value={format(best?.agent ?? null)}
              />
              <SummaryTile
                label="Worst month"
                sub={worst ? formatMonthLabel(worst.month) : emptyMonthsLabel}
                value={format(worst?.agent ?? null)}
              />
            </div>

            <div className="rounded-lg border border-tint/10 bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <LegendKey color={AGENT_COLOR} label={pharmacist} />
                  <LegendKey color={TEAM_COLOR} dashed label={teamLabel} />
                </div>
                {valued.length > 0 ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                    <GapIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    Above the {comparisonNoun} in {monthsAbove} of {valued.length}{" "}
                    {valued.length === 1 ? "month" : "months"}
                  </p>
                ) : null}
              </div>
              <div aria-label={chartLabel} className="mt-3 h-72" role="img">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={chartPoints} margin={{ bottom: 4, left: 0, right: 16, top: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--chart-axis)"
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      stroke="var(--chart-axis)"
                      tickFormatter={formatAxis}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
                    />
                    <Line
                      activeDot={false}
                      dataKey="team"
                      dot={false}
                      isAnimationActive={false}
                      name={teamLabel}
                      stroke={TEAM_COLOR}
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Line
                      activeDot={{ r: 6, stroke: "var(--panel)", strokeWidth: 2 }}
                      dataKey="agent"
                      dot={{ fill: AGENT_COLOR, r: 4, stroke: "var(--panel)", strokeWidth: 2 }}
                      isAnimationActive={false}
                      name={pharmacist}
                      stroke={AGENT_COLOR}
                      strokeWidth={2}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-fg-subtle">{footnote}</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-tint/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>{actorLabel}</TableHead>
                    <TableHead>{teamLabel}</TableHead>
                    <TableHead>Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={point.month}>
                      <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                        {formatMonthLabel(point.month)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {format(point.agent)}
                        {point.agentDetail ? (
                          <span className="ml-2 text-xs text-fg-subtle">{point.agentDetail}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {format(point.team)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-fg-muted">
                        {describeGap(point.agent, point.team)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
