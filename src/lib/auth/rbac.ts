import "server-only";
import { db } from "@/lib/db";
import type { SessionPayload } from "./jwt";

/**
 * Otorisasi tingkat DATA untuk Guru.
 * Guru hanya boleh mengakses Pembelajaran miliknya pada semester aktif
 * yang statusnya AKTIF (belum dikunci). Superadmin boleh membaca semuanya.
 */
export async function assertPembelajaranAccess(
  session: SessionPayload,
  pembelajaranId: string,
  opts: { write?: boolean } = {},
) {
  const p = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: { semester: true },
  });
  if (!p) throw new Error("Pembelajaran tidak ditemukan");

  if (session.role === "GURU" && p.gtkId !== session.gtkId) {
    throw new Error("Anda tidak mengampu pembelajaran ini");
  }
  if (opts.write && p.semester.status !== "AKTIF") {
    throw new Error("Semester sudah dikunci; nilai tidak dapat diubah");
  }
  return p;
}

/** Daftar pembelajaran milik guru pada semester aktif */
export async function getPembelajaranGuru(gtkId: string) {
  return db.pembelajaran.findMany({
    where: { gtkId, semester: { isAktif: true } },
    include: { mapel: true, rombel: true },
    orderBy: [{ rombel: { tingkat: "asc" } }, { rombel: { nama: "asc" } }],
  });
}
