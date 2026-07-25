"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-server";
import { isAppRole } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function finish(
  message: string,
  type: "error" | "success" = "success",
): never {
  revalidatePath("/users");
  redirect(`/users?${type}=${encodeURIComponent(message)}`);
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const fullName = textField(formData, "fullName");
  const email = textField(formData, "email").toLocaleLowerCase("en-US");
  const password = textField(formData, "password");
  const role = textField(formData, "role");

  if (!fullName || !email || password.length < 8 || !isAppRole(role)) {
    finish("Enter a name, valid email, role, and temporary password of 8+ characters.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error || !data.user) {
    finish(error?.message ?? "The user could not be created.", "error");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    active: true,
    email,
    full_name: fullName,
    id: data.user.id,
    role,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    finish("The authentication user was rolled back because its profile could not be saved.", "error");
  }

  finish(`${fullName} was created.`);
}

export async function setUserActiveAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const userId = textField(formData, "userId");
  const active = textField(formData, "active") === "true";

  if (!userId) {
    finish("A user is required.", "error");
  }

  if (userId === currentAdmin.id && !active) {
    finish("You cannot disable your own account.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });

  if (authError) {
    finish(authError.message, "error");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    finish(error.message, "error");
  }

  finish(active ? "User enabled." : "User disabled.");
}

export async function updateUserRoleAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const userId = textField(formData, "userId");
  const role = textField(formData, "role");

  if (!userId || !isAppRole(role)) {
    finish("Select a valid role.", "error");
  }

  if (userId === currentAdmin.id && role !== "admin") {
    finish("You cannot remove your own administrator role.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    finish(error.message, "error");
  }

  finish("User role updated.");
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();

  const userId = textField(formData, "userId");
  const password = textField(formData, "password");

  if (!userId || password.length < 8) {
    finish("Enter a temporary password of at least 8 characters.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    finish(error.message, "error");
  }

  finish("The temporary password was set.");
}
