import { AppShell } from "@/components/layout/app-shell";
import { SettingsForms } from "@/components/settings/settings-forms";

export default function SettingsPage() {
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
          <SettingsForms />
        </section>
      </main>
    </AppShell>
  );
}
