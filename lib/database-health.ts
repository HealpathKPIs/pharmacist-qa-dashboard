import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AuditType } from "@/lib/audit-types";

export type DatabaseHealthCheck = {
  ok: boolean;
  error?: string;
};

export async function checkDatabaseHealth(
  auditType: AuditType,
): Promise<DatabaseHealthCheck> {
  const { error } = await getSupabaseAdminClient()
    .from("upload_batches")
    .select("id", { count: "exact", head: true })
    .eq("audit_type", auditType);

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return { ok: true };
}
