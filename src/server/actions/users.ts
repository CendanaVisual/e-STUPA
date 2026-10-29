"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export type ActionResponse = {
  success: boolean;
  message: string;
};

/**
 * Buat akun pengguna baru (Guru / Superadmin)
 */
export async function createUser(
  input:
    | FormData
    | {
        username: string;
        password: string;
        role: "SUPERADMIN" | "GURU";
        gtkId?: string | null;
      }
): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    let username = "";
    let password = "";
    let role: "SUPERADMIN" | "GURU" = "GURU";
    let gtkId: string | null = null;

    if (input instanceof FormData) {
      username = String(input.get("username") || "").trim().toLowerCase();
      password = String(input.get("password") || "").trim();
      role = (String(input.get("role") || "GURU") as "SUPERADMIN" | "GURU") || "GURU";
      gtkId = String(input.get("gtkId") || "").trim() || null;
    } else {
      username = String(input.username || "").trim().toLowerCase();
      password = String(input.password || "").trim();
      role = input.role || "GURU";
      gtkId = input.gtkId?.trim() || null;
    }

    if (!username || username.length < 3) {
      return { success: false, message: "Username minimal 3 karakter." };
    }

    // Username format check
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return {
        success: false,
        message: "Username hanya boleh mengandung huruf kecil, angka, titik, strip (-), atau garis bawah (_).",
      };
    }

    if (!password || password.length < 6) {
      return { success: false, message: "Password minimal 6 karakter." };
    }

    // Periksa duplikasi username
    const existingUser = await db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    if (existingUser) {
      return { success: false, message: `Username "${username}" sudah digunakan.` };
    }

    // Jika ditautkan ke GTK, pastikan GTK valid dan belum dipakai akun lain
    if (gtkId) {
      const existingGtkUser = await db.user.findFirst({
        where: { gtkId },
        select: { id: true, username: true },
      });
      if (existingGtkUser) {
        return {
          success: false,
          message: `Data GTK ini sudah ditautkan ke akun "${existingGtkUser.username}".`,
        };
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await db.user.create({
        data: {
          username,
          passwordHash,
          role,
          gtkId,
          isActive: true,
        },
      });
    } catch (createErr: unknown) {
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
      if (errMsg.includes("users_guru_gtk_chk") || (createErr as { code?: string })?.code === "23514") {
        console.log("[createUser] Detected legacy check constraint users_guru_gtk_chk. Auto-healing by dropping constraint...");
        await db.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_guru_gtk_chk";`);
        await db.user.create({
          data: {
            username,
            passwordHash,
            role,
            gtkId,
            isActive: true,
          },
        });
      } else {
        throw createErr;
      }
    }

    revalidatePath("/admin/users");
    return { success: true, message: `Akun "${username}" berhasil dibuat.` };
  } catch (err: unknown) {
    console.error("[createUser Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat akun.",
    };
  }
}

/**
 * Perbarui informasi akun pengguna
 */
export async function updateUser(data: {
  id: string;
  username: string;
  role: "SUPERADMIN" | "GURU";
  gtkId?: string | null;
  isActive?: boolean;
}): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");

    const username = data.username.trim().toLowerCase();
    if (!username || username.length < 3) {
      return { success: false, message: "Username minimal 3 karakter." };
    }

    const targetUser = await db.user.findUnique({
      where: { id: data.id },
    });
    if (!targetUser) {
      return { success: false, message: "Akun tidak ditemukan." };
    }

    // Jika username berubah, periksa duplikasi
    if (username !== targetUser.username.toLowerCase()) {
      const duplicate = await db.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          id: { not: data.id },
        },
      });
      if (duplicate) {
        return { success: false, message: `Username "${username}" sudah digunakan.` };
      }
    }

    // Jika mengubah GTK, periksa apakah GTK sudah dipakai akun lain
    const newGtkId = data.gtkId?.trim() || null;
    if (newGtkId && newGtkId !== targetUser.gtkId) {
      const existingGtkUser = await db.user.findFirst({
        where: { gtkId: newGtkId, id: { not: data.id } },
        select: { id: true, username: true },
      });
      if (existingGtkUser) {
        return {
          success: false,
          message: `Data GTK ini sudah ditautkan ke akun "${existingGtkUser.username}".`,
        };
      }
    }

    // Proteksi: jangan sampai superadmin saat ini menonaktifkan akun sendiri atau mengubah role sendiri menjadi non-admin
    if (session.userId === data.id) {
      if (data.role !== "SUPERADMIN") {
        return { success: false, message: "Anda tidak dapat mengubah peran akun Anda sendiri dari SUPERADMIN." };
      }
      if (data.isActive === false) {
        return { success: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang login." };
      }
    }

    try {
      await db.user.update({
        where: { id: data.id },
        data: {
          username,
          role: data.role,
          gtkId: newGtkId,
          isActive: data.isActive !== undefined ? data.isActive : targetUser.isActive,
        },
      });
    } catch (updateErr: unknown) {
      const errMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
      if (errMsg.includes("users_guru_gtk_chk") || (updateErr as { code?: string })?.code === "23514") {
        console.log("[updateUser] Detected legacy check constraint users_guru_gtk_chk. Auto-healing by dropping constraint...");
        await db.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_guru_gtk_chk";`);
        await db.user.update({
          where: { id: data.id },
          data: {
            username,
            role: data.role,
            gtkId: newGtkId,
            isActive: data.isActive !== undefined ? data.isActive : targetUser.isActive,
          },
        });
      } else {
        throw updateErr;
      }
    }

    revalidatePath("/admin/users");
    return { success: true, message: `Akun "${username}" berhasil diperbarui.` };
  } catch (err: unknown) {
    console.error("[updateUser Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui akun.",
    };
  }
}

