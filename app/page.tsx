import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full border-white/10 bg-white/[0.04] shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Pharmacist QA Dashboard
            </CardTitle>
            <CardDescription>
              Use the navigation to access available dashboard tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Upload Data is ready as a UI-only workspace for the next phase.
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
