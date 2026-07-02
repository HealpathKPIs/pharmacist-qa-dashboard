import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DatabaseHealthCheck = {
  ok: boolean;
  error?: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  const { error } = await getSupabaseAdminClient()
    .from("upload_batches")
    .select("id", { count: "exact", head: true });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return { ok: true };
}
