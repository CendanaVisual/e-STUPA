import { SignJWT, jwtVerify } from "jose";

/**
 * Token sesi (JWT HS256) yang disimpan di cookie httpOnly.
 * Modul ini TIDAK mengimpor Prisma / next/headers sehingga aman dipakai di
 * `src/proxy.ts` maupun di server components.
 */

export const SESSION_COOKIE = "stupa_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 jam

export type Role = "SUPERADMIN" | "GURU";

export interface SessionPayload {
  userId: string;
  username: string;
  role: Role;
  gtkId: string | null;
  nama: string;
}

function getKey() {
  const secret =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
      ? process.env.SESSION_SECRET
      : "stupa_default_session_secret_key_minimum_32_characters_long_2026";
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getKey());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
