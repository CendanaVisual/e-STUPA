import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { SekolahClient, type SekolahData } from "./sekolah-client";

const DUMMY_TELEPON_SET = new Set(["(0361) 720123", "(0361) 725176"]);
const DUMMY_KEPSEK_SET = new Set([
  "Drs. I Made Sujana, M.Pd.",
  "Made Wahyuni Indrawati, S.Pd.SD., M.Pd",
]);
const DUMMY_NIP_KEPSEK_SET = new Set([
  "196805121992031008",
  "197011072007012031",
]);

export default async function ProfilSekolahPage() {
  await requireRole("SUPERADMIN");

  let rawSekolah = null;
  try {
    rawSekolah = await db.sekolah.findFirst();
    if (rawSekolah) {
      const hasDummyTelepon =
        rawSekolah.telepon !== null &&
        DUMMY_TELEPON_SET.has(rawSekolah.telepon.trim());
      const hasDummyKepsek =
        rawSekolah.namaKepsek !== null &&
        DUMMY_KEPSEK_SET.has(rawSekolah.namaKepsek.trim());
      const hasDummyNip =
        rawSekolah.nipKepsek !== null &&
        DUMMY_NIP_KEPSEK_SET.has(rawSekolah.nipKepsek.trim());

      if (hasDummyTelepon || hasDummyKepsek || hasDummyNip) {
        rawSekolah = await db.sekolah.update({
          where: { id: rawSekolah.id },
          data: {
            ...(hasDummyTelepon ? { telepon: "" } : {}),
            ...(hasDummyKepsek ? { namaKepsek: "" } : {}),
            ...(hasDummyNip ? { nipKepsek: "" } : {}),
          },
        });
      }
    }
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
