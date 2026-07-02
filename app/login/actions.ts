"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";

const INVALID_LOGIN_REDIRECT = `${LOGIN_PATH}?error=invalid`;

export async function login(formData: FormData) {
  const password = formData.get("password");

  if (typeof password !== "string") {
    redirect(INVALID_LOGIN_REDIRECT);
  }

  const isValidPassword = await verifyPassword(password);

  if (!isValidPassword) {
    redirect(INVALID_LOGIN_REDIRECT);
  }

  const sessionToken = await createSessionToken();

  if (!sessionToken) {
    redirect(INVALID_LOGIN_REDIRECT);
  }

  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(DASHBOARD_PATH);
}
