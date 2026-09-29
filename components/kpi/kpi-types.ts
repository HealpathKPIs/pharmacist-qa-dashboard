import type { FunctionComponent } from "react";

// Filters from a KPI page's filter bar, passed to every KPI section.
export type KpiFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
};

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
