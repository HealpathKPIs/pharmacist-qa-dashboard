"use server";

import { redirect } from "next/navigation";

import { bootstrapPrimaryAdmin } from "@/lib/legacy-admin-bootstrap";
import {
  getProfileHomePath,
  isAppRole,
  parseAccessibleModules,
  PRIMARY_ADMIN_EMAIL,
} from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function login(formData: FormData) {
  const emailValue = formData.get("email");
  const password = formData.get("password");

  if (typeof emailValue !== "string" || typeof password !== "string") {
    redirect("/login?error=invalid");
  }

  const email = emailValue.trim().toLocaleLowerCase("en-US");
  const supabase = await createSupabaseServerClient();
  let signInResult = await supabase.auth.signInWithPassword({ email, password });

  if (
    signInResult.error &&
    email === PRIMARY_ADMIN_EMAIL &&
    (await bootstrapPrimaryAdmin(password))
  ) {
    signInResult = await supabase.auth.signInWithPassword({ email, password });
  }

  if (signInResult.error || !signInResult.data.user) {
    redirect("/login?error=invalid");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("accessible_modules, active, role")
    .eq("id", signInResult.data.user.id)
    .maybeSingle();

  if (!profile || !profile.active || !isAppRole(profile.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=disabled");
  }

  const lastLogin = new Date().toISOString();
  const adminClient = getSupabaseAdminClient();

  await adminClient
    .from("profiles")
    .update({ last_login: lastLogin, updated_at: lastLogin })
    .eq("id", signInResult.data.user.id);

  redirect(
    getProfileHomePath({
      accessibleModules: parseAccessibleModules(profile.accessible_modules),
      role: profile.role,
    }),
  );
}
