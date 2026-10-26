import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type Role,
  type SessionPayload,
} from "./jwt";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Guard untuk Server Component / Server Action / Route Handler.
 * Proxy hanya pemeriksaan optimistis — otorisasi sesungguhnya WAJIB di sini.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles.length > 0 && !roles.includes(session.role)) redirect("/forbidden");
  return session;
}
