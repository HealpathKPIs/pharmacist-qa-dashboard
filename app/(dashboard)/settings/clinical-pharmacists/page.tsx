import { AlertCircle, CheckCircle2, SearchX, UserPlus, Users } from "lucide-react";

import {
  addClinicalPharmacistAliasAction,
  createClinicalPharmacistAction,
  removeClinicalPharmacistAliasAction,
  renameClinicalPharmacistAction,
  setClinicalPharmacistActiveAction,
} from "@/app/(dashboard)/settings/clinical-pharmacists/actions";
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
import {
  getClinicalRoster,
  getUnmatchedClinicalNames,
  type ClinicalPharmacist,
  type UnmatchedClinicalName,
} from "@/lib/clinical-roster";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ClinicalPharmacistsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

async function loadRoster(): Promise<{
  error: string | null;
  pharmacists: ClinicalPharmacist[];
  unmatchedNames: UnmatchedClinicalName[];
}> {
  try {
    const [pharmacists, unmatchedNames] = await Promise.all([
      getClinicalRoster(),
      getUnmatchedClinicalNames(),
    ]);

    return { error: null, pharmacists, unmatchedNames };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error.",
      pharmacists: [],
      unmatchedNames: [],
    };
  }
}

export default async function ClinicalPharmacistsPage({
  searchParams,
}: ClinicalPharmacistsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const roster = await loadRoster();

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-brand">Settings</p>
          <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
            Clinical Pharmacists
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-fg-muted">
            Only active pharmacists on this list count in Clinical QA: the pharmacist filter,
            totals, cards, charts, insights and the monthly reconciliation KPI. Changes apply
            immediately. Records are never deleted. Non-Medical and Doctors QA are not affected.
          </p>
        </div>

        {params.error || roster.error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            <AlertDescription>
              {params.error ??
                `The Clinical pharmacist list could not be loaded. Apply the Clinical roster migration first. ${roster.error}`}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.success ? (
          <Alert className="border-brand/25 bg-brand/10 text-brand-foreground">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />
            <AlertDescription>{params.success}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-tint/10 bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-fg-strong">
              <UserPlus aria-hidden="true" className="h-5 w-5 text-brand" />
              Add Pharmacist
            </CardTitle>
            <CardDescription>
              Add other spellings used in QA files or the tracker (for example
              &quot;Nadin Tamer&quot;), separated by commas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={createClinicalPharmacistAction}
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
              <Button type="submit">Add Pharmacist</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-tint/10 bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-fg-strong">
              <Users aria-hidden="true" className="h-5 w-5 text-brand" />
              Clinical Pharmacist List
            </CardTitle>
            <CardDescription>
              Records are matched by any listed spelling (case and extra spaces are ignored).
              Renaming keeps the old name as a spelling, so existing records keep matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-tint/10">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pharmacist</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Spellings (aliases)</TableHead>
                    <TableHead className="text-right">QA rows</TableHead>
                    <TableHead className="text-right">Tracker rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.pharmacists.map((pharmacist) => (
                    <TableRow key={pharmacist.id}>
                      <TableCell className="min-w-72 align-top">
                        <form
                          action={renameClinicalPharmacistAction}
                          className="flex items-center gap-2"
                        >
                          <input name="pharmacistId" type="hidden" value={pharmacist.id} />
                          <Input
                            aria-label={`Display name for ${pharmacist.displayName}`}
                            className="h-9"
                            defaultValue={pharmacist.displayName}
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
                              pharmacist.active
                                ? "border-brand/25 bg-brand/10 text-brand-foreground"
                                : "border-zinc-500/25 bg-zinc-500/10 text-fg-muted",
                            )}
                          >
                            {pharmacist.active ? "Active" : "Inactive"}
                          </span>
                          <form action={setClinicalPharmacistActiveAction}>
                            <input name="pharmacistId" type="hidden" value={pharmacist.id} />
                            <input
                              name="active"
                              type="hidden"
                              value={String(!pharmacist.active)}
                            />
                            <Button size="sm" type="submit" variant="outline">
                              {pharmacist.active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[420px] align-top">
                        <ul className="space-y-2">
                          {pharmacist.aliases.map((alias) => (
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
                                  <span className="ml-2 text-xs text-brand">
                                    Display name
                                  </span>
                                ) : null}
                              </span>
                              {alias.isDisplayName ? null : (
                                <form
                                  action={removeClinicalPharmacistAliasAction}
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
                          action={addClinicalPharmacistAliasAction}
                          className="mt-2 flex items-center gap-2"
                        >
                          <input name="pharmacistId" type="hidden" value={pharmacist.id} />
                          <Input
                            aria-label={`New spelling for ${pharmacist.displayName}`}
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
                        {formatInteger(pharmacist.qaErrorRecords)}
                      </TableCell>
                      <TableCell className="text-right align-top font-mono text-fg-tertiary">
                        {formatInteger(pharmacist.workloadRecords)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-tint/10 bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-fg-strong">
              <SearchX aria-hidden="true" className="h-5 w-5 text-warning" />
              Unmatched Names in Clinical QA
            </CardTitle>
            <CardDescription>
              Names in imported Clinical QA records that match no pharmacist. They are not
              counted anywhere until you link them to a pharmacist or add them as a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roster.unmatchedNames.length === 0 ? (
              <p className="rounded-md border border-dashed border-tint/10 px-4 py-6 text-center text-sm text-fg-subtle">
                Every Clinical QA name is linked to a pharmacist.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-tint/10">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name in QA records</TableHead>
                      <TableHead className="text-right">QA rows</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Link to pharmacist</TableHead>
                      <TableHead className="text-right">Or</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.unmatchedNames.map((unmatched) => (
                      <TableRow key={unmatched.pharmacistName}>
                        <TableCell className="font-medium text-fg-secondary">
                          {unmatched.pharmacistName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-fg-tertiary">
                          {formatInteger(unmatched.records)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-fg-muted">
                          {formatDay(unmatched.firstDay)} – {formatDay(unmatched.lastDay)}
                        </TableCell>
                        <TableCell>
                          <form
                            action={addClinicalPharmacistAliasAction}
                            className="flex items-center gap-2"
                          >
                            <input
                              name="alias"
                              type="hidden"
                              value={unmatched.pharmacistName}
                            />
                            <select
                              aria-label={`Pharmacist for ${unmatched.pharmacistName}`}
                              className="h-9 rounded-md border border-field-line bg-field-soft px-2 text-sm text-fg-secondary"
                              name="pharmacistId"
                              required
                            >
                              {roster.pharmacists.map((pharmacist) => (
                                <option key={pharmacist.id} value={pharmacist.id}>
                                  {pharmacist.displayName}
                                  {pharmacist.active ? "" : " (inactive)"}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" type="submit" variant="outline">
                              Link
                            </Button>
                          </form>
                        </TableCell>
                        <TableCell className="text-right">
                          <form action={createClinicalPharmacistAction}>
                            <input
                              name="displayName"
                              type="hidden"
                              value={unmatched.pharmacistName}
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Add as new pharmacist
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
      </main>
    </PlatformShell>
  );
}
