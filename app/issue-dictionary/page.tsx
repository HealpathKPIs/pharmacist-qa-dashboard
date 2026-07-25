import { BookOpen } from "lucide-react";

import { PlatformShell } from "@/components/layout/platform-shell";
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
import { AUDIT_MODULES } from "@/lib/audit-types";
import { requireAdmin } from "@/lib/auth-server";
import { getErrorsByIssue } from "@/lib/dashboard-queries";

export const dynamic = "force-dynamic";

export default async function IssueDictionaryPage() {
  await requireAdmin();
  const modules = Object.values(AUDIT_MODULES);
  const issuesByModule = await Promise.all(
    modules.map((module) =>
      getErrorsByIssue({ auditType: module.auditType }),
    ),
  );
  const issues = modules.flatMap((module, index) =>
    issuesByModule[index].map((issue) => ({
      count: issue.errorCount,
      issue: issue.issueType,
      module: module.moduleLabel,
    })),
  );

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-emerald-300">Administration</p>
          <h1 className="text-3xl font-semibold tracking-normal text-white">
            Issue Dictionary
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Issue names currently represented in imported QA records.
          </p>
        </div>

        <Card className="border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              Registered issues
            </CardTitle>
            <CardDescription>
              Entries remain isolated by module even when labels match.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={`${issue.module}-${issue.issue}`}>
                      <TableCell className="font-medium text-zinc-200">
                        {issue.issue}
                      </TableCell>
                      <TableCell className="text-zinc-400">{issue.module}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-400">
                        {issue.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </PlatformShell>
  );
}
