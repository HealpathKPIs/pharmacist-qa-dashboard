import { AlertCircle, CheckCircle2, UserCog, UserPlus } from "lucide-react";

import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/(dashboard)/settings/users/actions";
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
import { AUDIT_TYPES, type AuditType } from "@/lib/audit-types";
import { requirePrimaryAdmin } from "@/lib/auth-server";
import {
  MODULE_LABELS,
  APP_ROLES,
  parseAccessibleModules,
  PRIMARY_ADMIN_EMAIL,
  ROLE_LABELS,
} from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ModuleCheckboxes({
  defaultModules = [],
  formId,
  idPrefix,
}: {
  defaultModules?: AuditType[];
  formId?: string;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {AUDIT_TYPES.map((auditType) => (
        <label
          className="flex items-center gap-2 text-xs text-zinc-300"
          htmlFor={`${idPrefix}-${auditType}`}
          key={auditType}
        >
          <input
            className="h-4 w-4 accent-emerald-400"
            defaultChecked={defaultModules.includes(auditType)}
            form={formId}
            id={`${idPrefix}-${auditType}`}
            name="modules"
            type="checkbox"
            value={auditType}
          />
          {MODULE_LABELS[auditType]}
        </label>
      ))}
    </div>
  );
}

export default async function UsersManagementPage({
  searchParams,
}: UsersPageProps) {
  await requirePrimaryAdmin();
  const params = await searchParams;
  const supabase = getSupabaseAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "accessible_modules, active, created_at, email, full_name, id, last_login, role, updated_at",
    )
    .order("created_at");

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-emerald-300">Settings</p>
          <h1 className="text-3xl font-semibold tracking-normal text-white">
            Users Management
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            Create users, edit their profiles, and assign one or more read-only
            QA modules to Managers. Admins always receive every module.
          </p>
        </div>

        {params.error || error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            <AlertDescription>
              {params.error ?? error?.message ?? "Users could not be loaded."}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.success ? (
          <Alert className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            <AlertDescription>{params.success}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserPlus aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              Create User
            </CardTitle>
            <CardDescription>
              Accounts can only be created here by {PRIMARY_ADMIN_EMAIL}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUserAction} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Input name="fullName" placeholder="Full name" required />
                <Input name="email" placeholder="Email" required type="email" />
                <Input
                  minLength={8}
                  name="password"
                  placeholder="Initial password"
                  required
                  type="password"
                />
                <select
                  className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-200"
                  defaultValue="manager"
                  name="role"
                >
                  {APP_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-4 rounded-md border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    Accessible Modules
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Select at least one module.
                  </p>
                </div>
                <ModuleCheckboxes idPrefix="create" />
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserCog aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              Platform Users
            </CardTitle>
            <CardDescription>
              Edit identity, role, modules, status, and credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-white/10">
              <Table className="min-w-[1380px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name / Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Accessible Modules</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(profiles ?? []).map((profile) => {
                    const isPrimary =
                      profile.email.toLocaleLowerCase("en-US") ===
                      PRIMARY_ADMIN_EMAIL;
                    const modules = parseAccessibleModules(
                      profile.accessible_modules,
                    );

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="min-w-64 align-top">
                          <form
                            action={updateUserAction}
                            className="space-y-2"
                            id={`edit-${profile.id}`}
                          >
                            <input name="userId" type="hidden" value={profile.id} />
                            <Input
                              aria-label={`Full name for ${profile.email}`}
                              defaultValue={profile.full_name}
                              name="fullName"
                              required
                            />
                            <Input
                              aria-label={`Email for ${profile.full_name}`}
                              defaultValue={profile.email}
                              name="email"
                              readOnly={isPrimary}
                              required
                              type="email"
                            />
                          </form>
                        </TableCell>
                        <TableCell className="align-top">
                          <select
                            className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-sm text-zinc-200"
                            defaultValue={profile.role}
                            disabled={isPrimary}
                            form={`edit-${profile.id}`}
                            name="role"
                          >
                            {(isPrimary ? ["admin"] as const : APP_ROLES).map(
                              (role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ),
                            )}
                          </select>
                          {isPrimary ? (
                            <input
                              form={`edit-${profile.id}`}
                              name="role"
                              type="hidden"
                              value="admin"
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-80 align-top">
                          {isPrimary ? (
                            <p className="text-sm text-zinc-300">
                              Clinical QA, Non-Medical QA, Doctors QA
                            </p>
                          ) : (
                            <div>
                              <ModuleCheckboxes
                                defaultModules={modules}
                                formId={`edit-${profile.id}`}
                                idPrefix={`edit-${profile.id}`}
                              />
                            </div>
                          )}
                          {isPrimary
                            ? AUDIT_TYPES.map((auditType) => (
                                <input
                                  form={`edit-${profile.id}`}
                                  key={auditType}
                                  name="modules"
                                  type="hidden"
                                  value={auditType}
                                />
                              ))
                            : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                              profile.active
                                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                                : "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
                            )}
                          >
                            {profile.active ? "Active" : "Disabled"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top text-zinc-400">
                          {formatDateTime(profile.last_login)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top text-zinc-400">
                          {formatDateTime(profile.created_at)}
                        </TableCell>
                        <TableCell className="min-w-72 align-top">
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              form={`edit-${profile.id}`}
                              size="sm"
                              type="submit"
                            >
                              Save Changes
                            </Button>
                            <form
                              action={resetPasswordAction}
                              className="flex items-center gap-2"
                            >
                              <input
                                name="userId"
                                type="hidden"
                                value={profile.id}
                              />
                              <Input
                                aria-label={`New password for ${profile.full_name}`}
                                className="h-8 w-40"
                                minLength={8}
                                name="password"
                                placeholder="New password"
                                required
                                type="password"
                              />
                              <Button size="sm" type="submit" variant="outline">
                                Reset
                              </Button>
                            </form>
                            {!isPrimary ? (
                              <form action={setUserActiveAction}>
                                <input
                                  name="active"
                                  type="hidden"
                                  value={String(!profile.active)}
                                />
                                <input
                                  name="userId"
                                  type="hidden"
                                  value={profile.id}
                                />
                                <Button size="sm" type="submit" variant="outline">
                                  {profile.active ? "Disable User" : "Enable User"}
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </PlatformShell>
  );
}
