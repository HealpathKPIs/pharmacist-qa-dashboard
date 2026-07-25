import { AppShell } from "@/components/layout/app-shell";
import { DoctorsTemplateCard } from "@/components/settings/doctors-template-card";
import { SettingsForms } from "@/components/settings/settings-forms";
import { requireAdmin } from "@/lib/auth-server";

export default async function DoctorsSettingsPage() {
  await requireAdmin();

  return (
    <AppShell auditType="doctors">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-emerald-300">Doctors QA controls</p>
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Settings
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Download the Doctors QA template and manage shared authentication.
            </p>
          </div>
          <DoctorsTemplateCard />
          <SettingsForms />
        </section>
      </main>
    </AppShell>
  );
}
