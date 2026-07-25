import { ForbiddenView } from "@/components/auth/forbidden-view";
import { getCurrentProfile } from "@/lib/auth-server";
import { getRoleHomePath } from "@/lib/rbac";

export default async function AccessDeniedPage() {
  const profile = await getCurrentProfile();

  return (
    <ForbiddenView homeHref={profile ? getRoleHomePath(profile.role) : "/login"} />
  );
}
