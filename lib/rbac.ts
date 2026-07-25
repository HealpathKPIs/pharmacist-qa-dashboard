import {
  AUDIT_MODULES,
  AUDIT_TYPES,
  getAuditPath,
  type AuditType,
} from "@/lib/audit-types";

export const PRIMARY_ADMIN_EMAIL = "ahmedramadan@healpath.care";
export const APP_ROLES = ["admin", "manager"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type UserProfile = {
  accessibleModules: AuditType[];
  active: boolean;
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  lastLogin: string | null;
  role: AppRole;
  updatedAt: string;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
};

export const MODULE_LABELS: Record<AuditType, string> = {
  clinical: "Clinical QA",
  doctors: "Doctors QA",
  non_medical: "Non-Medical QA",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function parseAccessibleModules(value: unknown): AuditType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return AUDIT_TYPES.filter((auditType) => value.includes(auditType));
}

export function getEffectiveModules(profile: Pick<UserProfile, "accessibleModules" | "role">) {
  return profile.role === "admin" ? [...AUDIT_TYPES] : profile.accessibleModules;
}

export function getProfileHomePath(
  profile: Pick<UserProfile, "accessibleModules" | "role">,
) {
  if (profile.role === "admin") {
    return "/executive";
  }

  const [firstModule] = getEffectiveModules(profile);

  return firstModule ? getAuditPath(firstModule) : "/access-denied";
}

export function canAccessModule(
  profile: Pick<UserProfile, "accessibleModules" | "role">,
  auditType: AuditType,
) {
  return getEffectiveModules(profile).includes(auditType);
}

export function canAccessPath(
  profile: Pick<UserProfile, "accessibleModules" | "role">,
  pathname: string,
) {
  if (pathname === "/access-denied") {
    return true;
  }

  if (profile.role === "admin") {
    return true;
  }

  return getEffectiveModules(profile).some(
    (auditType) => pathname === getAuditPath(auditType),
  );
}

export function getModuleLabels(
  profile: Pick<UserProfile, "accessibleModules" | "role">,
) {
  return getEffectiveModules(profile)
    .map((auditType) => AUDIT_MODULES[auditType].moduleLabel)
    .join(", ");
}

export function isPrimaryAdmin(
  profile: Pick<UserProfile, "email" | "role">,
) {
  return (
    profile.role === "admin" &&
    profile.email.toLocaleLowerCase("en-US") === PRIMARY_ADMIN_EMAIL
  );
}
