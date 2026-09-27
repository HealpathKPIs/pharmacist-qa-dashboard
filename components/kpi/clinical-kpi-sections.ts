import type { FunctionComponent } from "react";

import type { ClinicalKpiSectionProps } from "@/components/kpi/clinical-kpi-types";
import { MedicationReconciliationKpi } from "@/components/kpi/medication-reconciliation/medication-reconciliation-kpi";

export type ClinicalKpiSection = {
  // Server component that loads its own data and renders the whole section.
  Component: FunctionComponent<ClinicalKpiSectionProps>;
  id: string;
  // Used while the section is loading.
  title: string;
};

// Sections of the Clinical KPI page, in display order. To add a KPI, create a
// self-contained section component (like medication-reconciliation/) and add
// one entry here. Each section loads independently.
export const CLINICAL_KPI_SECTIONS: readonly ClinicalKpiSection[] = [
  {
    Component: MedicationReconciliationKpi,
    id: "medication-reconciliation",
    title: "Medication Reconciliation — Monthly",
  },
];
