import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { UsersClient, type UserItem, type GtkItem } from "./users-client";

export default async function UsersManagementPage() {
  const session = await requireRole("SUPERADMIN");

  const [rawUsers, rawGtks] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      include: {
        gtk: {
          select: {
            id: true,
            nama: true,
            nuptk: true,
            nip: true,
            jenisPtk: true,
            isAktif: true,
          },
        },
      },
    }),
    db.gtk.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        nuptk: true,
        nip: true,
        jenisPtk: true,
        isAktif: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    }),
  ]);

  const users: UserItem[] = rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    gtkId: u.gtkId,
    createdAt: u.createdAt.toISOString(),
    gtk: u.gtk
      ? {
          id: u.gtk.id,
          nama: u.gtk.nama,
          nuptk: u.gtk.nuptk,
          nip: u.gtk.nip,
          jenisPtk: u.gtk.jenisPtk,
          isAktif: u.gtk.isAktif,
        }
      : null,
  }));

  const allGtks: GtkItem[] = rawGtks.map((g) => ({
    id: g.id,
    nama: g.nama,
    nuptk: g.nuptk,
    nip: g.nip,
    jenisPtk: g.jenisPtk,
    isAktif: g.isAktif,
    user: g.user ? { id: g.user.id, username: g.user.username } : null,
  }));

  return (
    <UsersClient
      initialUsers={users}
      allGtks={allGtks}
      currentUserId={session.userId}
    />
  );
}
