import type { FunctionComponent } from "react";

// Filters from a KPI page's filter bar, passed to every KPI section.
export type KpiFilters = {
  endDate?: string;
  // Pharmacist removed from the filter because they have no rows for the
  // selected task type (Processing Time); shown as a note.
  pharmacistCleared?: string;
  pharmacistName?: string;
  startDate?: string;
  // Processing Time task type; other sections ignore it.
  taskType?: string;
};

// Optional page-level override of the pharmacist filter options. null keeps
// the default list.
export type KpiActorOptionsOverride = (filters: KpiFilters) => Promise<string[] | null>;

export type KpiSectionProps = {
  filters: KpiFilters;
};

export type KpiSection = {
  // Server component that loads its own data and renders the whole section.
  Component: FunctionComponent<KpiSectionProps>;
  id: string;
  // Used while the section is loading.
  title: string;
};
