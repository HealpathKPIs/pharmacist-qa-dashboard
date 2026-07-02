import { AppShell } from "@/components/layout/app-shell";
import { PreviousUploadsPlaceholder } from "@/components/upload/previous-uploads-placeholder";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { UploadSummaryCard } from "@/components/upload/upload-summary-card";

export default function UploadDataPage() {
  return (
    <AppShell>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-white">
              Upload Data
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Import Excel files to prepare pharmacist QA data for analysis.
            </p>
          </div>
          <UploadDropzone />
          <PreviousUploadsPlaceholder />
        </section>
        <aside className="space-y-6">
          <UploadSummaryCard />
        </aside>
      </main>
    </AppShell>
  );
}
