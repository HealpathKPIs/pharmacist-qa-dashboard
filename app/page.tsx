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
import { checkDatabaseHealth } from "@/lib/database-health";
import {
  getDailyTrend,
  getDailyPatientDetails,
  getDashboardTotals,
  getErrorsByIssue,
  getErrorsByPharmacist,
  getPreviousPeriodFilters,
  getQaErrorDetails,
  getSeverityDistribution,
  type DashboardDateRangeFilter,
} from "@/lib/dashboard-queries";
import { getUploadHistory } from "@/lib/upload-history";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getFilters(searchParams: SearchParams): DashboardFilterValues {
  return {
    startDate: getSearchValue(searchParams, "startDate"),
    endDate: getSearchValue(searchParams, "endDate"),
    pharmacistName: getSearchValue(searchParams, "pharmacistName"),
    issueType: getSearchValue(searchParams, "issueType"),
  };
}

function toQueryFilters(filters: DashboardFilterValues): DashboardDateRangeFilter {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    pharmacistName: filters.pharmacistName || undefined,
    issueType: filters.issueType || undefined,
  };
}

function toDateOnlyFilters(filters: DashboardFilterValues): DashboardDateRangeFilter {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = getFilters(resolvedSearchParams);
  const queryFilters = toQueryFilters(filters);
  const dateOnlyFilters = toDateOnlyFilters(filters);

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
      getUploadHistory(1),
      checkDatabaseHealth(),
    ]);
    const hasData =
      totals.totalPatients > 0 ||
      totals.totalQaErrors > 0 ||
      dailyTrend.length > 0 ||
      errorsByPharmacist.length > 0 ||
      errorsByIssue.length > 0;

    return (
      <DashboardShell>
        <DashboardHeader>
          <DashboardFilters
            filters={filters}
            issueOptions={issueOptions.map((issue) => issue.issueType)}
            pharmacistOptions={pharmacistOptions.map(
              (pharmacist) => pharmacist.pharmacistName,
            )}
          />
        </DashboardHeader>
        <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {!hasData ? (
            <DashboardEmptyState />
          ) : (
            <DashboardInteractive
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
      <DashboardShell>
        <DashboardHeader>
          <DashboardFilters filters={filters} issueOptions={[]} pharmacistOptions={[]} />
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
