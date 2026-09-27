// Filters from the Clinical KPI page's filter bar, passed to every KPI section.
export type ClinicalKpiFilters = {
  endDate?: string;
  pharmacistName?: string;
  startDate?: string;
};

export type ClinicalKpiSectionProps = {
  filters: ClinicalKpiFilters;
};
