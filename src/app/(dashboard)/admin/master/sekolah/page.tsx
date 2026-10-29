import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { SekolahClient, type SekolahData } from "./sekolah-client";

export default async function ProfilSekolahPage() {
  await requireRole("SUPERADMIN");

  const rawSekolah = await db.sekolah.findFirst();

  const sekolah: SekolahData | null = rawSekolah
    ? {
        id: rawSekolah.id,
        npsn: rawSekolah.npsn,
        nama: rawSekolah.nama,
        bentukPendidikan: rawSekolah.bentukPendidikan,
        alamat: rawSekolah.alamat,
        desaKelurahan: rawSekolah.desaKelurahan,
        kecamatan: rawSekolah.kecamatan,
        kabupatenKota: rawSekolah.kabupatenKota,
        provinsi: rawSekolah.provinsi,
        kodePos: rawSekolah.kodePos,
        telepon: rawSekolah.telepon,
        email: rawSekolah.email,
        website: rawSekolah.website,
        namaKepsek: rawSekolah.namaKepsek,
        nipKepsek: rawSekolah.nipKepsek,
      }
    : null;

  return <SekolahClient initialData={sekolah} />;
}
