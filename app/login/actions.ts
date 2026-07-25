"use server";

import { redirect } from "next/navigation";

import { getRoleHomePath, isAppRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    redirect("/login?error=invalid");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !profile.active || !isAppRole(profile.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=disabled");
  }

  redirect(getRoleHomePath(profile.role));
}
