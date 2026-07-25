import "server-only";

import { forbidden, redirect } from "next/navigation";

import type { AuditType } from "@/lib/audit-types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  canAccessModule,
  isAppRole,
  isPrimaryAdmin,
  parseAccessibleModules,
  type AppRole,
  type UserProfile,
} from "@/lib/rbac";

type ProfileRow = {
  accessible_modules: string[];
  active: boolean;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  last_login: string | null;
  role: string;
  updated_at: string;
};

function toUserProfile(row: ProfileRow): UserProfile | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  return {
    accessibleModules: parseAccessibleModules(row.accessible_modules),
    active: row.active,
    createdAt: row.created_at,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    lastLogin: row.last_login,
    role: row.role,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "accessible_modules, active, created_at, email, full_name, id, last_login, role, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toUserProfile(data);
}

export async function requireCurrentProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.active) {
    forbidden();
  }

  return profile;
}

export async function requireRole(role: AppRole) {
  const profile = await requireCurrentProfile();

  if (profile.role !== role) {
    forbidden();
  }

  return profile;
}

export async function requireAdmin() {
  return requireRole("admin");
}

export async function requirePrimaryAdmin() {
  const profile = await requireAdmin();

  if (!isPrimaryAdmin(profile)) {
    forbidden();
  }

  return profile;
}

export async function requireModuleAccess(auditType: AuditType) {
  const profile = await requireCurrentProfile();

  if (!canAccessModule(profile, auditType)) {
    forbidden();
  }

  return profile;
}
