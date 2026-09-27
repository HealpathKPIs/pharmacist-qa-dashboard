import { AlertCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Upload Data
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Parse an Excel workbook locally and preview Sheet1 and Sheet2.
            </p>
          </div>
          <UploadDropzone auditType="clinical" />
          {rosterResult.roster ? (
            <ReconciliationUploadCard roster={rosterResult.roster} />
          ) : (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>
                The medication reconciliation tracker upload is unavailable because the
                Clinical pharmacist roster could not be loaded. Apply the Clinical roster
                migration first. {rosterResult.error}
              </AlertDescription>
            </Alert>
          )}
        </section>
      </main>
    </AppShell>
  );
}
