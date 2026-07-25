import type { AuditType } from "@/lib/audit-types";

import { PlatformShell } from "./platform-shell";

export function AppShell({
  auditType = "clinical",
  children,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
}) {
  return <PlatformShell auditType={auditType}>{children}</PlatformShell>;
}
