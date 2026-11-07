import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import { getFaseByTingkat } from "@/lib/services/pembelajaran-utils";
import TujuanPembelajaranClient, {
  type TingkatOption,
  type TpItemData,
  type TpMappingInfo,
} from "@/components/tujuan-pembelajaran/tujuan-pembelajaran-client";

export default async function AdminTujuanPembelajaranPage() {
  const semester = await getSemesterAktif();

  const [mapels, pembelajarans, tpRecords] = await Promise.all([
    db.mapel.findMany({
      where: { isAktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: {
        id: true,
        kode: true,
        nama: true,
        kelompok: true,
      },
    }),
    semester
      ? db.pembelajaran.findMany({
          where: { semesterId: semester.id },
          include: {
            rombel: { select: { nama: true, tingkat: true } },
            gtk: { select: { nama: true } },
          },
        })
      : Promise.resolve([]),
    semester
      ? db.tujuanPembelajaran.findMany({
          where: { semesterId: semester.id },
          orderBy: [{ tingkat: "asc" }, { urutan: "asc" }, { kodeTp: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // Susun mapping info per (tingkat, mapelId) dari Pembelajaran & Pengampu
  const mappingMap = new Map<string, { tingkat: number; mapelId: string; rombelSet: Set<string>; guruSet: Set<string> }>();
  for (const p of pembelajarans) {
    const key = `${p.rombel.tingkat}_${p.mapelId}`;
    let entry = mappingMap.get(key);
    if (!entry) {
      entry = {
        tingkat: p.rombel.tingkat,
        mapelId: p.mapelId,
        rombelSet: new Set(),
        guruSet: new Set(),
      };
      mappingMap.set(key, entry);
    }
    entry.rombelSet.add(p.rombel.nama);
    entry.guruSet.add(p.gtk.nama);
  }

  const mappings: TpMappingInfo[] = Array.from(mappingMap.values()).map((e) => ({
    tingkat: e.tingkat,
    mapelId: e.mapelId,
    rombelNames: Array.from(e.rombelSet).sort(),
    guruNames: Array.from(e.guruSet),
  }));

  // Susun opsi tingkat kelas 1 s/d 6 dan pembagian mapel per tingkat
  const tingkatOptions: TingkatOption[] = [1, 2, 3, 4, 5, 6].map((tingkat) => {
    const { label: faseLabel } = getFaseByTingkat(tingkat);
    const mapelsForTingkat = mapels.filter((m) => {
      // Pada Fase A (Kelas 1 & 2), IPAS belum diajarkan kecuali sudah ada data TP/pembelajaran
      if (tingkat <= 2 && m.kode.toUpperCase() === "IPAS") {
        const hasExisting =
          mappingMap.has(`${tingkat}_${m.id}`) ||
          tpRecords.some((tp) => tp.tingkat === tingkat && tp.mapelId === m.id);
        return hasExisting;
      }
      return true;
    });

    return {
      tingkat,
      faseLabel,
      mapels: mapelsForTingkat,
    };
  });

  const initialItems: TpItemData[] = tpRecords.map((tp) => ({
    id: tp.id,
    tingkat: tp.tingkat,
    mapelId: tp.mapelId,
    kodeTp: tp.kodeTp,
    tujuanPembelajaran: tp.tujuanPembelajaran,
    ruangLingkupMateri: tp.ruangLingkupMateri,
    urutan: tp.urutan,
  }));

  const semesterLabel = semester
    ? `T.A. ${semester.tahunAjaran.nama} (${semester.tipe})`
    : "Belum Ada Semester Aktif";

  return (
    <TujuanPembelajaranClient
      role="SUPERADMIN"
      tingkatOptions={tingkatOptions}
      initialItems={initialItems}
      mappings={mappings}
      semesterLabel={semesterLabel}
    />
  );
}
