import { AlertCircle, CheckCircle2, GitMerge, Headset, SearchX, UserPlus } from "lucide-react";

import {
  addNonMedicalAgentAliasAction,
  createNonMedicalAgentAction,
  mergeNonMedicalAgentsAction,
  removeNonMedicalAgentAliasAction,
  renameNonMedicalAgentAction,
  setNonMedicalAgentActiveAction,
} from "@/app/(dashboard)/settings/non-medical-agents/actions";
import { PlatformShell } from "@/components/layout/platform-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth-server";
import type { NonMedicalAgent, UnmatchedNonMedicalName } from "@/lib/non-medical-agents";
import { getNonMedicalRoster, getUnmatchedNonMedicalNames } from "@/lib/non-medical-roster";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type NonMedicalAgentsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const SELECT_CLASS_NAME =
  "h-9 rounded-md border border-field-line bg-field-soft px-2 text-sm text-fg-secondary";

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDays(firstDay: string | null, lastDay: string | null) {
  return firstDay && lastDay ? `${formatDay(firstDay)} – ${formatDay(lastDay)}` : "No QA rows";
}

async function loadRoster(): Promise<
  | { agents: NonMedicalAgent[]; error: null; unmatchedNames: UnmatchedNonMedicalName[] }
  | { agents: null; error: string; unmatchedNames: null }
> {
  try {
    const [agents, unmatchedNames] = await Promise.all([
      getNonMedicalRoster(),
      getUnmatchedNonMedicalNames(),
    ]);

    return { agents, error: null, unmatchedNames };
  } catch (error) {
    return {
      agents: null,
      error: error instanceof Error ? error.message : "Unknown error.",
      unmatchedNames: null,
    };
  }
}

function AgentOptions({ agents }: { agents: NonMedicalAgent[] }) {
  return agents.map((agent) => (
    <option key={agent.id} value={agent.id}>
      {agent.displayName}
      {agent.active ? "" : " (inactive)"}
    </option>
  ));
}

export default async function NonMedicalAgentsPage({
  searchParams,
}: NonMedicalAgentsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const roster = await loadRoster();

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-brand">Settings</p>
          <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
            Non-Medical Agents
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-fg-muted">
            Only active agents on this list count in Non-Medical QA: the agent filter, totals,
            cards, charts, insights and the Non-Medical KPI page. Cases Reviewed are daily
            totals without agent names, so they do not change. Changes apply immediately.
            Records are never deleted. Clinical and Doctors QA are not affected.
          </p>
        </div>

        {params.error || roster.error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            <AlertDescription>
              {params.error ??
                `The Non-Medical agent list could not be loaded. Apply the Non-Medical agent roster migration first. ${roster.error}`}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.success ? (
          <Alert className="border-brand/25 bg-brand/10 text-brand-foreground">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />
            <AlertDescription>{params.success}</AlertDescription>
          </Alert>
        ) : null}

        {roster.error === null ? (
          <>
            <AddAgentCard />
            <AgentListCard agents={roster.agents} />
            <MergeAgentsCard agents={roster.agents} />
            <UnmatchedNamesCard agents={roster.agents} unmatchedNames={roster.unmatchedNames} />
          </>
        ) : null}
      </main>
    </PlatformShell>
  );
}

