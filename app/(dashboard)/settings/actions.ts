"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { SettingsActionState } from "@/app/(dashboard)/settings/state";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/constants";
import { updateAdminPassword } from "@/lib/password-auth";

export async function changePassword(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
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

  const result = await updateAdminPassword(currentPassword, newPassword);

  if (!result.ok) {
    return {
      message: result.error ?? "Password could not be updated.",
      status: "error",
    };
  }

  return {
    message: "Password updated. Use the new password the next time you sign in.",
    status: "success",
  };
}

export async function logout() {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect(LOGIN_PATH);
}
