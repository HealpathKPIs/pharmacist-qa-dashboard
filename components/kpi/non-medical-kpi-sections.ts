import { NonMedicalErrorCountKpi } from "@/components/kpi/error-count/error-count-kpi";
import type { KpiSection } from "@/components/kpi/kpi-types";
import { NonMedicalOverallKpi } from "@/components/kpi/overall/overall-kpi";
import { NonMedicalQualityDeductionKpi } from "@/components/kpi/quality-deduction/quality-deduction-kpi";

// Sections of the Non-Medical KPI page, in display order. To add a KPI, create
// a self-contained section component and add one entry here. Each section loads
// independently.
export const NON_MEDICAL_KPI_SECTIONS: readonly KpiSection[] = [
  {
    Component: NonMedicalOverallKpi,
    id: "overall",
    title: "Overall KPI",
  },
  {
    Component: NonMedicalQualityDeductionKpi,
    id: "quality-deduction",
    title: "Quality Deduction Score",
  },
  {
    Component: NonMedicalErrorCountKpi,
    id: "error-count",
    title: "QA Error Count",
  },
];
