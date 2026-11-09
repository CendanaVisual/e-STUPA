import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { SekolahClient, type SekolahData } from "./sekolah-client";

export const dynamic = "force-dynamic";

export default async function ProfilSekolahPage() {
  await requireRole("SUPERADMIN");

  let rawSekolah = null;
  try {
    rawSekolah = await db.sekolah.findFirst({
      orderBy: { updatedAt: "desc" },
    });
  } catch (err) {
    console.error("[ProfilSekolahPage] Database read error, using fallback:", err);
  }

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
        telepon: rawSekolah.telepon ?? "",
        email: rawSekolah.email,
        website: rawSekolah.website,
        namaKepsek: rawSekolah.namaKepsek ?? "",
        nipKepsek: rawSekolah.nipKepsek ?? "",
        capTtdKepsekUrl: rawSekolah.capTtdKepsekUrl ?? null,
      }
    : {
        npsn: "50103069",
        nama: "SD Negeri 7 Pedungan",
        bentukPendidikan: "SD",
        alamat: "Jl. Pulau Moyo No. 63 Pedungan",
        desaKelurahan: "Pedungan",
        kecamatan: "Denpasar Selatan",
        kabupatenKota: "Kota Denpasar",
        provinsi: "Bali",
        kodePos: "80222",
        telepon: "",
        email: "sdn7pedungan63@gmail.com",
        website: "",
        namaKepsek: "",
        nipKepsek: "",
        capTtdKepsekUrl: null,
      };

  return <SekolahClient initialData={sekolah} />;
}
