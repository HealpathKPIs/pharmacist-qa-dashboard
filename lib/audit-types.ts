export const AUDIT_TYPES = ["clinical", "non_medical"] as const;

export type AuditType = (typeof AUDIT_TYPES)[number];

export type AuditModuleConfig = {
  auditType: AuditType;
  basePath: string;
  dashboardTitle: string;
  moduleLabel: string;
  actorLabel: string;
  actorLabelPlural: string;
  workloadLabel: string;
  workloadLabelLower: string;
};

export const AUDIT_MODULES: Record<AuditType, AuditModuleConfig> = {
  clinical: {
    auditType: "clinical",
    basePath: "",
    dashboardTitle: "Pharmacist QA Dashboard",
    moduleLabel: "Clinical QA",
    actorLabel: "Pharmacist",
    actorLabelPlural: "Pharmacists",
    workloadLabel: "Patients",
    workloadLabelLower: "patients",
  },
  non_medical: {
    auditType: "non_medical",
    basePath: "/non-medical",
    dashboardTitle: "Non-Medical QA Dashboard",
    moduleLabel: "Non-Medical QA",
    actorLabel: "Agent",
    actorLabelPlural: "Agents",
    workloadLabel: "Cases Reviewed",
    workloadLabelLower: "cases reviewed",
  },
};

export function isAuditType(value: unknown): value is AuditType {
  return typeof value === "string" && AUDIT_TYPES.includes(value as AuditType);
}

export function getAuditModule(auditType: AuditType) {
  return AUDIT_MODULES[auditType];
}

export function getAuditPath(auditType: AuditType, path = "") {
  const basePath = AUDIT_MODULES[auditType].basePath;

  if (!path) {
    return basePath || "/";
  }

  return `${basePath}${path}`;
}
