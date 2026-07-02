import { AlertCircle } from "lucide-react";

import { login } from "@/app/login/actions";
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

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Pharmacist QA Dashboard</CardTitle>
          <CardDescription>Secure access</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            {hasError ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>
                  The password you entered is incorrect.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                required
                type="password"
              />
            </div>
            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
