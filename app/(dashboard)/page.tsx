import { AuditDashboardPage } from "@/components/dashboard/audit-dashboard-page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function ClinicalDashboard({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return <AuditDashboardPage auditType="clinical" searchParams={searchParams} />;
}
