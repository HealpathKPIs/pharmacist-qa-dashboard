"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePrimaryAdmin } from "@/lib/auth-server";
import type { AuditType } from "@/lib/audit-types";
import {
  isAppRole,
  parseAccessibleModules,
  PRIMARY_ADMIN_EMAIL,
} from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const USERS_PATH = "/settings/users";

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function moduleFields(formData: FormData) {
  return parseAccessibleModules(formData.getAll("modules"));
}

function finish(
  message: string,
  type: "error" | "success" = "success",
): never {
  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?${type}=${encodeURIComponent(message)}`);
}

export async function createUserAction(formData: FormData) {
  await requirePrimaryAdmin();

  const fullName = textField(formData, "fullName");
  const email = textField(formData, "email").toLocaleLowerCase("en-US");
  const password = textField(formData, "password");
  const role = textField(formData, "role");
  const requestedModules = moduleFields(formData);
  const accessibleModules: AuditType[] =
    role === "admin"
      ? ["clinical", "non_medical", "doctors"]
      : requestedModules;

  if (
    !fullName ||
    !email ||
    email === PRIMARY_ADMIN_EMAIL ||
    password.length < 8 ||
    !isAppRole(role) ||
    (role === "manager" && accessibleModules.length === 0)
  ) {
    finish(
      "Enter a name, a unique email, an 8+ character password, and at least one module.",
      "error",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    finish(error?.message ?? "The user could not be created.", "error");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    accessible_modules: accessibleModules,
    active: true,
    email,
    full_name: fullName,
    id: data.user.id,
    role,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    finish(
      "The authentication user was rolled back because its profile could not be saved.",
      "error",
    );
  }

  finish(`${fullName} was created as ${role === "admin" ? "an Admin" : "a Manager"}.`);
}

export async function updateUserAction(formData: FormData) {
  await requirePrimaryAdmin();

  const userId = textField(formData, "userId");
  const fullName = textField(formData, "fullName");
  const email = textField(formData, "email").toLocaleLowerCase("en-US");
  const requestedRole = textField(formData, "role");
  const requestedModules = moduleFields(formData);

  if (!userId || !fullName || !email) {
    finish("Full name and email are required.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { data: currentProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileLookupError || !currentProfile) {
    finish("The user profile could not be found.", "error");
  }

  const isPrimaryAccount =
    currentProfile.email.toLocaleLowerCase("en-US") === PRIMARY_ADMIN_EMAIL;
  const role = isPrimaryAccount ? "admin" : requestedRole;
  const accessibleModules: AuditType[] = role === "admin"
    ? ["clinical", "non_medical", "doctors"]
    : requestedModules;
  const resolvedEmail = isPrimaryAccount ? PRIMARY_ADMIN_EMAIL : email;

  if (
    !isAppRole(role) ||
    (role === "manager" && accessibleModules.length === 0)
  ) {
    finish("Managers must have at least one accessible module.", "error");
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    email: resolvedEmail,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) {
    finish(authError.message, "error");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      accessible_modules: [...accessibleModules],
      email: resolvedEmail,
      full_name: fullName,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    finish(error.message, "error");
  }

  finish("User details and access were updated.");
}

export async function setUserActiveAction(formData: FormData) {
  const currentAdmin = await requirePrimaryAdmin();
  const userId = textField(formData, "userId");
  const active = textField(formData, "active") === "true";

  if (!userId) {
    finish("A user is required.", "error");
  }

  if (userId === currentAdmin.id && !active) {
    finish("The primary Admin account cannot be disabled.", "error");
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

export async function resetPasswordAction(formData: FormData) {
  await requirePrimaryAdmin();

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
