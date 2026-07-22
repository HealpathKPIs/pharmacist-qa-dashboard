import { AuditUploadHistoryPage } from "@/components/upload/upload-history-page";

export const dynamic = "force-dynamic";

export default function NonMedicalUploadHistoryPage() {
  return <AuditUploadHistoryPage auditType="non_medical" />;
}
