import { AlertTriangle, UploadCloud } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import { requireAdmin } from "@/lib/auth-server";
import { getUploadHistory, type UploadKind } from "@/lib/upload-history";
import { cn } from "@/lib/utils";

const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  qa_audit: "QA workbook",
  reconciliation_workload: "Reconciliation",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusClassName(status: string) {
  if (status === "success") return "border-brand/25 bg-brand/10 text-brand-foreground";
  if (status === "partial") return "border-warning/25 bg-warning/10 text-warning-foreground";
  return "border-danger/25 bg-danger/10 text-danger-foreground";
}

export async function AuditUploadHistoryPage({ auditType }: { auditType: AuditType }) {
  await requireAdmin();
  const moduleConfig = getAuditModule(auditType);
  // Only Clinical QA has more than one upload type.
  const showUploadKind = auditType === "clinical";

  try {
    const uploads = await getUploadHistory(auditType);

    return (
      <AppShell auditType={auditType}>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-brand">{moduleConfig.moduleLabel} audit trail</p>
                <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">Upload History</h1>
                <p className="max-w-2xl text-sm leading-6 text-fg-muted">
                  Review workbook imports for {moduleConfig.moduleLabel} only.
                </p>
              </div>
              <div className="rounded-md border border-tint/10 bg-surface px-4 py-3">
                <p className="text-xs font-medium uppercase text-fg-subtle">Previous uploads</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-fg-strong">{formatInteger(uploads.length)}</p>
              </div>
            </div>
            <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
              <CardHeader>
                <CardTitle className="text-fg-strong">Previous Uploads</CardTitle>
                <CardDescription>Latest 50 {moduleConfig.moduleLabel} upload batches.</CardDescription>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-tint/10 px-6 py-12 text-center">
                    <UploadCloud aria-hidden="true" className="h-8 w-8 text-fg-subtle" />
                    <h2 className="mt-4 text-lg font-semibold text-fg-strong">No uploads recorded yet</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-fg-muted">
                      Imported {moduleConfig.moduleLabel} workbooks will appear here without mixing with the other product.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-tint/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File name</TableHead>{showUploadKind ? <TableHead>Type</TableHead> : null}<TableHead>Upload date</TableHead><TableHead>Status</TableHead>
                          <TableHead className="text-right">Inserted rows</TableHead><TableHead className="text-right">Failed rows</TableHead><TableHead className="text-right">Skipped rows</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploads.map((upload) => (
                          <TableRow key={upload.id}>
                            <TableCell className="min-w-56 font-medium text-fg-secondary"><span className="line-clamp-2">{upload.fileName}</span></TableCell>
                            {showUploadKind ? <TableCell className="whitespace-nowrap text-fg-muted">{UPLOAD_KIND_LABELS[upload.uploadKind]}</TableCell> : null}
                            <TableCell className="min-w-44 text-fg-muted">{formatDateTime(upload.uploadedAt)}</TableCell>
                            <TableCell><span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize", statusClassName(upload.status))}>{upload.status}</span></TableCell>
                            <TableCell className="text-right font-mono text-fg-muted">{formatInteger(upload.insertedRows)}</TableCell>
                            <TableCell className="text-right font-mono text-fg-muted">{formatInteger(upload.failedRows)}</TableCell>
                            <TableCell className="text-right font-mono text-fg-muted">{formatInteger(upload.skippedRows)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </main>
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell auditType={auditType}>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Alert className="border-danger/25 bg-danger/10 text-danger-foreground">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-danger" />
            <AlertDescription>Upload history could not be loaded. {error instanceof Error ? error.message : "Unknown error."}</AlertDescription>
          </Alert>
        </main>
      </AppShell>
    );
  }
}
