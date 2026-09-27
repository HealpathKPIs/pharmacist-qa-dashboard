import Link from "next/link";
import { ShieldX } from "lucide-react";

import { logout } from "@/app/auth-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ForbiddenView({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-lg border-tint/10 bg-surface text-center">
        <CardHeader className="items-center space-y-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger-strong">
            <ShieldX aria-hidden="true" className="h-7 w-7" />
          </span>
          <CardTitle className="text-2xl text-fg-strong">403 · Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-fg-muted">
            Your role does not have permission to view this page. Contact an
            administrator if you believe your access should be changed.
          </p>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Link className={cn(buttonVariants(), "inline-flex")} href={homeHref}>
              Return to your dashboard
            </Link>
            <form action={logout}>
              <Button className="w-full" type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
