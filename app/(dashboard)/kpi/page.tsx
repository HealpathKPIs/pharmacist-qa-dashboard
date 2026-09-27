import { ClinicalKpiPage } from "@/components/kpi/clinical-kpi-page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function ClinicalKpi({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return <ClinicalKpiPage searchParams={searchParams} />;
}
