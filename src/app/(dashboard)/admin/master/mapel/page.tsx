import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { MapelClient, type MapelRow } from "./mapel-client";

export default async function DataMapelPage() {
  await requireRole("SUPERADMIN");

  let rawMapels: any[] = [];
  try {
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
