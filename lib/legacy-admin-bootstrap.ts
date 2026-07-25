import "server-only";

import { PRIMARY_ADMIN_EMAIL } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type StoredPasswordConfig = {
  algorithm: "pbkdf2-sha256";
  hash: string;
  iterations: number;
  salt: string;
};

const ADMIN_PASSWORD_SETTING_KEY = "admin_password";
const encoder = new TextEncoder();

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

function isStoredPasswordConfig(value: unknown): value is StoredPasswordConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredPasswordConfig>;

  return (
    candidate.algorithm === "pbkdf2-sha256" &&
    typeof candidate.hash === "string" &&
    typeof candidate.salt === "string" &&
    typeof candidate.iterations === "number"
  );
}

async function verifyStoredPassword(
  password: string,
  config: StoredPasswordConfig,
) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: config.iterations,
      name: "PBKDF2",
      salt: base64UrlDecode(config.salt).slice().buffer,
    },
    keyMaterial,
    256,
  );

  return constantTimeEqual(
    new Uint8Array(bits),
    base64UrlDecode(config.hash),
  );
}

async function verifyLegacyAdminPassword(password: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ADMIN_PASSWORD_SETTING_KEY)
    .maybeSingle();

  if (data?.value) {
    try {
      const config = JSON.parse(data.value) as unknown;

      if (isStoredPasswordConfig(config)) {
        return verifyStoredPassword(password, config);
      }
    } catch {
      return false;
    }
  }

  const configuredPassword = process.env.APP_PASSWORD;

  if (!configuredPassword) {
    return false;
  }

  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(password)),
    crypto.subtle.digest("SHA-256", encoder.encode(configuredPassword)),
  ]);

  return constantTimeEqual(
    new Uint8Array(actualHash),
    new Uint8Array(expectedHash),
  );
}

export async function bootstrapPrimaryAdmin(password: string) {
  if (!(await verifyLegacyAdminPassword(password))) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data: usersPage, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    return false;
  }

  let adminUser = usersPage.users.find(
    (user) =>
      user.email?.toLocaleLowerCase("en-US") === PRIMARY_ADMIN_EMAIL,
  );

  if (adminUser) {
    if (adminUser.app_metadata.requires_password_bootstrap !== true) {
      return false;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      {
        app_metadata: { requires_password_bootstrap: false },
        email: PRIMARY_ADMIN_EMAIL,
        email_confirm: true,
        password,
      },
    );

    if (error) {
      return false;
    }

    adminUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: PRIMARY_ADMIN_EMAIL,
      email_confirm: true,
      password,
      user_metadata: { full_name: "Ahmed Ramadan" },
    });

    if (error || !data.user) {
      return false;
    }

    adminUser = data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    accessible_modules: ["clinical", "non_medical", "doctors"],
    active: true,
    email: PRIMARY_ADMIN_EMAIL,
    full_name: "Ahmed Ramadan",
    id: adminUser.id,
    role: "admin",
    updated_at: new Date().toISOString(),
  });

  return !profileError;
}
