import { requireRole } from "@/lib/auth/session";
import { assertPembelajaranAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function InputNilaiPage({
  params,
}: {
  params: Promise<{ pembelajaranId: string }>;
}) {
  const { pembelajaranId } = await params;
  const session = await requireRole("GURU");
  try {
    await assertPembelajaranAccess(session, pembelajaranId);
  } catch {
    notFound();
  }

  const p = await db.pembelajaran.findUniqueOrThrow({
    where: { id: pembelajaranId },
    include: {
      mapel: true,
      semester: true,
      penilaian: { orderBy: [{ kategori: "asc" }, { urutan: "asc" }] },
      rombel: { include: { anggota: { include: { siswa: true }, orderBy: { siswa: { nama: "asc" } } } } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{p.mapel.nama} — {p.rombel.nama}</h1>
          <p className="text-sm text-slate-500">
            Bobot: Harian {p.bobotHarian}% · UTS {p.bobotUts}% · UAS {p.bobotUas}%
            {p.semester.status !== "AKTIF" && " · 🔒 Semester dikunci (read-only)"}
          </p>
        </div>
        <a href={`/api/guru/ekspor/${p.id}`} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white">
          Unduh Format E-Rapor
        </a>
      </div>

      {/* TODO: ganti dengan komponen grid input nilai (client component + server action simpanNilai) */}
      <table className="w-full overflow-hidden rounded-lg bg-white text-sm shadow-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2">No</th>
            <th className="p-2">NISN</th>
            <th className="p-2">Nama</th>
            {p.penilaian.map((k) => (
              <th key={k.id} className="p-2">{k.nama}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rombel.anggota.map((a, i) => (
            <tr key={a.id} className="border-t">
              <td className="p-2">{i + 1}</td>
              <td className="p-2">{a.siswa.nisn}</td>
              <td className="p-2">{a.siswa.nama}</td>
              {p.penilaian.map((k) => (
                <td key={k.id} className="p-2 text-slate-400">–</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
