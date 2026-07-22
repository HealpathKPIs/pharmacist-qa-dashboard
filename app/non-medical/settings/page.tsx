import { AppShell } from "@/components/layout/app-shell";
import { SettingsForms } from "@/components/settings/settings-forms";

export default function NonMedicalSettingsPage() {
  return (
    <AppShell auditType="non_medical">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-emerald-300">Non-Medical QA controls</p>
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Settings
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Manage shared authentication while staying inside the Non-Medical QA product.
            </p>
          </div>
          <SettingsForms />
        </section>
      </main>
    </AppShell>
  );
}
