import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";

export const AUTH_COOKIE_NAME = "pharmacist_qa_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  expiresAt: number;
  path: typeof DASHBOARD_PATH;
};

const encoder = new TextEncoder();

function getAppPassword() {
  return process.env.APP_PASSWORD;
}

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

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return new Uint8Array(digest);
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

async function getSigningKey() {
  const password = getAppPassword();

  if (!password) {
    return null;
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string) {
  const key = await getSigningKey();

  if (!key) {
    return null;
  }

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyPassword(password: string) {
  const appPassword = getAppPassword();

  if (!appPassword) {
    return false;
  }

  const [actualHash, expectedHash] = await Promise.all([
    hash(password),
    hash(appPassword),
  ]);

  return constantTimeEqual(actualHash, expectedHash);
}

export async function createSessionToken() {
  const payload: SessionPayload = {
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    path: DASHBOARD_PATH,
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);

  if (!signature) {
    return null;
  }

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await sign(encodedPayload);

  if (!expectedSignature) {
    return false;
  }

  const validSignature = constantTimeEqual(
    encoder.encode(signature),
    encoder.encode(expectedSignature),
  );

  if (!validSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    ) as Partial<SessionPayload>;

    return payload.path === DASHBOARD_PATH && Number(payload.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function isPublicPath(pathname: string) {
  return pathname === LOGIN_PATH;
}
