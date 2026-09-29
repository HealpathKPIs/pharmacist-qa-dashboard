import { AppShell } from "@/components/layout/app-shell";
import type { NonMedicalAgentRosterState } from "@/components/upload/non-medical-agent-report";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { requireAdmin } from "@/lib/auth-server";
import { getNonMedicalRosterForMatching } from "@/lib/non-medical-roster";

export const dynamic = "force-dynamic";

async function loadAgentRoster(): Promise<NonMedicalAgentRosterState> {
  try {
    return { error: null, roster: await getNonMedicalRosterForMatching() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error.",
      roster: null,
    };
  }
}

export default async function NonMedicalUploadPage() {
  await requireAdmin();
  const agentRoster = await loadAgentRoster();

  return (
    <AppShell auditType="non_medical">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-fg-strong">
              Non-Medical QA Upload
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-fg-muted">
              Validate and import the official 12-column Non-Medical QA workbook.
            </p>
          </div>
          <UploadDropzone agentRoster={agentRoster} auditType="non_medical" />
        </section>
      </main>
    </AppShell>
  );
}
