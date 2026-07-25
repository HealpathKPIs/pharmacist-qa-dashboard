import { Users } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
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
            <p className="text-sm text-emerald-300">Admin controls</p>
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Settings
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Manage dashboard access and the current signed-in session.
            </p>
          </div>
          {isPrimaryAdmin(profile) ? (
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users aria-hidden="true" className="h-5 w-5 text-emerald-300" />
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
          <SettingsForms />
        </section>
      </main>
    </AppShell>
  );
}
