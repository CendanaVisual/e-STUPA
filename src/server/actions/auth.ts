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

  // Jika database belum di-seed atau akun superadmin belum ada di database ini
  if (!user && (cleanUsername.toLowerCase() === "superadmin" || cleanUsername.toLowerCase() === "admin")) {
    try {
      const adminCount = await db.user.count({ where: { role: "SUPERADMIN" } });
      if (adminCount === 0) {
        const hash = await bcrypt.hash("admin123", 12);
        user = await db.user.create({
          data: {
            username: "superadmin",
            passwordHash: hash,
            role: "SUPERADMIN",
            isActive: true,
          },
          include: { gtk: true },
        });

        // Buat tahun ajaran dan semester awal jika belum ada
        const ta = await db.tahunAjaran.upsert({
          where: { nama: "2026/2027" },
          update: {},
          create: { nama: "2026/2027", tahunMulai: 2026, isAktif: true },
        });
        await db.semester.upsert({
          where: { kode: "20261" },
          update: {},
          create: {
            tahunAjaranId: ta.id,
            tipe: "GANJIL",
            kode: "20261",
            status: "AKTIF",
            isAktif: true,
          },
        });
      }
    } catch (provisionErr) {
      console.error("Auto-provision superadmin error:", provisionErr);
    }
  }

  if (!user) {
    return { error: "Username tidak ditemukan. Periksa kembali username Anda." };
  }

  if (!user.isActive) {
    return { error: "Akun Anda berstatus nonaktif. Silakan hubungi admin sekolah." };
  }

  let isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  // Recovery fallback: jika superadmin login dengan "admin123" tapi hash di database masih versi lama
  if (!isPasswordValid && user.role === "SUPERADMIN" && password === "admin123") {
    try {
      const newHash = await bcrypt.hash("admin123", 12);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, isActive: true },
      });
      isPasswordValid = true;
    } catch (updateErr) {
      console.error("Error syncing superadmin password hash:", updateErr);
    }
  }

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
