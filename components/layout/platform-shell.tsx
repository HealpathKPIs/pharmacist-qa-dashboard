import type { AuditType } from "@/lib/audit-types";
import { requireCurrentProfile } from "@/lib/auth-server";

import { PlatformShellClient } from "./platform-shell-client";

export async function PlatformShell({
  auditType,
  children,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
}) {
  const profile = await requireCurrentProfile();

  return (
    <PlatformShellClient auditType={auditType} profile={profile}>
      {children}
    </PlatformShellClient>
  );
}
