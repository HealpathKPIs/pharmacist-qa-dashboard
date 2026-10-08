import { ClinicalCallsKpi } from "@/components/kpi/clinical-calls/clinical-calls-kpi";
import type { KpiSection } from "@/components/kpi/kpi-types";
import { MedicationReconciliationKpi } from "@/components/kpi/medication-reconciliation/medication-reconciliation-kpi";
import { ProcessingTimeKpi } from "@/components/kpi/processing-time/processing-time-kpi";
import { QualityDeductionKpi } from "@/components/kpi/quality-deduction/quality-deduction-kpi";

// Sections of the Clinical KPI page, in display order. To add a KPI, create a
// self-contained section component (like medication-reconciliation/) and add
// one entry here. Each section loads independently.
export const CLINICAL_KPI_SECTIONS: readonly KpiSection[] = [
  {
    Component: MedicationReconciliationKpi,
    id: "medication-reconciliation",
    title: "Medication Reconciliation — Monthly",
  },
  {
    Component: QualityDeductionKpi,
    id: "quality-deduction",
    title: "Quality Deduction Score",
  },
  {
    Component: ClinicalCallsKpi,
    id: "clinical-calls",
    title: "Clinical Calls KPI",
  },
  {
    Component: ProcessingTimeKpi,
    id: "processing-time",
    title: "Processing Time KPI",
  },
];
