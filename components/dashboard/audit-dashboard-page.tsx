import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardHeader,
  DashboardShell,
} from "@/components/dashboard/dashboard-components";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "@/components/dashboard/dashboard-filters";
import { DashboardInteractive } from "@/components/dashboard/dashboard-interactive";
import type { AuditType } from "@/lib/audit-types";
import { checkDatabaseHealth } from "@/lib/database-health";
import {
  getDailyPatientDetails,
  getDailyTrend,
  getDashboardTotals,
  getErrorsByIssue,
  getErrorsByPharmacist,
  getPreviousPeriodFilters,
  getQaErrorDetails,
  getSeverityDistribution,
  type DashboardDateRangeFilter,
} from "@/lib/dashboard-queries";
import { getUploadHistory } from "@/lib/upload-history";

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getFilters(searchParams: SearchParams): DashboardFilterValues {
  return {
    endDate: getSearchValue(searchParams, "endDate"),
    issueType: getSearchValue(searchParams, "issueType"),
    pharmacistName: getSearchValue(searchParams, "pharmacistName"),
    startDate: getSearchValue(searchParams, "startDate"),
  };
}

function toQueryFilters(
  auditType: AuditType,
  filters: DashboardFilterValues,
): DashboardDateRangeFilter {
  return {
    auditType,
    endDate: filters.endDate || undefined,
    issueType: filters.issueType || undefined,
    pharmacistName: filters.pharmacistName || undefined,
    startDate: filters.startDate || undefined,
  };
}

function toDateOnlyFilters(
  auditType: AuditType,
  filters: DashboardFilterValues,
): DashboardDateRangeFilter {
  return {
    auditType,
    endDate: filters.endDate || undefined,
    startDate: filters.startDate || undefined,
  };
}

export async function AuditDashboardPage({
  auditType,
  searchParams,
}: {
  auditType: AuditType;
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = getFilters(resolvedSearchParams);
  const queryFilters = toQueryFilters(auditType, filters);
  const dateOnlyFilters = toDateOnlyFilters(auditType, filters);

  try {
    const previousPeriodFilters = await getPreviousPeriodFilters(queryFilters);
    const [
      totals,
      previousTotals,
      dailyTrend,
      errorsByPharmacist,
      errorsByIssue,
      dailyPatientDetails,
      qaErrorDetails,
      previousQaErrorDetails,
      severityDistribution,
      pharmacistOptions,
      issueOptions,
      recentUploads,
      databaseHealth,
    ] = await Promise.all([
      getDashboardTotals(queryFilters),
      getDashboardTotals(previousPeriodFilters),
      getDailyTrend(queryFilters),
      getErrorsByPharmacist(queryFilters),
      getErrorsByIssue(queryFilters),
      getDailyPatientDetails(dateOnlyFilters),
      getQaErrorDetails(queryFilters),
      getQaErrorDetails(previousPeriodFilters),
      getSeverityDistribution(queryFilters),
      getErrorsByPharmacist(dateOnlyFilters),
      getErrorsByIssue(dateOnlyFilters),
      getUploadHistory(auditType, 1),
      checkDatabaseHealth(auditType),
    ]);
    const hasData =
      totals.totalPatients > 0 ||
      totals.totalQaErrors > 0 ||
      dailyTrend.length > 0 ||
      errorsByPharmacist.length > 0 ||
      errorsByIssue.length > 0;

    return (
      <DashboardShell auditType={auditType}>
        <DashboardHeader auditType={auditType}>
          <DashboardFilters
            auditType={auditType}
            filters={filters}
            issueOptions={issueOptions.map((issue) => issue.issueType)}
            pharmacistOptions={pharmacistOptions.map(
              (pharmacist) => pharmacist.pharmacistName,
            )}
          />
        </DashboardHeader>
        <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {!hasData ? (
            <DashboardEmptyState auditType={auditType} />
          ) : (
            <DashboardInteractive
              auditType={auditType}
              dailyPatientDetails={dailyPatientDetails}
              dailyTrend={dailyTrend}
              databaseHealthy={databaseHealth.ok}
              errorsByIssue={errorsByIssue}
              errorsByPharmacist={errorsByPharmacist}
              previousQaErrorDetails={previousQaErrorDetails}
              previousTotals={previousTotals}
              qaErrorDetails={qaErrorDetails}
              recentUpload={recentUploads[0] ?? null}
              severityDistribution={severityDistribution}
              totals={totals}
            />
          )}
        </main>
      </DashboardShell>
    );
  } catch (error) {
    return (
      <DashboardShell auditType={auditType}>
        <DashboardHeader auditType={auditType}>
          <DashboardFilters
            auditType={auditType}
            filters={filters}
            issueOptions={[]}
            pharmacistOptions={[]}
          />
        </DashboardHeader>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <DashboardErrorState
            message={error instanceof Error ? error.message : "Unknown error."}
          />
        </main>
      </DashboardShell>
    );
  }
}
