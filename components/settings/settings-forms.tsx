"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useActionState, useEffect } from "react";

import {
  changePassword,
  logout,
} from "@/app/(dashboard)/settings/actions";
import { initialSettingsActionState } from "@/app/(dashboard)/settings/state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function SettingsForms() {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    changePassword,
    initialSettingsActionState,
  );

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    toast({
      description: state.message,
      title: state.status === "success" ? "Password updated" : "Settings error",
      variant: state.status === "success" ? "success" : "destructive",
    });
  }, [state, toast]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fg-strong">
            <KeyRound aria-hidden="true" className="h-5 w-5 text-brand" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update the single admin password used to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label
                  className="text-sm font-medium text-fg-secondary"
                  htmlFor="currentPassword"
                >
                  Current password
                </label>
                <Input
                  autoComplete="current-password"
                  className="border-field-line bg-field-soft text-fg-strong"
                  id="currentPassword"
                  name="currentPassword"
                  required
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-fg-secondary"
                  htmlFor="newPassword"
                >
                  New password
                </label>
                <Input
                  autoComplete="new-password"
                  className="border-field-line bg-field-soft text-fg-strong"
                  id="newPassword"
                  minLength={8}
                  name="newPassword"
                  required
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-fg-secondary"
                  htmlFor="confirmPassword"
                >
                  Confirm password
                </label>
                <Input
                  autoComplete="new-password"
                  className="border-field-line bg-field-soft text-fg-strong"
                  id="confirmPassword"
                  minLength={8}
                  name="confirmPassword"
                  required
                  type="password"
                />
              </div>
            </div>
            <Button disabled={isPending} type="submit">
              <KeyRound aria-hidden="true" className="h-4 w-4" />
              {isPending ? "Saving" : "Save Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fg-strong">
            <LogOut aria-hidden="true" className="h-5 w-5 text-fg-tertiary" />
            Session
          </CardTitle>
          <CardDescription>End the current dashboard session.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logout}>
            <Button
              className="w-full border-tint/15 bg-tint/5 text-fg-strong hover:bg-tint/10"
              type="submit"
              variant="outline"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
