import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";

import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserRoleAction,
} from "@/app/users/actions";
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
  APP_ROLES,
  getModuleLabelForRole,
  ROLE_LABELS,
  type AppRole,
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

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = getSupabaseAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("active, created_at, email, full_name, id, role, updated_at")
    .order("full_name");

  return (
    <PlatformShell>
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm text-emerald-300">Administration</p>
          <h1 className="text-3xl font-semibold tracking-normal text-white">Users</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Create platform users and control their role, module, and account status.
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
              Create user
            </CardTitle>
            <CardDescription>
              Share the temporary password with the user through a secure channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={createUserAction}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            >
              <Input name="fullName" placeholder="Full name" required />
              <Input name="email" placeholder="Email" required type="email" />
              <Input
                minLength={8}
                name="password"
                placeholder="Temporary password"
                required
                type="password"
              />
              <select
                className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-zinc-200"
                defaultValue="clinical_manager"
                name="role"
              >
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Button type="submit">Create user</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Platform users</CardTitle>
            <CardDescription>
              Managers are read-only and limited to the module assigned by their role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(profiles ?? []).map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium text-zinc-200">
                        {profile.full_name}
                      </TableCell>
                      <TableCell className="text-zinc-400">{profile.email}</TableCell>
                      <TableCell>
                        <form action={updateUserRoleAction} className="flex gap-2">
                          <input name="userId" type="hidden" value={profile.id} />
                          <select
                            aria-label={`Role for ${profile.full_name}`}
                            className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-sm text-zinc-200"
                            defaultValue={profile.role}
                            name="role"
                          >
                            {APP_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                          <Button size="sm" type="submit" variant="outline">
                            Save
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-zinc-400">
                        {getModuleLabelForRole(profile.role as AppRole)}
                      </TableCell>
                      <TableCell>
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
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <form
                            action={resetPasswordAction}
                            className="flex items-center gap-2"
                          >
                            <input name="userId" type="hidden" value={profile.id} />
                            <Input
                              aria-label={`Temporary password for ${profile.full_name}`}
                              className="h-8 w-40"
                              minLength={8}
                              name="password"
                              placeholder="Temporary password"
                              required
                              type="password"
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Reset password
                            </Button>
                          </form>
                          <form action={setUserActiveAction}>
                            <input
                              name="active"
                              type="hidden"
                              value={String(!profile.active)}
                            />
                            <input name="userId" type="hidden" value={profile.id} />
                            <Button size="sm" type="submit" variant="outline">
                              {profile.active ? "Disable" : "Enable"}
                            </Button>
                          </form>
                        </div>
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