/**
 * Toggle status aktif / nonaktif pengguna
 */
export async function toggleUserStatus(input: FormData | string): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");

    const userId = typeof input === "string" ? input : String(input.get("userId") || "");
    if (!userId) return { success: false, message: "ID akun tidak valid." };

    if (session.userId === userId) {
      return { success: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "Akun tidak ditemukan." };

    const newStatus = !user.isActive;
    await db.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
    });

    revalidatePath("/admin/users");
    return {
      success: true,
      message: `Akun "${user.username}" berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  } catch (err: unknown) {
    console.error("[toggleUserStatus Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mengubah status akun.",
    };
  }
}

/**
 * Reset kata sandi pengguna
 */
export async function resetUserPassword(userId: string, newPass: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!userId) return { success: false, message: "ID akun tidak valid." };
    if (!newPass || newPass.length < 6) {
      return { success: false, message: "Password baru minimal 6 karakter." };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "Akun tidak ditemukan." };

    const passwordHash = await bcrypt.hash(newPass, 12);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    revalidatePath("/admin/users");
    return { success: true, message: `Password untuk akun "${user.username}" berhasil direset.` };
  } catch (err: unknown) {
    console.error("[resetUserPassword Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mereset password.",
    };
  }
}

/**
 * Hapus akun pengguna
 */
export async function deleteUser(userId: string): Promise<ActionResponse> {
  try {
    const session = await requireRole("SUPERADMIN");

    if (!userId) return { success: false, message: "ID akun tidak valid." };

    if (session.userId === userId) {
      return { success: false, message: "Anda tidak dapat menghapus akun Anda sendiri." };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "Akun tidak ditemukan." };

    // Proteksi: jangan sampai menghapus superadmin terakhir
    if (user.role === "SUPERADMIN") {
      const superadminCount = await db.user.count({ where: { role: "SUPERADMIN" } });
      if (superadminCount <= 1) {
        return { success: false, message: "Tidak dapat menghapus satu-satunya akun Superadmin di sistem." };
      }
    }

    await db.user.delete({ where: { id: userId } });

    revalidatePath("/admin/users");
    return { success: true, message: `Akun "${user.username}" berhasil dihapus.` };
  } catch (err: unknown) {
    console.error("[deleteUser Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus akun.",
    };
  }
}

/**
 * Otomatis buatkan akun guru untuk semua GTK aktif yang belum punya akun
 */
export async function autoGenerateTeacherAccounts(defaultPassword = "guru123456"): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const gtksWithoutUser = await db.gtk.findMany({
      where: {
        isAktif: true,
        user: null,
      },
      orderBy: { nama: "asc" },
    });

    if (gtksWithoutUser.length === 0) {
      return { success: false, message: "Semua GTK aktif sudah memiliki akun login." };
    }

    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    let createdCount = 0;

    for (const gtk of gtksWithoutUser) {
      // Buat username dari nama panggilan atau nuptk/nip
      let baseUsername = "";
      if (gtk.nuptk) {
        baseUsername = `guru.${gtk.nuptk.slice(-6)}`;
      } else if (gtk.nip) {
        baseUsername = `guru.${gtk.nip.slice(-6)}`;
      } else {
        const cleanName = gtk.nama
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ".")
          .split(".")
          .filter(Boolean)
          .slice(0, 2)
          .join(".");
        baseUsername = cleanName.length >= 3 ? cleanName : `guru.${gtk.id.slice(-4)}`;
      }

      // Pastikan unik
      let finalUsername = baseUsername;
      let counter = 1;
      while (await db.user.findFirst({ where: { username: { equals: finalUsername, mode: "insensitive" } } })) {
        finalUsername = `${baseUsername}${counter}`;
        counter++;
      }

      try {
        await db.user.create({
          data: {
            username: finalUsername,
            passwordHash,
            role: "GURU",
            gtkId: gtk.id,
            isActive: true,
          },
        });
      } catch (autoErr: unknown) {
        const errMsg = autoErr instanceof Error ? autoErr.message : String(autoErr);
        if (errMsg.includes("users_guru_gtk_chk") || (autoErr as { code?: string })?.code === "23514") {
          await db.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_guru_gtk_chk";`);
          await db.user.create({
            data: {
              username: finalUsername,
              passwordHash,
              role: "GURU",
              gtkId: gtk.id,
              isActive: true,
            },
          });
        } else {
          throw autoErr;
        }
      }
      createdCount++;
    }

    revalidatePath("/admin/users");
    return {
      success: true,
      message: `Berhasil membuat ${createdCount} akun guru baru dengan password awal "${defaultPassword}".`,
    };
  } catch (err: unknown) {
    console.error("[autoGenerateTeacherAccounts Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat akun guru otomatis.",
    };
  }
}
