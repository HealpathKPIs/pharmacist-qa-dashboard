import type { KpiSection } from "@/components/kpi/kpi-types";
import { NonMedicalQualityDeductionKpi } from "@/components/kpi/quality-deduction/quality-deduction-kpi";

// Sections of the Non-Medical KPI page, in display order. To add a KPI, create
// a self-contained section component and add one entry here. Each section loads
// independently.
export const NON_MEDICAL_KPI_SECTIONS: readonly KpiSection[] = [
  {
    Component: NonMedicalQualityDeductionKpi,
    id: "quality-deduction",
    title: "Quality Deduction Score",
  },
];
