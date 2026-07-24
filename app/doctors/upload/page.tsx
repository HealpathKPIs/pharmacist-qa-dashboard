import { AppShell } from "@/components/layout/app-shell";
import { UploadDropzone } from "@/components/upload/upload-dropzone";

export default function DoctorsUploadPage() {
  return (
    <AppShell auditType="doctors">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Doctors QA Upload
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Validate and import the official eight-column Doctors QA workbook.
            </p>
          </div>
          <UploadDropzone auditType="doctors" />
        </section>
      </main>
    </AppShell>
  );
}
