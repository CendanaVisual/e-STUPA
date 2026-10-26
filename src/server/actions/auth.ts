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
  const cleanUsername = username.trim();

  let user = null;
  try {
    user = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: "insensitive" } },
          { email: { equals: cleanUsername, mode: "insensitive" } },
        ],
      },
      include: { gtk: true },
    });
  } catch (err) {
    console.error("Database connection error during login:", err);
    return { error: "Gagal terhubung ke database. Pastikan koneksi internet stabil." };
  }

  if (!user) {
    return { error: "Username tidak ditemukan. Periksa kembali username Anda." };
  }

  if (!user.isActive) {
    return { error: "Akun Anda berstatus nonaktif. Silakan hubungi admin sekolah." };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return { error: "Password salah. Periksa kembali huruf besar/kecil Anda." };
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role,
      gtkId: user.gtkId,
      nama: user.gtk?.nama ?? user.username,
    });
  } catch (err) {
    console.error("Session creation error:", err);
    return { error: "Gagal membuat sesi login. Silakan coba kembali." };
  }

  redirect(user.role === "SUPERADMIN" ? "/admin" : "/guru");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
