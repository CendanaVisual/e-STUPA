import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import {
  getFaseByTingkat,
  MAPEL_GURU_KELAS_BY_FASE,
} from "@/lib/services/pembelajaran-utils";
import TujuanPembelajaranClient, {
  type TingkatOption,
  type TpItemData,
  type TpMapelOption,
  type TpMappingInfo,
} from "@/components/tujuan-pembelajaran/tujuan-pembelajaran-client";

export default async function GuruTujuanPembelajaranPage() {
  const session = await requireRole("GURU");
  const semester = await getSemesterAktif();

  if (!session.gtkId || !semester) {
    return (
      <TujuanPembelajaranClient
        role="GURU"
        tingkatOptions={[]}
        initialItems={[]}
        mappings={[]}
        semesterLabel={
          semester
            ? `T.A. ${semester.tahunAjaran.nama} (${semester.tipe})`
            : "Belum Ada Semester Aktif"
        }
        guruName={session.nama || session.username}
      />
    );
  }

  const [gtk, pembelajarans, waliRombels, allActiveMapels] = await Promise.all([
    db.gtk.findUnique({
      where: { id: session.gtkId },
      select: { id: true, nama: true, jenisPtk: true },
    }),
    db.pembelajaran.findMany({
      where: {
        semesterId: semester.id,
        gtkId: session.gtkId,
      },
      include: {
        rombel: { select: { id: true, nama: true, tingkat: true } },
        mapel: {
          select: { id: true, kode: true, nama: true, kelompok: true, urutan: true },
        },
      },
      orderBy: [
        { rombel: { tingkat: "asc" } },
        { mapel: { urutan: "asc" } },
        { mapel: { nama: "asc" } },
      ],
    }),
    db.rombel.findMany({
      where: {
        semesterId: semester.id,
        waliKelasId: session.gtkId,
      },
      select: { id: true, nama: true, tingkat: true },
    }),
    db.mapel.findMany({
      where: { isAktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, kode: true, nama: true, kelompok: true, urutan: true },
    }),
  ]);

  // Kumpulkan pasangan (tingkat, mapel) sesuai mapping Superadmin
  const tingkatMapelMap = new Map<
    number,
    Map<string, TpMapelOption & { urutan: number }>
  >();
  const mappingMap = new Map<
    string,
    { tingkat: number; mapelId: string; rombelSet: Set<string>; guruSet: Set<string> }
  >();

  const registerMapping = (
    tingkat: number,
    mapel: { id: string; kode: string; nama: string; kelompok: string | null; urutan: number },
    rombelNama: string,
  ) => {
    if (tingkat < 1 || tingkat > 6) return;
    let mMap = tingkatMapelMap.get(tingkat);
    if (!mMap) {
      mMap = new Map();
      tingkatMapelMap.set(tingkat, mMap);
    }
    if (!mMap.has(mapel.id)) {
      mMap.set(mapel.id, {
        id: mapel.id,
        kode: mapel.kode,
        nama: mapel.nama,
        kelompok: mapel.kelompok,
        urutan: mapel.urutan,
      });
    }

    const key = `${tingkat}_${mapel.id}`;
    let info = mappingMap.get(key);
    if (!info) {
      info = {
        tingkat,
        mapelId: mapel.id,
        rombelSet: new Set(),
        guruSet: new Set(),
      };
      mappingMap.set(key, info);
    }
    info.rombelSet.add(rombelNama);
    if (gtk?.nama) info.guruSet.add(gtk.nama);
  };

  // 1. Dari Pembelajaran yang telah diplot Superadmin
  for (const p of pembelajarans) {
    registerMapping(p.rombel.tingkat, p.mapel, p.rombel.nama);
  }

  // 2. Jika Guru Kelas ditugaskan sebagai Wali Kelas pada Rombel, pastikan mapel Fase sesuai ikut terpetakan
  const isGuruKelas =
    !gtk?.jenisPtk || gtk.jenisPtk.toLowerCase().includes("guru kelas");
  if (isGuruKelas && waliRombels.length > 0) {
    for (const r of waliRombels) {
      const { fase } = getFaseByTingkat(r.tingkat);
      const faseSpecs = MAPEL_GURU_KELAS_BY_FASE[fase];
      for (const spec of faseSpecs) {
        const matched = allActiveMapels.find(
          (m) => m.kode.toUpperCase() === spec.kode.toUpperCase(),
        );
        if (matched) {
          registerMapping(r.tingkat, matched, r.nama);
        }
      }
    }
  }

  const sortedTingkats = Array.from(tingkatMapelMap.keys()).sort((a, b) => a - b);

  const tingkatOptions: TingkatOption[] = sortedTingkats.map((tingkat) => {
    const { label: faseLabel } = getFaseByTingkat(tingkat);
    const mapelsArr = Array.from(tingkatMapelMap.get(tingkat)?.values() || [])
      .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama))
      .map(({ id, kode, nama, kelompok }) => ({ id, kode, nama, kelompok }));

    return {
      tingkat,
      faseLabel,
      mapels: mapelsArr,
    };
  });

  // Ambil hanya data TP yang sesuai dengan tingkat & mapel milik guru ini
  const allowedMapelIds = Array.from(
    new Set(
      tingkatOptions.flatMap((t) => t.mapels.map((m) => m.id)),
    ),
  );

  const tpRecords =
    sortedTingkats.length > 0 && allowedMapelIds.length > 0
      ? await db.tujuanPembelajaran.findMany({
          where: {
            semesterId: semester.id,
            tingkat: { in: sortedTingkats },
            mapelId: { in: allowedMapelIds },
          },
          orderBy: [{ tingkat: "asc" }, { urutan: "asc" }, { kodeTp: "asc" }],
        })
      : [];

  // Filter presisi per pasangan (tingkat, mapelId)
  const initialItems: TpItemData[] = tpRecords
    .filter((tp) => tingkatMapelMap.get(tp.tingkat)?.has(tp.mapelId))
    .map((tp) => ({
      id: tp.id,
      tingkat: tp.tingkat,
      mapelId: tp.mapelId,
      kodeTp: tp.kodeTp,
      tujuanPembelajaran: tp.tujuanPembelajaran,
      ruangLingkupMateri: tp.ruangLingkupMateri,
      urutan: tp.urutan,
    }));

  const mappings: TpMappingInfo[] = Array.from(mappingMap.values()).map((e) => ({
    tingkat: e.tingkat,
    mapelId: e.mapelId,
    rombelNames: Array.from(e.rombelSet).sort(),
    guruNames: Array.from(e.guruSet),
  }));

  return (
    <TujuanPembelajaranClient
      role="GURU"
      tingkatOptions={tingkatOptions}
      initialItems={initialItems}
      mappings={mappings}
      semesterLabel={`T.A. ${semester.tahunAjaran.nama} (${semester.tipe})`}
      guruName={gtk?.nama || session.nama || session.username}
    />
  );
}
