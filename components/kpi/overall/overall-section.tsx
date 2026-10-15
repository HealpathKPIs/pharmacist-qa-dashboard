"use client";

import { AlertCircle, Award, LineChart, TrendingDown, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { formatCoverage, formatInteger, formatPeriod } from "@/components/kpi/kpi-format";
import {
  getSortCell,
  SortableHead,
  sortNames,
  useKpiSort,
} from "@/components/kpi/kpi-sort";
import { KpiTrendDialog, type KpiTrendPoint } from "@/components/kpi/kpi-trend-dialog";
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
import {
  OVERALL_WEIGHTS,
  type OverallColumn,
  type OverallScore,
  type OverallTable,
} from "@/lib/overall-kpi";
import { formatMonthLabel, type MonthKey } from "@/lib/reconciliation";

export type OverallSectionData = {
  // Table rows: every listed agent, or only the selected one.
  agents: string[];
  endDate: string | null;
  pharmacistName: string | null;
  startDate: string | null;
  // Always the whole team (unfiltered).
  table: OverallTable;
};

export type OverallSectionResult =
  | { data: OverallSectionData; error: null }
  | { data: null; error: string };

// One table cell: an agent in a month (null = the selected period).
type SelectedCell = { month: MonthKey | null; pharmacist: string } | null;

const ERROR_WEIGHT = `${OVERALL_WEIGHTS.errorCount * 100}%`;
const QUALITY_WEIGHT = `${OVERALL_WEIGHTS.quality * 100}%`;

function formatOne(value: number) {
  return value.toFixed(1);
}

function getColumn(table: OverallTable, month: MonthKey | null): OverallColumn | undefined {
  return month === null ? table.total : table.months.find((item) => item.month === month)?.column;
}

function describeCell(cell: NonNullable<SelectedCell>) {
  return `${cell.pharmacist}, ${cell.month ? formatMonthLabel(cell.month) : "selected period"}`;
}

// Highest and lowest Overall of a column; ties keep alphabetical order.
function getExtremes(column: OverallColumn) {
  const ranked = Object.entries(column.scores).sort(
    ([nameA, a], [nameB, b]) => b.overall - a.overall || nameA.localeCompare(nameB),
  );

  if (ranked.length === 0) {
    return null;
  }

  const lowestValue = ranked.at(-1)![1].overall;

  return {
    highest: ranked[0],
    lowest: ranked.find(([, score]) => score.overall === lowestValue)!,
  };
}

function SectionHeader({
  caption,
  moduleLabel,
}: {
  caption?: string;
  moduleLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-brand">
          {moduleLabel}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-fg-strong">Overall KPI</h2>
        {caption ? <p className="mt-1 text-xs text-fg-subtle">{caption}</p> : null}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-fg-muted">
        Overall = {ERROR_WEIGHT} Error score + {QUALITY_WEIGHT} Quality score, 0–100, higher is
        better. Both scores rank each agent within the whole team for the same month (or the
        selected period): 100 is the best in the team, 0 the weakest, so 100 does not mean a
        perfect result.
      </p>
    </div>
  );
}

function HeadlineCard({
  icon: Icon,
  label,
  name,
  periodLabel,
  value,
}: {
  icon: typeof Award;
  label: string;
  name?: string;
  periodLabel: string;
  value: string;
}) {
  return (
    <Card className="animate-soft-in h-full border-tint/10 bg-transparent bg-gradient-to-br from-surface-from to-surface-to shadow-(--shadow-card-lg)">
      <CardContent className="flex h-full items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-fg-subtle">
            {label}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">{periodLabel}</p>
          <p className="mt-3 truncate font-mono text-3xl font-semibold leading-none text-fg-strong">
            {value}
          </p>
          {name ? <p className="mt-2 truncate text-sm text-fg-muted">{name}</p> : null}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function ScoreCell({
  label,
  onSelect,
  score,
}: {
  label: string;
  onSelect: () => void;
  score: OverallScore | undefined;
}) {
  if (!score) {
    return <span className="text-fg-faint">—</span>;
  }

  return (
    <button
      aria-label={`${label}: Overall ${formatOne(score.overall)}, Error score ${formatOne(score.errorScore)}, Quality score ${formatOne(score.qualityScore)}. Show the calculation.`}
      className="w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-brand/30 hover:bg-tint/[0.04]"
      onClick={onSelect}
      type="button"
    >
      <span className="block font-mono text-sm font-semibold text-foreground">
        {formatOne(score.overall)}
      </span>
      <span className="mt-1 block whitespace-nowrap text-[11px] leading-4 text-fg-subtle">
        Error score {formatOne(score.errorScore)}
      </span>
      <span className="block whitespace-nowrap text-[11px] leading-4 text-fg-subtle">
        Quality score {formatOne(score.qualityScore)}
      </span>
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
  data: OverallSectionData;
  onSelect: (cell: NonNullable<SelectedCell>) => void;
  onShowTrend: (pharmacist: string) => void;
}) {
  const actorLower = actorLabel.toLowerCase();
  const { table } = data;
  const { handleSort, sort } = useKpiSort();
  const sortTable = useMemo(
    () => ({
      months: table.months.map((month) => ({ cells: month.column.scores, month: month.month })),
      total: { cells: table.total.scores },
    }),
    [table],
  );
  // Unscored agents always go last.
  const agents = useMemo(
    () =>
      sortNames(data.agents, sort, (key, name) => getSortCell(sortTable, key, name)?.overall ?? null),
    [data.agents, sort, sortTable],
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
                {table.months.map((month) => (
                  <SortableHead
                    className="min-w-36"
                    key={month.month}
                    label={`${formatMonthLabel(month.month)} Overall`}
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
                  className="min-w-36 border-l border-tint/10"
                  label="selected period Overall"
                  onSort={handleSort}
                  sort={sort}
                  sortKey="total"
                >
                  Selected period
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((pharmacist) => (
                <TableRow key={pharmacist}>
                  <TableCell className="whitespace-nowrap font-medium text-fg-secondary">
                    <button
                      aria-label={`Show the monthly Overall KPI trend for ${pharmacist}`}
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
                  {table.months.map((month) => (
                    <TableCell className="align-top" key={month.month}>
                      <ScoreCell
                        label={describeCell({ month: month.month, pharmacist })}
                        onSelect={() => onSelect({ month: month.month, pharmacist })}
                        score={month.column.scores[pharmacist]}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="border-l border-tint/10 align-top">
                    <ScoreCell
                      label={describeCell({ month: null, pharmacist })}
                      onSelect={() => onSelect({ month: null, pharmacist })}
                      score={table.total.scores[pharmacist]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-tint/10 px-4 py-3 text-xs text-fg-subtle">
          Each cell shows the Overall score, then its Error score and Quality score (0–100 each,
          not the error count or points). {actorLabel}s with no QA errors in a column are not
          scored (—) and do not affect the ranking. There is no team total: the score is a rank
          within the team. Click a column header to sort (highest first, click again for
          lowest), a name for that {actorLower}&apos;s trend, or a cell for its calculation.
        </p>
      </CardContent>
    </Card>
  );
}

function CalculationLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-tint/10 bg-inset p-4">
      <p className="text-xs font-medium uppercase tracking-normal text-fg-muted">{label}</p>
      <div className="mt-2 space-y-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function CalculationDialog({
  cell,
  data,
  onClose,
}: {
  cell: SelectedCell;
  data: OverallSectionData;
  onClose: () => void;
}) {
  const column = cell ? getColumn(data.table, cell.month) : undefined;
  const score = cell && column ? column.scores[cell.pharmacist] : undefined;
  const scoredAgents = column ? Object.keys(column.scores).length : 0;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(cell)}>
      <DialogContent className="max-w-2xl">
        {cell && column && score ? (
          <div className="-mx-6 -mb-6 max-h-[calc(86vh-3rem)] space-y-4 overflow-y-auto px-6 pb-6">
            <DialogHeader>
              <DialogTitle>Overall KPI: {describeCell(cell)}</DialogTitle>
              <DialogDescription>
                Ranked among {formatInteger(scoredAgents)} scored agents in the whole team for
                this {cell.month ? "month" : "period"}.
              </DialogDescription>
            </DialogHeader>
            <CalculationLine label="Error score (fewer QA errors is better)">
              <p>
                QA errors: <span className="font-mono">{formatInteger(score.errors)}</span> ·
                fewest in team <span className="font-mono">{formatInteger(column.fewestErrors!)}</span>{" "}
                · most in team <span className="font-mono">{formatInteger(column.mostErrors!)}</span>
              </p>
              <p className="font-mono text-fg-strong">
                {column.mostErrors === column.fewestErrors
                  ? "All scored agents are tied, so the Error score is 100.0"
                  : `(${formatInteger(column.mostErrors!)} − ${formatInteger(score.errors)}) ÷ (${formatInteger(column.mostErrors!)} − ${formatInteger(column.fewestErrors!)}) × 100 = ${formatOne(score.errorScore)}`}
              </p>
            </CalculationLine>
            <CalculationLine label="Quality score (fewer points per QA error is better)">
              <p>
                Quality Deduction:{" "}
                <span className="font-mono">{score.points.toFixed(2)} pts</span> · best in team{" "}
                <span className="font-mono">{column.bestPoints!.toFixed(2)}</span> · worst in team{" "}
                <span className="font-mono">{column.worstPoints!.toFixed(2)}</span>
              </p>
              <p className="font-mono text-fg-strong">
                {column.worstPoints === column.bestPoints
                  ? "All scored agents are tied, so the Quality score is 100.0"
                  : `(${column.worstPoints!.toFixed(2)} − ${score.points.toFixed(2)}) ÷ (${column.worstPoints!.toFixed(2)} − ${column.bestPoints!.toFixed(2)}) × 100 = ${formatOne(score.qualityScore)}`}
              </p>
            </CalculationLine>
            <CalculationLine label="Overall">
              <p className="font-mono text-fg-strong">
                {OVERALL_WEIGHTS.errorCount} × {formatOne(score.errorScore)} +{" "}
                {OVERALL_WEIGHTS.quality} × {formatOne(score.qualityScore)} ={" "}
                {formatOne(score.overall)}
              </p>
              <p className="text-xs text-fg-subtle">
                Calculated at full precision; values are shown rounded.
              </p>
            </CalculationLine>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TrendDialog({
  actorLabel,
  data,
  onClose,
  pharmacist,
}: {
  actorLabel: string;
  data: OverallSectionData;
  onClose: () => void;
  pharmacist: string | null;
}) {
  const actorLower = actorLabel.toLowerCase();
  const points: KpiTrendPoint[] = pharmacist
    ? data.table.months.map((month) => ({
        agent: month.column.scores[pharmacist]?.overall ?? null,
        month: month.month,
        team: month.column.averageOverall,
      }))
    : [];

  return (
    <KpiTrendDialog
      actorLabel={actorLabel}
      chartLabel={`Line chart of ${pharmacist}'s monthly Overall KPI against the average of scored ${actorLower}s. The same figures are in the table below.`}
      comparisonNoun="average"
      description={`Monthly Overall KPI against the average Overall of all scored ${actorLower}s in the team that month. Higher is better: a point above the dashed line is better than the team average.`}
      emptyMonthsLabel="No scored months"
      footnote={`Overall score, 0–100. A gap in the line is a month where this ${actorLower} was not scored (no QA errors).`}
      formatAxis={(value) => value.toFixed(0)}
      formatDifference={formatOne}
      formatValue={formatOne}
      higherIsBetter
      onClose={onClose}
      period={{
        agent: pharmacist ? data.table.total.scores[pharmacist]?.overall ?? null : null,
        team: data.table.total.averageOverall,
      }}
      pharmacist={pharmacist}
      points={points}
      teamLabel={`Average of scored ${actorLower}s`}
      title="Overall KPI trend"
    />
  );
}

export function OverallSection({ result }: { result: OverallSectionResult }) {
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
            The Overall KPI could not be loaded. The rest of the page is not affected.{" "}
            {result.error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data } = result;
  const periodLabel = formatPeriod(data.startDate, data.endDate);
  // Team-wide, even when one agent is selected.
  const extremes = getExtremes(data.table.total);
  const scoredAgents = Object.keys(data.table.total.scores).length;

  return (
    <section className="space-y-5">
      <SectionHeader
        caption={`${periodLabel} · ${data.pharmacistName ?? "All active Non-Medical agents"}`}
        moduleLabel={moduleConfig.moduleLabel}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <HeadlineCard
          icon={Award}
          label="Highest Overall"
          name={extremes?.highest[0]}
          periodLabel={`${periodLabel} · whole team`}
          value={extremes ? formatOne(extremes.highest[1].overall) : "—"}
        />
        <HeadlineCard
          icon={TrendingDown}
          label="Lowest Overall"
          name={extremes?.lowest[0]}
          periodLabel={`${periodLabel} · whole team`}
          value={extremes ? formatOne(extremes.lowest[1].overall) : "—"}
        />
        {/* Full width while only two cards fit on a row. */}
        <div className="sm:col-span-2 xl:col-span-1">
          <HeadlineCard
            icon={Users}
            label={`${moduleConfig.actorLabelPlural} Scored`}
            periodLabel={`${periodLabel} · whole team`}
            value={formatInteger(scoredAgents)}
          />
        </div>
      </div>
      {data.table.months.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-tint/10 bg-inset px-6 text-center">
          <Award aria-hidden="true" className="h-7 w-7 text-fg-subtle" />
          <p className="mt-3 text-sm font-medium text-fg-strong">
            No {moduleConfig.moduleLabel} errors match these dates.
          </p>
          <p className="mt-1 text-sm text-fg-subtle">
            Change the dates to see the Overall KPI of each {actorLower}.
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
          />
          <CalculationDialog cell={selectedCell} data={data} onClose={() => setSelectedCell(null)} />
        </>
      )}
    </section>
  );
}
