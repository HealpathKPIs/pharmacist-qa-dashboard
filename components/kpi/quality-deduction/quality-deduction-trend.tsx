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
import type { QualityDeductionFigures } from "@/lib/quality-deduction";
import type { QualityDeductionData } from "@/lib/quality-deduction-queries";
import { formatMonthLabel, type MonthKey } from "@/lib/reconciliation";

// Agent line uses the first series colour; the team line stays neutral and
// dashed, so the two never rely on colour alone. Tokens: app/globals.css.
const AGENT_COLOR = "var(--chart-1)";
const TEAM_COLOR = "var(--chart-axis)";

type TrendPoint = {
  agent: number | null;
  agentFigures: QualityDeductionFigures;
  label: string;
  month: MonthKey;
  team: number | null;
  teamFigures: QualityDeductionFigures;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(score: number | null) {
  return score === null ? "—" : `${score.toFixed(2)} pts`;
}

// Lower is better, so an agent above the team line is doing worse.
function describeGap(agent: number | null, team: number | null) {
  if (agent === null || team === null) {
    return "—";
  }

  const gap = agent - team;

  if (Math.abs(gap) < 0.005) {
    return "Same as team";
  }

  return `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)} ${gap > 0 ? "above" : "below"} team`;
}

function buildTrend(data: QualityDeductionData, pharmacist: string): TrendPoint[] {
  return data.months.map((month) => ({
    agent: month.cells[pharmacist]?.score ?? null,
    agentFigures: month.cells[pharmacist],
    label: formatMonthLabel(month.month, "short"),
    month: month.month,
    team: month.team.score,
    teamFigures: month.team,
  }));
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

function TrendTooltip({
  active,
  agentName,
  payload,
}: {
  active?: boolean;
  agentName: string;
  payload?: { payload: TrendPoint }[];
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
          <dt className="text-fg-muted">{agentName}</dt>
          <dd className="font-mono font-semibold text-fg-strong">{formatScore(point.agent)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-fg-muted">Team total</dt>
          <dd className="font-mono text-foreground">{formatScore(point.team)}</dd>
        </div>
      </dl>
      <p className="mt-2 border-t border-tint/10 pt-2 text-fg-subtle">
        {describeGap(point.agent, point.team)}
      </p>
    </div>
  );
}

function SummaryTile({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-tint/10 bg-inset px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-normal text-fg-muted">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold leading-tight text-fg-strong">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-fg-subtle">{sub}</p> : null}
    </div>
  );
}

// One agent's monthly Quality Deduction Score against the team total.
export function QualityDeductionTrendDialog({
  actorLabel,
  data,
  onClose,
  pharmacist,
}: {
  actorLabel: string;
  data: QualityDeductionData;
  onClose: () => void;
  pharmacist: string | null;
}) {
  const trend = pharmacist ? buildTrend(data, pharmacist) : [];
  const scored = trend.filter((point) => point.agent !== null);
  const best = scored.reduce<TrendPoint | null>(
    (lowest, point) => (lowest === null || point.agent! < lowest.agent! ? point : lowest),
    null,
  );
  const worst = scored.reduce<TrendPoint | null>(
    (highest, point) => (highest === null || point.agent! > highest.agent! ? point : highest),
    null,
  );
  const monthsAboveTeam = scored.filter(
    (point) => point.team !== null && point.agent! - point.team > 0.005,
  ).length;
  const periodScore = pharmacist ? data.total.cells[pharmacist]?.score ?? null : null;
  const teamScore = data.total.team.score;
  const isAboveTeam = periodScore !== null && teamScore !== null && periodScore > teamScore;
  const GapIcon = isAboveTeam ? TrendingUp : TrendingDown;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={pharmacist !== null}>
      <DialogContent className="max-w-4xl">
        {pharmacist ? (
          <div className="-mx-6 -mb-6 max-h-[calc(86vh-3rem)] space-y-5 overflow-y-auto px-6 pb-6">
            <DialogHeader>
              <DialogTitle>Quality Deduction trend: {pharmacist}</DialogTitle>
              <DialogDescription>
                Monthly score against the team total. Lower is better: a point above the
                dashed team line means more severity points per QA error than the team.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile
                label="Selected period"
                sub={describeGap(periodScore, teamScore)}
                value={formatScore(periodScore)}
              />
              <SummaryTile label="Team total" sub="Same period" value={formatScore(teamScore)} />
              <SummaryTile
                label="Best month"
                sub={best ? formatMonthLabel(best.month) : "No scored months"}
                value={formatScore(best?.agent ?? null)}
              />
              <SummaryTile
                label="Worst month"
                sub={worst ? formatMonthLabel(worst.month) : "No scored months"}
                value={formatScore(worst?.agent ?? null)}
              />
            </div>

            <div className="rounded-lg border border-tint/10 bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <LegendKey color={AGENT_COLOR} label={pharmacist} />
                  <LegendKey color={TEAM_COLOR} dashed label="Team total" />
                </div>
                {scored.length > 0 ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                    <GapIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    Above the team in {monthsAboveTeam} of {scored.length}{" "}
                    {scored.length === 1 ? "month" : "months"}
                  </p>
                ) : null}
              </div>
              <div
                aria-label={`Line chart of ${pharmacist}'s monthly Quality Deduction Score against the team total. The same figures are in the table below.`}
                className="mt-3 h-72"
                role="img"
              >
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={trend} margin={{ bottom: 4, left: 0, right: 16, top: 8 }}>
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
                      tickFormatter={(value: number) => value.toFixed(1)}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      content={<TrendTooltip agentName={pharmacist} />}
                      cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
                    />
                    <Line
                      activeDot={false}
                      dataKey="team"
                      dot={false}
                      isAnimationActive={false}
                      name="Team total"
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
              <p className="mt-2 text-xs text-fg-subtle">
                Points per QA error. A gap in the line is a month with no QA errors for this{" "}
                {actorLabel.toLowerCase()}.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-tint/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>{actorLabel}</TableHead>
                    <TableHead>Team total</TableHead>
                    <TableHead>Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trend.map((point) => (
                    <TableRow key={point.month}>
                      <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                        {formatMonthLabel(point.month)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {formatScore(point.agent)}
                        {point.agentFigures?.errors ? (
                          <span className="ml-2 text-xs text-fg-subtle">
                            {formatInteger(point.agentFigures.severity)} /{" "}
                            {formatInteger(point.agentFigures.errors)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {formatScore(point.team)}
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
