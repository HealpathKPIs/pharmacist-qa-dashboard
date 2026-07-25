import type { AuditType } from "@/lib/audit-types";

export const APP_ROLES = [
  "admin",
  "clinical_manager",
  "non_medical_manager",
  "doctors_manager",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type UserProfile = {
  active: boolean;
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  role: AppRole;
  updatedAt: string;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  clinical_manager: "Clinical Manager",
  doctors_manager: "Doctors Manager",
  non_medical_manager: "Non-Medical Manager",
};

export const ROLE_MODULES: Record<AppRole, AuditType | null> = {
  admin: null,
  clinical_manager: "clinical",
  doctors_manager: "doctors",
  non_medical_manager: "non_medical",
};

export const MODULE_LABELS: Record<AuditType, string> = {
  clinical: "Clinical QA",
  doctors: "Doctors QA",
  non_medical: "Non-Medical QA",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function getRoleHomePath(role: AppRole) {
  switch (role) {
    case "admin":
      return "/executive";
    case "clinical_manager":
      return "/";
    case "non_medical_manager":
      return "/non-medical";
    case "doctors_manager":
      return "/doctors";
  }
}

export function canAccessModule(role: AppRole, auditType: AuditType) {
  return role === "admin" || ROLE_MODULES[role] === auditType;
}

export function canAccessPath(role: AppRole, pathname: string) {
  if (pathname === "/access-denied") {
    return true;
  }

  if (role === "admin") {
    return true;
  }

  return pathname === getRoleHomePath(role);
}

export function getModuleLabelForRole(role: AppRole) {
  const assignedModule = ROLE_MODULES[role];

  return assignedModule ? MODULE_LABELS[assignedModule] : "All modules";
}
