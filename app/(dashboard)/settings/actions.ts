"use server";

import { redirect } from "next/navigation";

import type { SettingsActionState } from "@/app/(dashboard)/settings/state";
import { requireAdmin } from "@/lib/auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function changePassword(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const profile = await requireAdmin();
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return {
      message: "Enter your current password and the new password.",
      status: "error",
    };
  }

  if (newPassword.length < 8) {
    return {
      message: "Use at least 8 characters for the new password.",
      status: "error",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      message: "The new password and confirmation do not match.",
      status: "error",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (signInError) {
    return {
      message: "The current password is incorrect.",
      status: "error",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return {
      message: error.message,
      status: "error",
    };
  }

  return {
    message: "Password updated. Use the new password the next time you sign in.",
    status: "success",
  };
}

export async function logout() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect("/login");
}
