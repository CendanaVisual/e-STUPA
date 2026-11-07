import { requireRole } from "@/lib/auth/session";
import { assertPembelajaranAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import InputNilaiClient, {
  type PenilaianColItem,
  type AnggotaNilaiItem,
} from "./input-nilai-client";
import type { KategoriPenilaianInput } from "@/server/actions/penilaian";

const KATEGORI_SORT_WEIGHT: Record<string, number> = {
  HARIAN: 1,
  SLM: 2,
  UTS: 3,
  UAS: 4,
};

export default async function InputNilaiPage(props: {
  params?: Promise<{ pembelajaranId: string }>;
}) {
  const pms = props?.params ? await props.params : { pembelajaranId: "" };
  const pembelajaranId = pms?.pembelajaranId;
  const session = await requireRole("GURU");
  try {
    if (!pembelajaranId) notFound();
    await assertPembelajaranAccess(session, pembelajaranId);
  } catch {
    notFound();
  }

  const p = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: {
      mapel: true,
      semester: { include: { tahunAjaran: true } },
      penilaian: { orderBy: [{ urutan: "asc" }] },
      rombel: {
        include: {
          anggota: {
            include: { siswa: true },
            orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
          },
        },
      },
    },
  });

  if (!p) {
    notFound();
  }

  const sortedPenilaian = [...p.penilaian].sort((a, b) => {
    const wa = KATEGORI_SORT_WEIGHT[a.kategori] ?? 99;
    const wb = KATEGORI_SORT_WEIGHT[b.kategori] ?? 99;
    if (wa !== wb) return wa - wb;
    return a.urutan - b.urutan;
  });

  const allNilai =
    sortedPenilaian.length > 0
      ? await db.nilai.findMany({
          where: { penilaianId: { in: sortedPenilaian.map((k) => k.id) } },
        })
      : [];

  const initialScores: Record<string, string> = {};
  allNilai.forEach((n) => {
    if (n.nilai !== null) {
      initialScores[`${n.penilaianId}_${n.siswaId}`] = String(Number(n.nilai));
    }
  });

  const penilaianItems: PenilaianColItem[] = sortedPenilaian.map((k) => ({
    id: k.id,
    kategori: k.kategori as KategoriPenilaianInput,
    urutan: k.urutan,
    nama: k.nama,
    tujuanPembelajaran: k.tujuanPembelajaran,
  }));

  const anggotaItems: AnggotaNilaiItem[] = p.rombel.anggota.map((agg) => ({
    id: agg.id,
    siswaId: agg.siswaId,
    noAbsen: agg.noAbsen,
    nisn: agg.siswa.nisn,
    nama: agg.siswa.nama,
  }));

  return (
    <InputNilaiClient
      pembelajaran={{
        id: p.id,
        mapelNama: p.mapel.nama,
        rombelNama: p.rombel.nama,
        tahunAjaranNama: p.semester?.tahunAjaran?.nama ?? "2026/2027",
        semesterTipe: p.semester?.tipe ?? "",
        semesterStatus: p.semester?.status ?? "AKTIF",
        bobotHarian: p.bobotHarian,
        bobotUts: p.bobotUts,
        bobotUas: p.bobotUas,
        kktp: p.kktp ?? 75,
      }}
      penilaianList={penilaianItems}
      anggotaList={anggotaItems}
      initialScores={initialScores}
    />
  );
}
