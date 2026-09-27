import { Pill, Users } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { SettingsForms } from "@/components/settings/settings-forms";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-server";
import { isPrimaryAdmin } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export default async function SettingsPage() {
  const profile = await requireAdmin();

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-brand">Admin controls</p>
            <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
              Settings
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-fg-muted">
              Manage dashboard access, appearance, and the current signed-in session.
            </p>
          </div>
          {isPrimaryAdmin(profile) ? (
            <Card className="border-tint/10 bg-surface shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-fg-strong">
                  <Users aria-hidden="true" className="h-5 w-5 text-brand" />
                  Users Management
                </CardTitle>
                <CardDescription>
                  Create users, edit accounts, reset passwords, and assign
                  accessible QA modules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  className={cn(buttonVariants(), "inline-flex")}
                  href="/settings/users"
                >
                  Manage Users
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <Card className="border-tint/10 bg-surface shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-fg-strong">
                <Pill aria-hidden="true" className="h-5 w-5 text-brand" />
                Clinical Pharmacists
              </CardTitle>
              <CardDescription>
                Add, rename, activate or deactivate Clinical pharmacists and manage their
                spellings. Applies to Clinical QA only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={cn(buttonVariants(), "inline-flex")}
                href="/settings/clinical-pharmacists"
              >
                Manage Clinical Pharmacists
              </Link>
            </CardContent>
          </Card>
          <AppearanceCard />
          <SettingsForms />
        </section>
      </main>
    </AppShell>
  );
}
