import { AuditDashboardPage } from "@/components/dashboard/audit-dashboard-page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function NonMedicalDashboard({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return <AuditDashboardPage auditType="non_medical" searchParams={searchParams} />;
}