function AddAgentCard() {
  return (
    <Card className="border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <UserPlus aria-hidden="true" className="h-5 w-5 text-brand" />
          Add Agent
        </CardTitle>
        <CardDescription>
          Add other spellings used in QA files (for example a short name or a common
          misspelling), separated by commas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={createNonMedicalAgentAction}
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
        >
          <Input
            aria-label="Display name"
            maxLength={80}
            name="displayName"
            placeholder="Display name"
            required
          />
          <Input
            aria-label="Other spellings"
            name="aliases"
            placeholder="Other spellings (optional, comma separated)"
          />
          <Button type="submit">Add Agent</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AgentListCard({ agents }: { agents: NonMedicalAgent[] }) {
  const activeAgents = agents.filter((agent) => agent.active).length;

  return (
    <Card className="border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <Headset aria-hidden="true" className="h-5 w-5 text-brand" />
          Non-Medical Agent List
        </CardTitle>
        <CardDescription>
          {formatInteger(activeAgents)} active and {formatInteger(agents.length - activeAgents)}{" "}
          inactive. Records are matched by any listed spelling (case and extra spaces are
          ignored). Renaming keeps the old name as a spelling, so existing records keep matching.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-tint/10">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Spellings (aliases)</TableHead>
                <TableHead className="text-right">QA rows</TableHead>
                <TableHead>QA dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="min-w-72 align-top">
                    <form action={renameNonMedicalAgentAction} className="flex items-center gap-2">
                      <input name="agentId" type="hidden" value={agent.id} />
                      <Input
                        aria-label={`Display name for ${agent.displayName}`}
                        className="h-9"
                        defaultValue={agent.displayName}
                        maxLength={80}
                        name="displayName"
                        required
                      />
                      <Button size="sm" type="submit" variant="outline">
                        Rename
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                          agent.active
                            ? "border-brand/25 bg-brand/10 text-brand-foreground"
                            : "border-zinc-500/25 bg-zinc-500/10 text-fg-muted",
                        )}
                      >
                        {agent.active ? "Active" : "Inactive"}
                      </span>
                      <form action={setNonMedicalAgentActiveAction}>
                        <input name="agentId" type="hidden" value={agent.id} />
                        <input name="active" type="hidden" value={String(!agent.active)} />
                        <Button size="sm" type="submit" variant="outline">
                          {agent.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[420px] align-top">
                    <ul className="space-y-2">
                      {agent.aliases.map((alias) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-tint/10 bg-inset px-3 py-2 text-sm"
                          key={alias.id}
                        >
                          <span className="text-fg-secondary">
                            {alias.alias}
                            <span className="ml-2 font-mono text-xs text-fg-subtle">
                              {formatInteger(alias.qaErrorRecords)} QA rows
                            </span>
                            {alias.isDisplayName ? (
                              <span className="ml-2 text-xs text-brand">Display name</span>
                            ) : null}
                          </span>
                          {alias.isDisplayName ? null : (
                            <form
                              action={removeNonMedicalAgentAliasAction}
                              className="flex items-center gap-2"
                            >
                              <input name="aliasId" type="hidden" value={alias.id} />
                              {alias.qaErrorRecords > 0 ? (
                                <label className="flex items-center gap-1.5 text-xs text-warning-foreground">
                                  <input
                                    className="h-3.5 w-3.5 accent-warning-vivid"
                                    name="confirm"
                                    required
                                    type="checkbox"
                                  />
                                  Stop counting {formatInteger(alias.qaErrorRecords)} rows
                                </label>
                              ) : null}
                              <Button size="sm" type="submit" variant="outline">
                                Remove
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                    <form
                      action={addNonMedicalAgentAliasAction}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input name="agentId" type="hidden" value={agent.id} />
                      <Input
                        aria-label={`New spelling for ${agent.displayName}`}
                        className="h-9"
                        maxLength={80}
                        name="alias"
                        placeholder="Add a spelling"
                        required
                      />
                      <Button size="sm" type="submit" variant="outline">
                        Add
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right align-top font-mono text-fg-tertiary">
                    {formatInteger(agent.qaErrorRecords)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top text-fg-muted">
                    {formatDays(agent.firstDay, agent.lastDay)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MergeAgentsCard({ agents }: { agents: NonMedicalAgent[] }) {
  return (
    <Card className="border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <GitMerge aria-hidden="true" className="h-5 w-5 text-brand" />
          Merge Duplicate Agents
        </CardTitle>
        <CardDescription>
          For one person listed twice, for example under a misspelled name. Every spelling of
          the first agent moves to the second, and the first agent leaves the list. QA records
          are not changed; they count for the agent you keep.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {agents.length < 2 ? (
          <p className="rounded-md border border-dashed border-tint/10 px-4 py-6 text-center text-sm text-fg-subtle">
            Merging needs at least two agents on the list.
          </p>
        ) : (
          <form action={mergeNonMedicalAgentsAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
                  Agent to merge
                </span>
                <select
                  className={cn(SELECT_CLASS_NAME, "w-full")}
                  defaultValue=""
                  name="mergeAgentId"
                  required
                >
                  <option disabled value="">
                    Choose an agent
                  </option>
                  <AgentOptions agents={agents} />
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-normal text-fg-subtle">
                  Agent to keep
                </span>
                <select
                  className={cn(SELECT_CLASS_NAME, "w-full")}
                  defaultValue=""
                  name="keepAgentId"
                  required
                >
                  <option disabled value="">
                    Choose an agent
                  </option>
                  <AgentOptions agents={agents} />
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-warning-foreground">
                <input
                  className="h-4 w-4 accent-warning-vivid"
                  name="confirm"
                  required
                  type="checkbox"
                />
                Move every spelling and QA row of the agent to merge to the agent to keep.
              </label>
              <Button type="submit" variant="outline">
                Merge Agents
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function UnmatchedNamesCard({
  agents,
  unmatchedNames,
}: {
  agents: NonMedicalAgent[];
  unmatchedNames: UnmatchedNonMedicalName[];
}) {
  return (
    <Card className="border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <SearchX aria-hidden="true" className="h-5 w-5 text-warning" />
          Unmatched Names in Non-Medical QA
        </CardTitle>
        <CardDescription>
          Names in imported Non-Medical QA records that match no agent, for example a new agent.
          They are not counted anywhere until you link them to an agent or add them as a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unmatchedNames.length === 0 ? (
          <p className="rounded-md border border-dashed border-tint/10 px-4 py-6 text-center text-sm text-fg-subtle">
            Every Non-Medical QA name is linked to an agent.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-tint/10">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name in QA records</TableHead>
                  <TableHead className="text-right">QA rows</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Link to agent</TableHead>
                  <TableHead className="text-right">Or</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedNames.map((unmatched) => (
                  <TableRow key={unmatched.agentName}>
                    <TableCell className="font-medium text-fg-secondary">
                      {unmatched.agentName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-fg-tertiary">
                      {formatInteger(unmatched.records)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">
                      {formatDays(unmatched.firstDay, unmatched.lastDay)}
                    </TableCell>
                    <TableCell>
                      {agents.length === 0 ? (
                        <span className="text-sm text-fg-subtle">No agents yet</span>
                      ) : (
                        <form
                          action={addNonMedicalAgentAliasAction}
                          className="flex items-center gap-2"
                        >
                          <input name="alias" type="hidden" value={unmatched.agentName} />
                          <select
                            aria-label={`Agent for ${unmatched.agentName}`}
                            className={SELECT_CLASS_NAME}
                            defaultValue=""
                            name="agentId"
                            required
                          >
                            <option disabled value="">
                              Choose an agent
                            </option>
                            <AgentOptions agents={agents} />
                          </select>
                          <Button size="sm" type="submit" variant="outline">
                            Link
                          </Button>
                        </form>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={createNonMedicalAgentAction}>
                        <input name="displayName" type="hidden" value={unmatched.agentName} />
                        <Button size="sm" type="submit" variant="outline">
                          Add as new agent
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
