"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Headset } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WorkbookValidationResult } from "@/lib/excel-validation";
import {
  checkNonMedicalAgentNames,
  type AgentNameCheck,
  type NonMedicalAgentMatchEntry,
} from "@/lib/non-medical-agents";

export type NonMedicalAgentRosterState =
  | { error: null; roster: NonMedicalAgentMatchEntry[] }
  | { error: string; roster: null };

const AGENTS_SETTINGS_PATH = "/settings/non-medical-agents";

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function describeStatus(check: AgentNameCheck) {
  if (check.status === "not_on_list") {
    return "Not on the agent list";
  }

  return check.agentName && check.agentName !== check.name
    ? `Inactive agent (listed as ${check.agentName})`
    : "Inactive agent";
}

// Agent names of a Non-Medical upload, checked against Settings > Non-Medical
// Agents. Every row is still imported; only the rows of active agents on the
// list count in Non-Medical QA, so the others are listed here.
export function NonMedicalAgentReport({
  agentRoster,
  result,
}: {
  agentRoster: NonMedicalAgentRosterState;
  result: Pick<WorkbookValidationResult, "qaErrors">;
}) {
  const checks = useMemo(
    () =>
      agentRoster.roster
        ? checkNonMedicalAgentNames(
            result.qaErrors.map((row) => row.pharmacistName),
            agentRoster.roster,
          )
        : [],
    [agentRoster.roster, result.qaErrors],
  );
  const notCounted = checks.filter((check) => check.status !== "counted");
  const notCountedRows = notCounted.reduce((total, check) => total + check.rows, 0);

  return (
    <div className="space-y-3 rounded-md border border-tint/10 bg-inset p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Headset aria-hidden="true" className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-medium text-fg-strong">Agents</h3>
        </div>
        {agentRoster.roster ? (
          <p className="font-mono text-xs text-fg-subtle">
            {formatInteger(checks.length)} agent {checks.length === 1 ? "name" : "names"} in QA
            error rows
          </p>
        ) : null}
      </div>
      {agentRoster.error !== null ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            Agent names were not checked: the Non-Medical agent list could not be loaded.{" "}
            {agentRoster.error}
          </AlertDescription>
        </Alert>
      ) : checks.length === 0 ? (
        <p className="text-sm text-fg-muted">This file has no QA error rows to check.</p>
      ) : notCounted.length === 0 ? (
        <Alert className="border-brand/25 bg-brand/10 text-brand-foreground">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />
          <AlertDescription>
            Every agent in this file is an active agent on the Non-Medical agent list.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-warning/20 bg-warning/[0.06] px-3 py-2 text-sm text-warning-foreground">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
              {formatInteger(notCounted.length)} agent{" "}
              {notCounted.length === 1 ? "name does" : "names do"} not count yet (
              {formatInteger(notCountedRows)} QA error {notCountedRows === 1 ? "row" : "rows"})
            </p>
            <p className="mt-1 text-xs leading-5 text-warning-foreground/70">
              These rows are imported, but Non-Medical QA counts only active agents on the list.
              Add or link new names, or reactivate agents, in{" "}
              <Link className="underline underline-offset-2" href={AGENTS_SETTINGS_PATH}>
                Settings › Non-Medical Agents
              </Link>
              . They count from then on; nothing needs to be uploaded again.
            </p>
          </div>
          <div className="max-h-96 overflow-auto rounded-md border border-tint/10">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase tracking-normal text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">Agent name in the file</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">QA error rows</th>
                </tr>
              </thead>
              <tbody>
                {notCounted.map((check) => (
                  <tr className="border-t border-tint/10 text-fg-tertiary" key={check.name}>
                    <td className="min-w-56 px-3 py-2">{check.name}</td>
                    <td className="min-w-56 px-3 py-2 text-fg-muted">{describeStatus(check)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                      {formatInteger(check.rows)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
