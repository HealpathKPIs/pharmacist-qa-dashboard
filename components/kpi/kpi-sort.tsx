"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { TableHead } from "@/components/ui/table";
import type { MonthKey } from "@/lib/reconciliation";
import { cn } from "@/lib/utils";

// Sort of the KPI monthly tables: by name, by one month, or by the selected
// period.
export type SortKey = "name" | "total" | MonthKey;
export type SortState = { direction: "asc" | "desc"; key: SortKey };

const DEFAULT_SORT: SortState = { direction: "asc", key: "name" };

// Value columns start with the highest value first; the name column A to Z.
export function useKpiSort() {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { direction: current.direction === "asc" ? "desc" : "asc", key }
        : { direction: key === "name" ? "asc" : "desc", key },
    );
  }

  return { handleSort, sort };
}

// Names without a value (null) always go last, in either direction. Ties keep
// alphabetical order.
export function sortNames(
  names: readonly string[],
  sort: SortState,
  getValue: (key: Exclude<SortKey, "name">, name: string) => number | null,
) {
  const byName = (a: string, b: string) => a.localeCompare(b);
  const sign = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "name") {
    return [...names].sort((a, b) => sign * byName(a, b));
  }

  const key = sort.key;

  return [...names].sort((a, b) => {
    const valueA = getValue(key, a);
    const valueB = getValue(key, b);

    if (valueA === null || valueB === null) {
      return valueA === valueB ? byName(a, b) : valueA === null ? 1 : -1;
    }

    return valueA === valueB ? byName(a, b) : sign * (valueA - valueB);
  });
}

// The cell of a monthly KPI table that a sort key points at.
export function getSortCell<Cell>(
  table: {
    months: readonly { cells: Record<string, Cell>; month: MonthKey }[];
    total: { cells: Record<string, Cell> };
  },
  key: Exclude<SortKey, "name">,
  name: string,
): Cell | undefined {
  if (key === "total") {
    return table.total.cells[name];
  }

  return table.months.find((month) => month.month === key)?.cells[name];
}

export function SortableHead({
  children,
  className,
  label,
  onSort,
  sort,
  sortKey,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onSort: (key: SortKey) => void;
  sort: SortState;
  sortKey: SortKey;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const ariaSort = !active ? "none" : sort.direction === "asc" ? "ascending" : "descending";

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        aria-label={`Sort by ${label}`}
        className={cn(
          "-mx-1 inline-flex items-start gap-1.5 rounded px-1 py-0.5 text-left uppercase transition-colors hover:text-fg-strong",
          active && "text-brand-strong",
        )}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{children}</span>
        <Icon
          aria-hidden="true"
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", !active && "opacity-50")}
        />
      </button>
    </TableHead>
  );
}
