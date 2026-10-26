"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function createUser(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "GURU") as "SUPERADMIN" | "GURU";
  const gtkId = String(formData.get("gtkId") || "").trim() || null;

  if (!username || username.length < 3) return;
  if (!password || password.length < 6) return;

  const existing = await db.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      username,
      passwordHash,
      role,
      gtkId,
      isActive: true,
    },
  });

  revalidatePath("/admin/users");
}

export async function toggleUserStatus(userId: string): Promise<void> {
  await requireRole("SUPERADMIN");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/admin/users");
}

export async function resetUserPassword(userId: string, newPass: string): Promise<void> {
  await requireRole("SUPERADMIN");

  if (!newPass || newPass.length < 6) return;

  const passwordHash = await bcrypt.hash(newPass, 12);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  revalidatePath("/admin/users");
}
