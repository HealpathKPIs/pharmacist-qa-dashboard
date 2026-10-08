import { AlertCircle, ChevronRight, Timer } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CallsUploadCard } from "@/components/upload/calls-upload-card";
import { ReconciliationUploadCard } from "@/components/upload/reconciliation-upload-card";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { requireAdmin } from "@/lib/auth-server";
import { getClinicalRosterForMatching } from "@/lib/clinical-roster";
import type { ReconciliationRosterEntry } from "@/lib/reconciliation-validation";

export const dynamic = "force-dynamic";

async function loadRoster(): Promise<
  { error: null; roster: ReconciliationRosterEntry[] } | { error: string; roster: null }
> {
  try {
    return { error: null, roster: await getClinicalRosterForMatching() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error.",
      roster: null,
    };
  }
}

export default async function UploadDataPage() {
  await requireAdmin();
  const rosterResult = await loadRoster();

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
              Upload Data
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-fg-muted">
              Parse an Excel workbook locally and preview Sheet1 and Sheet2.
            </p>
          </div>
          <UploadDropzone auditType="clinical" />
          <Link
            className="group flex items-center justify-between gap-4 rounded-lg border border-tint/10 bg-surface px-5 py-4 transition-colors hover:border-brand/40 hover:bg-tint/[0.03]"
            href="/upload/processing-time"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand-strong">
                <Timer aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-fg-strong">
                  Processing Time Tracker
                </span>
                <span className="block text-sm text-fg-muted">
                  Monthly daily work log (SLA vs actual minutes). Opens its own upload page.
                </span>
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          {rosterResult.roster ? (
            <>
              <ReconciliationUploadCard roster={rosterResult.roster} />
              <CallsUploadCard
                defaultYear={new Date().getFullYear()}
                roster={rosterResult.roster}
              />
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>
                The medication reconciliation and calls tracker uploads are unavailable
                because the Clinical pharmacist roster could not be loaded. Apply the Clinical
                roster migration first. {rosterResult.error}
              </AlertDescription>
            </Alert>
          )}
        </section>
      </main>
    </AppShell>
  );
}
