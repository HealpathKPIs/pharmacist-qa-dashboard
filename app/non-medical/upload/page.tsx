import { AppShell } from "@/components/layout/app-shell";
import { UploadDropzone } from "@/components/upload/upload-dropzone";

export default function NonMedicalUploadPage() {
  return (
    <AppShell auditType="non_medical">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Non-Medical QA Upload
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Validate and import the official 12-column Non-Medical QA workbook.
            </p>
          </div>
          <UploadDropzone auditType="non_medical" />
        </section>
      </main>
    </AppShell>
  );
}
