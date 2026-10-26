import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getPembelajaranGuru } from "@/lib/auth/rbac";

export default async function GuruDashboard() {
  const session = await requireRole("GURU");
  const list = session.gtkId ? await getPembelajaranGuru(session.gtkId) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Pembelajaran Saya</h1>
      {list.length === 0 ? (
        <p className="text-slate-500">Belum ada pembelajaran pada semester aktif.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/guru/nilai/${p.id}`}
              className="rounded-lg bg-white p-5 shadow-sm hover:ring-2 hover:ring-blue-500">
              <p className="font-semibold text-slate-800">{p.mapel.nama}</p>
              <p className="text-sm text-slate-500">Kelas {p.rombel.nama}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
