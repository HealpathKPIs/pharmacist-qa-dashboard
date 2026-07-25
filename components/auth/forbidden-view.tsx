import Link from "next/link";
import { ShieldX } from "lucide-react";

import { logout } from "@/app/auth-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ForbiddenView({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090a] px-6 py-12 text-zinc-100">
      <Card className="w-full max-w-lg border-white/10 bg-white/[0.04] text-center">
        <CardHeader className="items-center space-y-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-red-300/20 bg-red-300/10 text-red-200">
            <ShieldX aria-hidden="true" className="h-7 w-7" />
          </span>
          <CardTitle className="text-2xl text-white">403 · Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-zinc-400">
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
