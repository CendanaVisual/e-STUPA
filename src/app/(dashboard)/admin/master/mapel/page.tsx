import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { MapelClient, type MapelRow } from "./mapel-client";

export default async function DataMapelPage() {
  await requireRole("SUPERADMIN");

  let rawMapels: any[] = [];
  try {
    // Pastikan mapel dummy PAB (Pendidikan Agama dan Budi Pekerti) & MULOK bersih dari database
    const dummyPab = await db.mapel.findUnique({ where: { kode: "PAB" } });
    if (dummyPab) {
      await db.pembelajaran.deleteMany({ where: { mapelId: dummyPab.id } });
      await db.tujuanPembelajaran.deleteMany({ where: { mapelId: dummyPab.id } });
      await db.mapel.delete({ where: { id: dummyPab.id } });
    }

    const dummyMulok = await db.mapel.findUnique({ where: { kode: "MULOK" } });
    if (dummyMulok) {
      const bbMapel = await db.mapel.findUnique({ where: { kode: "BB" } });
      if (bbMapel) {
        const mulokPembs = await db.pembelajaran.findMany({
          where: { mapelId: dummyMulok.id },
        });
        for (const mp of mulokPembs) {
          const existsInBb = await db.pembelajaran.findFirst({
            where: {
              semesterId: mp.semesterId,
              rombelId: mp.rombelId,
              mapelId: bbMapel.id,
            },
          });
          if (!existsInBb) {
            await db.pembelajaran.update({
              where: { id: mp.id },
              data: { mapelId: bbMapel.id },
            });
          } else {
            await db.pembelajaran.delete({ where: { id: mp.id } });
          }
        }
      } else {
        await db.pembelajaran.deleteMany({ where: { mapelId: dummyMulok.id } });
      }
      await db.tujuanPembelajaran.deleteMany({ where: { mapelId: dummyMulok.id } });
      await db.mapel.delete({ where: { id: dummyMulok.id } });
    }

    rawMapels = await db.mapel.findMany({
      orderBy: [{ kelompok: "asc" }, { urutan: "asc" }, { nama: "asc" }],
      include: {
        _count: {
          select: { pembelajaran: true },
        },
      },
    });
  } catch (err) {
    console.error("[DataMapelPage] Database read error, using defensive fallback:", err);
  }

  const mapels: MapelRow[] = (rawMapels || []).map((m) => ({
    id: m.id,
    kode: m.kode,
    nama: m.nama,
    kodeErapor: m.kodeErapor,
    kelompok: m.kelompok,
    urutan: m.urutan,
    isAktif: m.isAktif,
    _count: {
      pembelajaran: m._count?.pembelajaran || 0,
    },
  }));

  return <MapelClient initialMapels={mapels} />;
}
