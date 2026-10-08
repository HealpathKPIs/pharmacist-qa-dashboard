import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProcessingTimeUploadCard } from "@/components/upload/processing-time-upload-card";
import { requireAdmin } from "@/lib/auth-server";
import { getClinicalRosterForMatching } from "@/lib/clinical-roster";
import { getProcessingTimeMonths, type ProcessingTimeMonth } from "@/lib/processing-time-queries";
import { formatProcessingMonth } from "@/lib/processing-time-validation";

export const dynamic = "force-dynamic";

// A fixed time zone, so the server and the browser show the same text.
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
});

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

async function load<T>(loader: () => Promise<T>) {
  try {
    return { error: null, value: await loader() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error.", value: null };
  }
}

// Default month: the previous calendar month (the tracker is uploaded after
// the month ends). Validating a file switches to the month of its dates.
function getDefaultMonth(today = new Date()) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));

  return date.toISOString().slice(0, 7);
}

function MonthsTable({ months }: { months: ProcessingTimeMonth[] }) {
  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="text-fg-strong">Uploaded Months</CardTitle>
        <CardDescription>
          Every month stored for the Processing Time KPI. Uploading a month again replaces it.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {months.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-fg-subtle">No month uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Task Rows</TableHead>
                  <TableHead className="text-right">Pharmacists</TableHead>
                  <TableHead className="text-right">SLA Minutes</TableHead>
                  <TableHead className="text-right">Actual Minutes</TableHead>
                  <TableHead className="text-right">Processing Time</TableHead>
                  <TableHead>Last Upload</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell className="font-medium text-fg-strong">
                      {formatProcessingMonth(month.month)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatInteger(month.rows)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatInteger(month.pharmacists)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMinutes(month.slaMinutes)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMinutes(month.actualMinutes)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {month.actualMinutes > 0
                        ? `${((month.slaMinutes / month.actualMinutes) * 100).toFixed(2)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-fg-muted">
                      {dateTimeFormatter.format(new Date(month.lastUploadAt))}
                    </TableCell>
                    <TableCell className="text-sm text-fg-muted">
                      {month.sourceFiles.join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="border-t border-tint/10 px-6 py-3 text-xs text-fg-subtle">
          Includes inactive pharmacists&apos; rows; the KPI counts active pharmacists only.
        </p>
      </CardContent>
    </Card>
  );
}

export default async function ProcessingTimeUploadPage() {
  await requireAdmin();
  const [rosterResult, monthsResult] = await Promise.all([
    load(getClinicalRosterForMatching),
    load(getProcessingTimeMonths),
  ]);
  const months = monthsResult.value ?? [];

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <Link
              className="inline-flex items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg-strong"
              href="/upload"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Upload Data
            </Link>
            <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
              Processing Time Upload
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-fg-muted">
              Upload one tracker per month. It feeds the Processing Time KPI on Clinical KPIs
              (SLA minutes ÷ actual minutes × 100).
            </p>
          </div>
          {rosterResult.value && monthsResult.value ? (
            <ProcessingTimeUploadCard
              defaultMonth={getDefaultMonth()}
              existingRowsByMonth={Object.fromEntries(
                months.map((month) => [month.month, month.rows]),
              )}
              roster={rosterResult.value}
            />
          ) : (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>
                The Processing Time upload is unavailable. If the migration
                20261008000100_clinical_processing_time.sql has not been applied yet, run it in
                the Supabase SQL Editor first. {rosterResult.error ?? monthsResult.error}
              </AlertDescription>
            </Alert>
          )}
          {monthsResult.value ? <MonthsTable months={months} /> : null}
        </section>
      </main>
    </AppShell>
  );
}
