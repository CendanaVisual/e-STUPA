"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth/session";

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { username, password } = parsed.data;
  const user = await db.user.findUnique({ where: { username }, include: { gtk: true } });
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return { error: "Username atau password salah" };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    gtkId: user.gtkId,
    nama: user.gtk?.nama ?? user.username,
  });

  redirect(user.role === "SUPERADMIN" ? "/admin" : "/guru");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
