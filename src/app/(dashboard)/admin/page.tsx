import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";

export default async function AdminDashboard() {
  const [semester, siswa, gtk, guru] = await Promise.all([
    getSemesterAktif(),
    db.siswa.count({ where: { isAktif: true } }),
    db.gtk.count({ where: { isAktif: true } }),
    db.user.count({ where: { role: "GURU", isActive: true } }),
  ]);

  const stats = [
    { label: "Siswa Aktif", value: siswa },
    { label: "GTK Aktif", value: gtk },
    { label: "Akun Guru", value: guru },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Superadmin</h1>
        <p className="text-slate-500">
          Semester aktif:{" "}
          {semester ? `${semester.tahunAjaran.nama} — ${semester.tipe} (${semester.status})` : "belum diset"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-3xl font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
