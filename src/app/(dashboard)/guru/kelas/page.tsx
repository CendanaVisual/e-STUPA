import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { KelasClient, type KelasPembelajaranItem } from "./kelas-client";

export default async function GuruKelasPage() {
  const session = await requireRole("GURU");

  const rawList = session.gtkId
    ? await db.pembelajaran.findMany({
        where: { gtkId: session.gtkId, semester: { isAktif: true } },
        include: { mapel: true, rombel: true, semester: true },
        orderBy: [{ rombel: { tingkat: "asc" } }, { rombel: { nama: "asc" } }],
      })
    : [];

  const items: KelasPembelajaranItem[] = rawList.map((p) => ({
    id: p.id,
    mapelNama: p.mapel.nama,
    mapelKode: p.mapel.kode,
    rombelNama: p.rombel.nama,
    rombelTingkat: p.rombel.tingkat,
    kktp: p.kktp ?? 75,
    bobotHarian: p.bobotHarian ?? 50,
    bobotUts: p.bobotUts ?? 25,
    bobotUas: p.bobotUas ?? 25,
    semesterStatus: p.semester?.status ?? "AKTIF",
  }));

  return (
    <div className="space-y-6">
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-chalkboard-user mr-1" />
            Penugasan Akademik Guru
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Kelas &amp; Input Nilai
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar kelas dan mata pelajaran yang Anda ampu pada semester aktif. Anda dapat mengatur mandiri nilai <b>KKTP</b> serta <b>Bobot Asesmen</b> (tersinkronisasi langsung ke Superadmin) dan menginput nilai siswa.
          </p>
        </div>
      </div>

      <KelasClient items={items} />
    </div>
  );
}
