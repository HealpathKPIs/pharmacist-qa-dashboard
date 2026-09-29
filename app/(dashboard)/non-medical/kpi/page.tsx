import { NonMedicalKpiPage } from "@/components/kpi/non-medical-kpi-page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function NonMedicalKpi({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return <NonMedicalKpiPage searchParams={searchParams} />;
}
