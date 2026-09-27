import type { ClinicalKpiSectionProps } from "@/components/kpi/clinical-kpi-types";
import { ReconciliationMonthlySection } from "@/components/kpi/medication-reconciliation/reconciliation-monthly-section";
import { getReconciliationMonthly } from "@/lib/reconciliation-queries";

// Monthly Medication Reconciliation KPI. Data and formula live in
// lib/reconciliation-queries.ts and lib/reconciliation.ts. The loader never
// throws; a failure is shown inside this section only.
export async function MedicationReconciliationKpi({ filters }: ClinicalKpiSectionProps) {
  return <ReconciliationMonthlySection result={await getReconciliationMonthly(filters)} />;
}
