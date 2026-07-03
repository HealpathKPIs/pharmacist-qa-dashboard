import "server-only";

import { verifyPassword as verifyEnvPassword } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type StoredPasswordConfig = {
  algorithm: "pbkdf2-sha256";
  hash: string;
  iterations: number;
  salt: string;
};

const ADMIN_PASSWORD_SETTING_KEY = "admin_password";
const PASSWORD_HASH_ITERATIONS = 210000;
const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
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

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations = PASSWORD_HASH_ITERATIONS,
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
      iterations,
      name: "PBKDF2",
      salt: salt.slice().buffer,
    },
    keyMaterial,
    256,
  );

  return new Uint8Array(bits);
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

async function getStoredPasswordConfig() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", ADMIN_PASSWORD_SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return null;
    }

    const parsed = JSON.parse(data.value) as unknown;

    return isStoredPasswordConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function createStoredPasswordConfig(
  password: string,
): Promise<StoredPasswordConfig> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const passwordHash = await derivePasswordHash(password, salt);

  return {
    algorithm: "pbkdf2-sha256",
    hash: base64UrlEncode(passwordHash),
    iterations: PASSWORD_HASH_ITERATIONS,
    salt: base64UrlEncode(salt),
  };
}

async function verifyStoredPassword(
  password: string,
  config: StoredPasswordConfig,
) {
  const actualHash = await derivePasswordHash(
    password,
    base64UrlDecode(config.salt),
    config.iterations,
  );

  return constantTimeEqual(actualHash, base64UrlDecode(config.hash));
}

export async function verifyPassword(password: string) {
  const storedPasswordConfig = await getStoredPasswordConfig();

  if (storedPasswordConfig) {
    return verifyStoredPassword(password, storedPasswordConfig);
  }

  return verifyEnvPassword(password);
}

export async function updateAdminPassword(currentPassword: string, newPassword: string) {
  const isCurrentPasswordValid = await verifyPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return {
      error: "The current password is incorrect.",
      ok: false,
    };
  }

  const passwordConfig = await createStoredPasswordConfig(newPassword);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: ADMIN_PASSWORD_SETTING_KEY,
    updated_at: new Date().toISOString(),
    value: JSON.stringify(passwordConfig),
  });

  if (error) {
    return {
      error:
        "Password settings could not be saved. Apply the latest Supabase migration and try again.",
      ok: false,
    };
  }

  return {
    error: null,
    ok: true,
  };
}
