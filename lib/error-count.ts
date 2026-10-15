// QA Error Count KPI (Non-Medical): the number of QA error records. Every record
// counts once, whatever its severity, including records without a scoring
// criterion. Severity, deduction points and the stored score are never used.
//
// Average Errors per Affected Agent = total errors ÷ agents with at least one
// error. Agents with no errors are left out, so it is not a team-wide average.

export type ErrorCountSummary = {
  agentsWithErrors: number;
  // null when no agent has an error.
  averagePerAffectedAgent: number | null;
  totalErrors: number;
};

function summarize(counts: Iterable<number>): ErrorCountSummary {
  let totalErrors = 0;
  let agentsWithErrors = 0;

  for (const count of counts) {
    if (count > 0) {
      totalErrors += count;
      agentsWithErrors += 1;
    }
  }

  return {
    agentsWithErrors,
    averagePerAffectedAgent: agentsWithErrors > 0 ? totalErrors / agentsWithErrors : null,
    totalErrors,
  };
}

// From QA error records: one record = one error.
export function summarizeErrorCount(
  rows: readonly { pharmacistName: string }[],
): ErrorCountSummary {
  const countsByAgent = new Map<string, number>();

  for (const row of rows) {
    countsByAgent.set(row.pharmacistName, (countsByAgent.get(row.pharmacistName) ?? 0) + 1);
  }

  return summarize(countsByAgent.values());
}

// From a table column (one month, or the selected period): agent → error count.
export function summarizeErrorCountCells(
  cells: Readonly<Record<string, { errors: number }>>,
): ErrorCountSummary {
  return summarize(Object.values(cells).map((cell) => cell.errors));
}

export type ErrorCountTeamAverages = {
  // Month key → average per affected agent in that month.
  months: Record<string, number | null>;
  period: number | null;
};

// Team-wide averages for the trend line. Built from the team table (all
// agents), so selecting one agent never narrows the comparison.
export function buildErrorCountTeamAverages(table: {
  months: readonly { cells: Readonly<Record<string, { errors: number }>>; month: string }[];
  total: { cells: Readonly<Record<string, { errors: number }>> };
}): ErrorCountTeamAverages {
  return {
    months: Object.fromEntries(
      table.months.map((month) => [
        month.month,
        summarizeErrorCountCells(month.cells).averagePerAffectedAgent,
      ]),
    ),
    period: summarizeErrorCountCells(table.total.cells).averagePerAffectedAgent,
  };
}
