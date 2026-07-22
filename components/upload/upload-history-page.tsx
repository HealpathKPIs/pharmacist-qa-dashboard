import { AlertTriangle, UploadCloud } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditModule, type AuditType } from "@/lib/audit-types";
import { getUploadHistory } from "@/lib/upload-history";
import { cn } from "@/lib/utils";

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
  if (status === "success") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "partial") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-red-300/25 bg-red-300/10 text-red-100";
}

export async function AuditUploadHistoryPage({ auditType }: { auditType: AuditType }) {
  const moduleConfig = getAuditModule(auditType);

  try {
    const uploads = await getUploadHistory(auditType);

    return (
      <AppShell auditType={auditType}>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-emerald-300">{moduleConfig.moduleLabel} audit trail</p>
                <h1 className="text-3xl font-semibold tracking-normal text-white">Upload History</h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-400">
                  Review workbook imports for {moduleConfig.moduleLabel} only.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs font-medium uppercase text-zinc-500">Previous uploads</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-white">{formatInteger(uploads.length)}</p>
              </div>
            </div>
            <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader>
                <CardTitle className="text-white">Previous Uploads</CardTitle>
                <CardDescription>Latest 50 {moduleConfig.moduleLabel} upload batches.</CardDescription>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/10 px-6 py-12 text-center">
                    <UploadCloud aria-hidden="true" className="h-8 w-8 text-zinc-500" />
                    <h2 className="mt-4 text-lg font-semibold text-white">No uploads recorded yet</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                      Imported {moduleConfig.moduleLabel} workbooks will appear here without mixing with the other product.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-white/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File name</TableHead><TableHead>Upload date</TableHead><TableHead>Status</TableHead>
                          <TableHead className="text-right">Inserted rows</TableHead><TableHead className="text-right">Failed rows</TableHead><TableHead className="text-right">Skipped rows</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploads.map((upload) => (
                          <TableRow key={upload.id}>
                            <TableCell className="min-w-56 font-medium text-zinc-200"><span className="line-clamp-2">{upload.fileName}</span></TableCell>
                            <TableCell className="min-w-44 text-zinc-400">{formatDateTime(upload.uploadedAt)}</TableCell>
                            <TableCell><span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize", statusClassName(upload.status))}>{upload.status}</span></TableCell>
                            <TableCell className="text-right font-mono text-zinc-400">{formatInteger(upload.insertedRows)}</TableCell>
                            <TableCell className="text-right font-mono text-zinc-400">{formatInteger(upload.failedRows)}</TableCell>
                            <TableCell className="text-right font-mono text-zinc-400">{formatInteger(upload.skippedRows)}</TableCell>
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
          <Alert className="border-red-300/25 bg-red-300/10 text-red-100">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-red-300" />
            <AlertDescription>Upload history could not be loaded. {error instanceof Error ? error.message : "Unknown error."}</AlertDescription>
          </Alert>
        </main>
      </AppShell>
    );
  }
}
